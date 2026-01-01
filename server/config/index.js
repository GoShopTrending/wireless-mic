// Detectar BASE_URL correctamente
function getBaseUrl() {
  let url = process.env.BASE_URL || 'http://localhost:3000';

  // Si Render pasa solo el hostname, agregar https://
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url;
}

module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  baseUrl: getBaseUrl(),

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
