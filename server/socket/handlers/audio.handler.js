const roomService = require('../../services/room.service');

module.exports = function(io, socket) {

  /**
   * Micrófono reporta cambio de volumen local
   */
  socket.on('mic-volume-change', (data) => {
    const { roomId, volume } = data;
    const room = roomService.getRoom(roomId);

    if (!room) return;

    // Actualizar settings del micrófono
    roomService.updateMicSettings(roomId, socket.id, { volume }, 'local');

    // Notificar al host
    io.to(room.hostId).emit('mic-local-volume', {
      micId: socket.id,
      volume
    });
  });

  /**
   * Micrófono reporta mute/unmute
   */
  socket.on('mic-mute-toggle', (data) => {
    const { roomId, muted } = data;
    const room = roomService.getRoom(roomId);

    if (!room) return;

    // Actualizar settings
    roomService.updateMicSettings(roomId, socket.id, { muted }, 'local');

    // Notificar al host
    io.to(room.hostId).emit('mic-mute-state', {
      micId: socket.id,
      muted
    });
  });

  /**
   * Host cambia volumen de un micrófono
   */
  socket.on('host-set-mic-volume', (data) => {
    const { roomId, micId, volume } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) return;

    // Actualizar settings
    roomService.updateMicSettings(roomId, micId, { volume }, 'host');

    // Notificar al micrófono
    io.to(micId).emit('host-volume-override', { volume });
  });

  /**
   * Host mutea/desmutea un micrófono
   */
  socket.on('host-mute-mic', (data) => {
    const { roomId, micId, muted } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) return;

    // Actualizar settings
    roomService.updateMicSettings(roomId, micId, { muted }, 'host');

    // Notificar al micrófono
    io.to(micId).emit('host-mute-override', { muted });

    // Notificar a todos (para UI)
    io.to(roomId).emit('mic-muted-by-host', { micId, muted });
  });

  /**
   * Host cambia volumen master
   */
  socket.on('master-volume-change', (data) => {
    const { roomId, volume } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) return;

    // Actualizar settings de la sala
    roomService.updateRoomSettings(roomId, { masterVolume: volume });
  });

  /**
   * Host cambia efectos globales
   */
  socket.on('global-effects-change', (data) => {
    const { roomId, effects } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) return;

    // Actualizar settings
    roomService.updateRoomSettings(roomId, { globalEffects: effects });

    // Notificar a todos los micrófonos
    io.to(roomId).emit('global-effects-update', { effects });
  });

  /**
   * Host cambia efectos de un micrófono específico
   */
  socket.on('mic-effects-change', (data) => {
    const { roomId, micId, effects } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) return;

    // Actualizar settings
    roomService.updateMicSettings(roomId, micId, { effects }, 'host');

    // Notificar al micrófono
    io.to(micId).emit('effects-update', { effects });
  });

  /**
   * Micrófono reporta nivel de audio (para VU meter)
   */
  socket.on('audio-level', (data) => {
    const { roomId, level } = data;
    const room = roomService.getRoom(roomId);

    if (!room) return;

    // Actualizar stats
    const mic = roomService.getMic(roomId, socket.id);
    if (mic) {
      mic.stats.audioLevel = level;
    }

    // Notificar al host (throttled en cliente)
    io.to(room.hostId).emit('mic-audio-level', {
      micId: socket.id,
      level
    });
  });

  /**
   * Host solicita solo (solo) un micrófono
   */
  socket.on('solo-mic', (data) => {
    const { roomId, micId, solo } = data;
    const room = roomService.getRoom(roomId);

    if (!room || room.hostId !== socket.id) return;

    // Actualizar settings
    roomService.updateMicSettings(roomId, micId, { solo }, 'host');

    // Notificar cambio
    io.to(room.hostId).emit('mic-solo-state', { micId, solo });
  });
};
