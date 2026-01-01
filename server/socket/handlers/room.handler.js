const roomService = require('../../services/room.service');
const qrService = require('../../services/qr.service');

module.exports = function(io, socket) {

  /**
   * Host crea una nueva sala
   */
  socket.on('create-room', async (data, callback) => {
    try {
      const { roomName } = data || {};

      // Crear sala
      const room = roomService.createRoom(socket.id, roomName);

      // Generar QR
      const qr = await qrService.generateQRDataUrl(room.roomId);

      // Unir al host a la sala (Socket.io room)
      socket.join(room.roomId);

      console.log(`[Room] Host ${socket.id} creó sala ${room.roomId}`);

      callback({
        success: true,
        room: {
          roomId: room.roomId,
          roomName: room.roomName,
          settings: room.settings
        },
        qr: qr
      });
    } catch (error) {
      console.error('[Room] Error creando sala:', error);
      callback({ success: false, error: error.message });
    }
  });

  /**
   * Micrófono se une a una sala existente
   */
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomId, micName } = data;

      // Verificar que la sala existe
      const room = roomService.getRoom(roomId);
      if (!room) {
        return callback({ success: false, error: 'Sala no encontrada' });
      }

      // Agregar micrófono
      const mic = roomService.addMicToRoom(roomId, socket.id, micName);

      if (mic.error) {
        return callback({ success: false, error: mic.error });
      }

      // Unir a la sala (Socket.io room)
      socket.join(roomId);

      console.log(`[Room] Mic "${mic.name}" unido a sala ${roomId}`);

      // Notificar al host
      io.to(room.hostId).emit('mic-joined', {
        micId: socket.id,
        peerId: mic.peerId,
        name: mic.name,
        settings: mic.localSettings
      });

      callback({
        success: true,
        room: {
          roomId: room.roomId,
          roomName: room.roomName
        },
        mic: {
          micId: socket.id,
          peerId: mic.peerId,
          name: mic.name
        },
        hostId: room.hostId
      });
    } catch (error) {
      console.error('[Room] Error uniendo a sala:', error);
      callback({ success: false, error: error.message });
    }
  });

  /**
   * Obtener información de una sala
   */
  socket.on('get-room-info', (data, callback) => {
    const { roomId } = data;
    const room = roomService.getRoom(roomId);

    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada' });
    }

    const mics = roomService.getAllMics(roomId);

    callback({
      success: true,
      room: {
        roomId: room.roomId,
        roomName: room.roomName,
        settings: room.settings
      },
      mics: mics.map(m => ({
        micId: m.micId,
        name: m.name,
        status: m.status,
        hostSettings: m.hostSettings
      }))
    });
  });

  /**
   * Host expulsa un micrófono
   */
  socket.on('kick-mic', (data) => {
    const { roomId, micId } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) {
      return; // Solo el host puede expulsar
    }

    const mic = roomService.getMic(roomId, micId);
    if (mic) {
      // Notificar al micrófono
      io.to(micId).emit('kicked', { reason: 'Expulsado por el host' });

      // Eliminar de la sala
      roomService.removeMicFromRoom(roomId, micId);

      // Notificar a todos
      io.to(roomId).emit('mic-left', {
        micId,
        name: mic.name,
        reason: 'kicked'
      });
    }
  });

  /**
   * Verificar si una sala existe (para clientes antes de unirse)
   */
  socket.on('check-room', (data, callback) => {
    const { roomId } = data;
    const exists = roomService.roomExists(roomId);

    if (exists) {
      const room = roomService.getRoom(roomId);
      callback({
        success: true,
        exists: true,
        roomName: room.roomName,
        micCount: room.mics.size,
        maxMics: room.settings.maxMics
      });
    } else {
      callback({ success: true, exists: false });
    }
  });
};
