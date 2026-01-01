const roomService = require('../../services/room.service');

module.exports = function(io, socket) {

  /**
   * Relay de señales WebRTC (offer, answer, ICE candidates)
   *
   * El servidor actúa solo como relay, no procesa las señales
   */
  socket.on('webrtc-signal', (data) => {
    const { to, signal, roomId } = data;

    // Verificar que ambos están en la misma sala
    const senderResult = roomService.findRoomBySocket(socket.id);
    const receiverResult = roomService.findRoomBySocket(to);

    if (!senderResult || !receiverResult) {
      console.log('[Signaling] Uno de los peers no está en una sala');
      return;
    }

    if (senderResult.room.roomId !== receiverResult.room.roomId) {
      console.log('[Signaling] Los peers están en salas diferentes');
      return;
    }

    // Relay la señal al destinatario
    io.to(to).emit('webrtc-signal', {
      from: socket.id,
      signal: signal
    });

    console.log(`[Signaling] Relay de señal de ${socket.id} a ${to}`);
  });

  /**
   * Notificación de que WebRTC está listo
   */
  socket.on('webrtc-ready', (data) => {
    const { roomId, peerId } = data;
    const room = roomService.getRoom(roomId);

    if (!room) return;

    // Notificar al host que el mic está listo para WebRTC
    io.to(room.hostId).emit('mic-webrtc-ready', {
      micId: socket.id,
      peerId
    });

    console.log(`[Signaling] Mic ${socket.id} listo para WebRTC`);
  });

  /**
   * Host inicia conexión WebRTC con un micrófono
   */
  socket.on('initiate-webrtc', (data) => {
    const { roomId, micId } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) {
      console.log('[Signaling] Solo el host puede iniciar WebRTC');
      return;
    }

    // Notificar al micrófono que inicie la conexión
    io.to(micId).emit('start-webrtc', {
      hostId: socket.id
    });

    console.log(`[Signaling] Host solicita WebRTC con mic ${micId}`);
  });

  /**
   * Reporte de estado de conexión WebRTC
   */
  socket.on('webrtc-state', (data) => {
    const { roomId, state, peerId } = data;
    const room = roomService.getRoom(roomId);

    if (!room) return;

    const result = roomService.findRoomBySocket(socket.id);
    if (!result) return;

    if (result.role === 'mic') {
      // Notificar al host sobre el estado del mic
      io.to(room.hostId).emit('mic-webrtc-state', {
        micId: socket.id,
        state
      });
    }

    console.log(`[Signaling] WebRTC state: ${state} para ${socket.id}`);
  });

  /**
   * Reporte de latencia medida
   */
  socket.on('latency-report', (data) => {
    const { roomId, latency } = data;
    const room = roomService.getRoom(roomId);

    if (!room) return;

    // Actualizar stats del micrófono
    const mic = roomService.getMic(roomId, socket.id);
    if (mic) {
      mic.stats.latency = latency;
    }

    // Notificar al host
    io.to(room.hostId).emit('mic-latency', {
      micId: socket.id,
      latency
    });
  });
};
