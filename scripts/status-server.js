const fs = require('fs');
const path = require('path');

const pidFile = path.join(__dirname, '..', '.server-pid.json');

if (!fs.existsSync(pidFile)) {
  console.log('Estado: DETENIDO');
  console.log('No hay servidor corriendo');
  process.exit(0);
}

try {
  const data = JSON.parse(fs.readFileSync(pidFile, 'utf8'));

  try {
    process.kill(data.pid, 0);
    console.log('Estado: CORRIENDO');
    console.log(`PID: ${data.pid}`);
    console.log(`Puerto: ${data.port || 3000}`);
    console.log(`URL: http://localhost:${data.port || 3000}`);
    console.log(`Iniciado: ${data.startedAt || 'desconocido'}`);
  } catch (e) {
    console.log('Estado: DETENIDO (proceso no encontrado)');
    fs.unlinkSync(pidFile);
  }
} catch (e) {
  console.error('Error al leer estado:', e.message);
}
