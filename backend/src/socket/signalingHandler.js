/**
 * Socket.io Signaling Handler
 *
 * With Jitsi handling WebRTC natively, this handler no longer needs to relay
 * offer/answer/ICE-candidate frames.  It focuses on:
 *
 *  - Room presence tracking       → join-room, leave-room, peer-joined, room-state
 *  - Code editor sync             → code-sync
 *  - Proctoring violation alerts  → proctoring-violation
 *  - Session lifecycle            → end-interview
 *  - In-room chat                 → chat-message
 */

const setupSignaling = (io) => {
  // Track active rooms: { roomId: { role: socketId } }
  const rooms = {};

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── Join Room ────────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomId, userId, userName, role }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = role;
      socket.data.userId = userId;
      socket.data.userName = userName;

      if (!rooms[roomId]) rooms[roomId] = {};
      rooms[roomId][role] = socket.id;

      console.log(`[Socket] ${role} (${userName}) joined room: ${roomId}`);

      // Notify other participant that someone joined
      socket.to(roomId).emit('peer-joined', { userId, userName, role, socketId: socket.id });

      // Send current participants to the joining user
      socket.emit('room-state', { participants: rooms[roomId] });
    });

    // ─── Code Sync ────────────────────────────────────────────────────────────
    socket.on('code-sync', ({ roomId, code, lang, inp, outp, err, comp, stat }) => {
      socket.to(roomId).emit('code-sync', { code, lang, inp, outp, err, comp, stat });
    });

    // ─── Proctoring Violation Alert ───────────────────────────────────────────
    socket.on('proctoring-violation', ({ roomId, eventType, description, severity, timestamp }) => {
      socket.to(roomId).emit('proctoring-violation', {
        eventType,
        description,
        severity,
        timestamp,
        candidateSocketId: socket.id,
        candidateName: socket.data.userName,
      });
      console.log(`[Proctoring] ${eventType} in room ${roomId} by ${socket.data.userName}`);
    });

    // ─── End Interview ────────────────────────────────────────────────────────
    socket.on('end-interview', ({ roomId }) => {
      socket.to(roomId).emit('end-interview');
    });

    // ─── Chat Messages ────────────────────────────────────────────────────────
    socket.on('chat-message', ({ roomId, message, senderName }) => {
      socket.to(roomId).emit('chat-message', {
        message,
        senderName,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    // ─── Leave / Disconnect ───────────────────────────────────────────────────
    socket.on('leave-room', ({ roomId }) => {
      handleLeave(socket, roomId, io, rooms);
    });

    socket.on('disconnect', () => {
      const { roomId } = socket.data;
      if (roomId) handleLeave(socket, roomId, io, rooms);
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
};

const handleLeave = (socket, roomId, io, rooms) => {
  socket.leave(roomId);
  if (rooms[roomId]) {
    Object.keys(rooms[roomId]).forEach((role) => {
      if (rooms[roomId][role] === socket.id) delete rooms[roomId][role];
    });
    if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
  }
  io.to(roomId).emit('peer-left', {
    socketId: socket.id,
    role: socket.data.role,
    userName: socket.data.userName,
  });
};

module.exports = setupSignaling;
