const QRCode = require('qrcode');
const config = require('../config');

/**
 * Genera la URL para conectarse a una sala
 */
function generateRoomUrl(roomId) {
  return `${config.baseUrl}/mic?room=${roomId}`;
}

/**
 * Genera un código QR como Data URL
 */
async function generateQRDataUrl(roomId) {
  const url = generateRoomUrl(roomId);

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    return {
      dataUrl,
      url,
      roomId
    };
  } catch (error) {
    console.error('[QR] Error generando QR:', error);
    throw error;
  }
}

/**
 * Genera un código QR como SVG
 */
async function generateQRSvg(roomId) {
  const url = generateRoomUrl(roomId);

  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    return {
      svg,
      url,
      roomId
    };
  } catch (error) {
    console.error('[QR] Error generando QR SVG:', error);
    throw error;
  }
}

module.exports = {
  generateRoomUrl,
  generateQRDataUrl,
  generateQRSvg
};
