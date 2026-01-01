const express = require('express');
const router = express.Router();
const roomService = require('../services/room.service');
const qrService = require('../services/qr.service');

/**
 * GET /api/health
 * Health check del servidor
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version
  });
});

/**
 * GET /api/stats
 * Estadísticas del servidor
 */
router.get('/stats', (req, res) => {
  const stats = roomService.getStats();
  res.json(stats);
});

/**
 * GET /api/room/:roomId
 * Verificar si una sala existe
 */
router.get('/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = roomService.getRoom(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }

  res.json({
    roomId: room.roomId,
    roomName: room.roomName,
    micCount: room.mics.size,
    maxMics: room.settings.maxMics,
    createdAt: room.createdAt
  });
});

/**
 * GET /api/room/:roomId/qr
 * Generar QR para una sala
 */
router.get('/room/:roomId/qr', async (req, res) => {
  const { roomId } = req.params;
  const { format } = req.query; // 'dataurl' o 'svg'

  const room = roomService.getRoom(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }

  try {
    if (format === 'svg') {
      const qr = await qrService.generateQRSvg(roomId);
      res.type('image/svg+xml').send(qr.svg);
    } else {
      const qr = await qrService.generateQRDataUrl(roomId);
      res.json(qr);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error generando QR' });
  }
});

/**
 * GET /api/version
 * Versión de la aplicación
 */
router.get('/version', (req, res) => {
  try {
    const version = require('../../version.json');
    res.json(version);
  } catch (e) {
    res.json({ version: require('../../package.json').version });
  }
});

module.exports = router;
