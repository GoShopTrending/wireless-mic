const roomHandler = require('./handlers/room.handler');
const signalingHandler = require('./handlers/signaling.handler');
const audioHandler = require('./handlers/audio.handler');
const roomService = require('../services/room.service');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    // Room handlers
    roomHandler(io, socket);

    // WebRTC signaling handlers
    signalingHandler(io, socket);

    // Audio control handlers
    audioHandler(io, socket);

    // Desconexión
    socket.on('disconnect', () => {
      console.log(`[Socket] Cliente desconectado: ${socket.id}`);

      // Buscar si estaba en alguna sala
      const result = roomService.findRoomBySocket(socket.id);

      if (result) {
        const { room, role, mic } = result;

        if (role === 'host') {
          // El host se desconectó - cerrar la sala
          console.log(`[Socket] Host desconectado, cerrando sala ${room.roomId}`);

          // Notificar a todos los micrófonos
          io.to(room.roomId).emit('room-closed', {
            reason: 'Host disconnected'
          });

          // Eliminar la sala
          roomService.deleteRoom(room.roomId);
        } else if (role === 'mic') {
          // Un micrófono se desconectó
          console.log(`[Socket] Mic "${mic.name}" desconectado de sala ${room.roomId}`);

          // Notificar al host
          io.to(room.hostId).emit('mic-disconnected', {
            micId: socket.id,
            name: mic.name
          });

          // Eliminar micrófono de la sala
          roomService.removeMicFromRoom(room.roomId, socket.id);
        }
      }
    });
  });

  console.log('[Socket] Handlers configurados');
}

module.exports = { setupSocketHandlers };
