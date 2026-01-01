const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Almacenamiento en memoria de las salas
const rooms = new Map();

/**
 * Genera un ID corto para la sala
 */
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < config.room.idLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Crea una nueva sala
 */
function createRoom(hostSocketId, roomName = null) {
  let roomId;

  // Generar ID único
  do {
    roomId = generateRoomId();
  } while (rooms.has(roomId));

  const room = {
    roomId,
    roomName: roomName || `${config.room.defaultName} ${roomId}`,
    hostId: hostSocketId,
    createdAt: new Date().toISOString(),
    settings: {
      maxMics: config.room.maxMics,
      masterVolume: config.audio.defaultVolume,
      globalEffects: { ...config.audio.defaultEffects }
    },
    mics: new Map()
  };

  rooms.set(roomId, room);
  console.log(`[Room] Sala creada: ${roomId} por host ${hostSocketId}`);

  return room;
}

/**
 * Obtiene una sala por ID
 */
function getRoom(roomId) {
  return rooms.get(roomId);
}

/**
 * Verifica si existe una sala
 */
function roomExists(roomId) {
  return rooms.has(roomId);
}

/**
 * Agrega un micrófono a la sala
 */
function addMicToRoom(roomId, micSocketId, micName) {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.mics.size >= room.settings.maxMics) {
    return { error: 'Sala llena' };
  }

  const mic = {
    micId: micSocketId,
    peerId: uuidv4(),
    name: micName || `Mic ${room.mics.size + 1}`,
    joinedAt: new Date().toISOString(),
    status: 'active',
    localSettings: {
      volume: config.audio.defaultVolume,
      muted: false,
      effects: { ...config.audio.defaultEffects }
    },
    hostSettings: {
      volume: config.audio.defaultVolume,
      muted: false,
      solo: false,
      effects: { ...config.audio.defaultEffects }
    },
    stats: {
      latency: 0,
      audioLevel: -60
    }
  };

  room.mics.set(micSocketId, mic);
  console.log(`[Room] Mic "${mic.name}" unido a sala ${roomId}`);

  return mic;
}

/**
 * Elimina un micrófono de la sala
 */
function removeMicFromRoom(roomId, micSocketId) {
  const room = rooms.get(roomId);
  if (!room) return false;

  const mic = room.mics.get(micSocketId);
  if (mic) {
    room.mics.delete(micSocketId);
    console.log(`[Room] Mic "${mic.name}" eliminado de sala ${roomId}`);
    return true;
  }
  return false;
}

/**
 * Obtiene un micrófono de la sala
 */
function getMic(roomId, micSocketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return room.mics.get(micSocketId);
}

/**
 * Obtiene todos los micrófonos de una sala
 */
function getAllMics(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.mics.values());
}

/**
 * Actualiza configuración de un micrófono
 */
function updateMicSettings(roomId, micSocketId, settings, source = 'host') {
  const room = rooms.get(roomId);
  if (!room) return null;

  const mic = room.mics.get(micSocketId);
  if (!mic) return null;

  const targetSettings = source === 'host' ? mic.hostSettings : mic.localSettings;
  Object.assign(targetSettings, settings);

  return mic;
}

/**
 * Actualiza configuración global de la sala
 */
function updateRoomSettings(roomId, settings) {
  const room = rooms.get(roomId);
  if (!room) return null;

  Object.assign(room.settings, settings);
  return room;
}

/**
 * Elimina una sala
 */
function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    rooms.delete(roomId);
    console.log(`[Room] Sala ${roomId} eliminada`);
    return true;
  }
  return false;
}

/**
 * Encuentra la sala a la que pertenece un socket
 */
function findRoomBySocket(socketId) {
  for (const [roomId, room] of rooms) {
    if (room.hostId === socketId) {
      return { room, role: 'host' };
    }
    if (room.mics.has(socketId)) {
      return { room, role: 'mic', mic: room.mics.get(socketId) };
    }
  }
  return null;
}

/**
 * Obtiene estadísticas de todas las salas
 */
function getStats() {
  return {
    totalRooms: rooms.size,
    rooms: Array.from(rooms.values()).map(r => ({
      roomId: r.roomId,
      roomName: r.roomName,
      micCount: r.mics.size
    }))
  };
}

module.exports = {
  createRoom,
  getRoom,
  roomExists,
  addMicToRoom,
  removeMicFromRoom,
  getMic,
  getAllMics,
  updateMicSettings,
  updateRoomSettings,
  deleteRoom,
  findRoomBySocket,
  getStats
};
