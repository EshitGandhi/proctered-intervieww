import { useRef, useState, useCallback, useEffect } from 'react';
import { connectSocket } from '../services/socket';

/**
 * useJitsi — wraps the Jitsi Meet External API (iFrame API).
 *
 * It dynamically loads the Jitsi IFrame API script once, then creates a
 * JitsiMeetExternalAPI instance mounted inside a caller-provided container div.
 *
 * The hook exposes:
 *  - containerRef  → attach to the <div> that will host the Jitsi iframe
 *  - api           → the raw JitsiMeetExternalAPI instance (for advanced use)
 *  - connected     → true once the conference is joined
 *  - micMuted      → current mic state
 *  - cameraOff     → current camera state
 *  - joinRoom()    → initialise Jitsi and join the room
 *  - leaveRoom()   → hang up and clean up
 *  - toggleMic()   → toggle mute
 *  - toggleCamera()→ toggle camera
 *  - socket        → ref to our Socket.io socket (for proctoring / chat / code-sync)
 *
 * @param {string} roomId       - interview roomId (used as Jitsi room name)
 * @param {string} userId
 * @param {string} userName
 * @param {'candidate'|'interviewer'} role
 * @param {string} [domain]     - Jitsi server (defaults to meet.jit.si)
 */

const JITSI_DOMAIN = 'meet.jit.si';
const JITSI_SCRIPT_URL = `https://${JITSI_DOMAIN}/external_api.js`;

/** Dynamically load the Jitsi external_api.js script once */
function loadJitsiScript() {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${JITSI_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Jitsi script'));
    document.head.appendChild(script);
  });
}

const useJitsi = ({ roomId, userId, userName, role }) => {
  const [connected, setConnected] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('new');

  const apiRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);

  // ── Join Room ──────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    try {
      setConnectionState('connecting');
      await loadJitsiScript();

      if (!containerRef.current) {
        throw new Error('Jitsi container div is not mounted yet.');
      }

      // Clean up any existing instance
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }

      // Sanitize room name — Jitsi room names must be alphanumeric/hyphens
      const jitsiRoom = `klprarambh-${roomId}`.replace(/[^a-zA-Z0-9-_]/g, '-');

      const options = {
        roomName: jitsiRoom,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: userName,
          email: userId ? `${userId}@klprarambh.internal` : '',
        },
        configOverwrite: {
          // Hide Jitsi's own "prejoin" page — join directly
          prejoinPageEnabled: false,
          // Disable Jitsi's own lobby
          enableLobbyChat: false,
          // Disable welcome page
          enableWelcomePage: false,
          // Disable room password
          enableInsecureRoomNameWarning: false,
          // Start with mic & camera ON
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          // Disable noisy mic detection pop-ups
          enableNoisyMicDetection: false,
          // Disable call quality notifications
          disablePolls: true,
          notifications: [],
          // Participants limit (just the 2 of them)
          conferenceInfo: {
            alwaysVisible: [],
          },
        },
        interfaceConfigOverwrite: {
          // Hide most of Jitsi's default toolbar — we provide our own ControlBar
          TOOLBAR_BUTTONS: [],
          // Hide the filmstrip (we use our own video layout)
          FILM_STRIP_MAX_HEIGHT: 0,
          DEFAULT_REMOTE_DISPLAY_NAME: role === 'candidate' ? 'Interviewer' : 'Candidate',
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          HIDE_INVITE_MORE_HEADER: true,
        },
      };

      const jitsiApi = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);
      apiRef.current = jitsiApi;

      // ── Jitsi Events ───────────────────────────────────────────────────────
      jitsiApi.addEventListener('videoConferenceJoined', () => {
        setConnected(true);
        setConnectionState('connected');
        console.log('[Jitsi] Joined conference');
      });

      jitsiApi.addEventListener('videoConferenceLeft', () => {
        setConnected(false);
        setConnectionState('disconnected');
        console.log('[Jitsi] Left conference');
      });

      jitsiApi.addEventListener('audioMuteStatusChanged', ({ muted }) => {
        setMicMuted(muted);
      });

      jitsiApi.addEventListener('videoMuteStatusChanged', ({ muted }) => {
        setCameraOff(muted);
      });

      jitsiApi.addEventListener('errorOccurred', ({ error: jitsiError }) => {
        console.error('[Jitsi] Error:', jitsiError);
        setError(jitsiError?.message || 'A Jitsi error occurred.');
        setConnectionState('failed');
      });

      // ── Connect Socket.io (for proctoring / chat / code-sync) ─────────────
      const socket = connectSocket();
      socketRef.current = socket;
      socket.emit('join-room', { roomId, userId, userName, role });

    } catch (err) {
      console.error('[useJitsi] joinRoom failed:', err);
      setError(err.message);
      setConnectionState('failed');
      throw err;
    }
  }, [roomId, userId, userName, role]);

  // ── Leave Room ─────────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave-room', { roomId });
    if (apiRef.current) {
      try { apiRef.current.executeCommand('hangup'); } catch (_) {}
      setTimeout(() => {
        try { apiRef.current?.dispose(); } catch (_) {}
        apiRef.current = null;
      }, 500);
    }
    setConnected(false);
    setConnectionState('disconnected');
  }, [roomId]);

  // ── Toggle Mic ─────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleAudio');
      // State update comes from the audioMuteStatusChanged event
    }
  }, []);

  // ── Toggle Camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleVideo');
      // State update comes from the videoMuteStatusChanged event
    }
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    containerRef,
    api: apiRef,
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
    // Expose null streams for backwards-compat (recorder will be disabled)
    localStream: null,
    remoteStream: null,
  };
};

export default useJitsi;
