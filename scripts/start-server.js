const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const pidFile = path.join(__dirname, '..', '.server-pid.json');

// Verificar si ya está corriendo
if (fs.existsSync(pidFile)) {
  const data = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
  try {
    process.kill(data.pid, 0);
    console.log(`Servidor ya está corriendo en PID ${data.pid}`);
    console.log(`URL: http://localhost:${data.port || 3000}`);
    process.exit(0);
  } catch (e) {
    // El proceso no existe, eliminar archivo PID
    fs.unlinkSync(pidFile);
  }
}

// Iniciar servidor
const server = spawn('node', ['server/index.js'], {
  cwd: path.join(__dirname, '..'),
  detached: true,
  stdio: 'inherit'
});

server.unref();

console.log('Iniciando servidor...');
