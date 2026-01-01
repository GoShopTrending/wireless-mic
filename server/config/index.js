module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Configuración de salas
  room: {
    maxMics: 15,           // Máximo de micrófonos por sala
    idLength: 6,           // Longitud del ID de sala
    defaultName: 'Sala'    // Nombre por defecto
  },

  // Configuración de audio
  audio: {
    defaultVolume: 1.0,
    defaultEffects: {
      reverb: 0,
      echo: 0,
      eqBass: 0,
      eqMid: 0,
      eqTreble: 0
    }
  }
};
