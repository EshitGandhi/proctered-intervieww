import { useRef, useState, useCallback, useEffect } from 'react';
import { connectSocket } from '../services/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

/**
 * useWebRTC — manages peer connection, media streams, and signaling.
 * @param {string} roomId
 * @param {string} userId
 * @param {string} userName
 * @param {string} role - 'candidate' | 'interviewer'
 */
const useWebRTC = ({ roomId, userId, userName, role }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const isInitiator = useRef(false);

  // ── Get user media ──────────────────────────────────────────────────
  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      setError(`Camera/mic access denied: ${err.message}`);
      throw err;
    }
  }, []);

  // ── Create peer connection ─────────────────────────────────────────
  const createPeerConnection = useCallback((stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Remote stream
    const remoteMediaStream = new MediaStream();
    setRemoteStream(remoteMediaStream);

    pc.ontrack = (e) => {
      // Bulletproof track adding directly from e.track
      if (e.track) {
        remoteMediaStream.addTrack(e.track);
        setRemoteStream(new MediaStream(remoteMediaStream.getTracks()));
      }
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { roomId, candidate: e.candidate });
      }
    };

    // Negotiation needed (track added/removed, or ICE restart)
    pc.onnegotiationneeded = async () => {
      if (isInitiator.current && pc.signalingState !== 'closed') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current) {
            socketRef.current.emit('offer', { roomId, offer });
          }
        } catch (err) {
          console.error('Renegotiation failed:', err);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') setConnected(true);
      if (['disconnected', 'failed'].includes(pc.connectionState)) {
        setConnected(false);
        // Auto-reconnect on failure
        if (pc.connectionState === 'failed') restartIce(pc);
      }
    };

    return pc;
  }, [roomId]);

  const restartIce = (pc) => {
    if (pc && isInitiator.current) {
      pc.restartIce();
    }
  };

  // ── Connect to room (Socket.io + WebRTC signaling) ─────────────────
  const joinRoom = useCallback(async () => {
    const stream = await startMedia();
    const socket = connectSocket();
    socketRef.current = socket;

    const pc = createPeerConnection(stream);

    // ─ Socket events ─
    socket.on('peer-joined', async ({ role: peerRole }) => {
      // The side that gets 'peer-joined' becomes the initiator
      if (!isInitiator.current) {
        isInitiator.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
      }
    });

    socket.on('offer', async ({ offer }) => {
      if (pc.signalingState !== 'stable') return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    });

    socket.on('answer', async ({ answer }) => {
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        // ignore stale candidates
      }
    });

    socket.on('peer-left', () => {
      setRemoteStream(null);
      setConnected(false);
      setConnectionState('disconnected');
    });

    socket.emit('join-room', { roomId, userId, userName, role });
  }, [roomId, userId, userName, role, startMedia, createPeerConnection]);

  // ── Toggle mic ─────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicMuted((prev) => !prev);
  }, []);

  // ── Toggle camera ──────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (!cameraOff) {
      // Turn OFF: Stop the track completely to release the hardware
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
        
        // Remove from peer connection (set sent track to null)
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(null);
      }
      setCameraOff(true);
    } else {
      // Turn ON: Re-request video from hardware
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        localStreamRef.current.addTrack(newVideoTrack);
        
        // Update peer connection
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video' || (!s.track && s.track === null));
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        } else if (pcRef.current) {
          pcRef.current.addTrack(newVideoTrack, localStreamRef.current);
        }
        
        // Force React to re-render the local video element with the new track
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setCameraOff(false);
      } catch (err) {
        console.error('Failed to restart camera:', err);
      }
    }
  }, [cameraOff]);

  // ── Cleanup ────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave-room', { roomId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    setLocalStream(null);
    setRemoteStream(null);
    setConnected(false);
  }, [roomId]);

  useEffect(() => () => leaveRoom(), []);

  return {
    localStream,
    remoteStream,
    connected,
    connectionState,
    micMuted,
    cameraOff,
    error,
    joinRoom,
    leaveRoom,
    toggleMic,
    toggleCamera,
    socket: socketRef,
  };
};

export default useWebRTC;
