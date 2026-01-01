const fs = require('fs');
const path = require('path');

const pidFile = path.join(__dirname, '..', '.server-pid.json');

if (!fs.existsSync(pidFile)) {
  console.log('No hay servidor corriendo (archivo PID no encontrado)');
  process.exit(0);
}

try {
  const data = JSON.parse(fs.readFileSync(pidFile, 'utf8'));

  try {
    process.kill(data.pid, 'SIGTERM');
    console.log(`Servidor detenido (PID: ${data.pid})`);
  } catch (e) {
    console.log('El servidor ya no estaba corriendo');
  }

  fs.unlinkSync(pidFile);
} catch (e) {
  console.error('Error al detener servidor:', e.message);
}
