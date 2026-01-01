require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { setupSocketHandlers } = require('./socket');
const apiRoutes = require('./routes/api');
const config = require('./config');

const app = express();
const httpServer = createServer(app);

// Socket.io con CORS
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Archivos estáticos (PWA)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);

// Setup Socket.io handlers
setupSocketHandlers(io);

// Ruta para Host
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/host.html'));
});

// Ruta para Micrófono
app.get('/mic', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mic.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Guardar PID para scripts de gestión
const pidFile = path.join(__dirname, '..', '.server-pid.json');

httpServer.listen(config.port, config.host, () => {
  console.log('='.repeat(50));
  console.log('  WIRELESS MICROPHONE PWA');
  console.log('='.repeat(50));
  console.log(`  Servidor corriendo en: http://${config.host}:${config.port}`);
  console.log(`  Host URL: http://localhost:${config.port}/host`);
  console.log(`  Mic URL:  http://localhost:${config.port}/mic`);
  console.log('='.repeat(50));

  // Guardar PID
  fs.writeFileSync(pidFile, JSON.stringify({
    pid: process.pid,
    port: config.port,
    startedAt: new Date().toISOString()
  }));
});

// Limpieza al cerrar
process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Cerrando servidor...');
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
  httpServer.close(() => {
    process.exit(0);
  });
});
