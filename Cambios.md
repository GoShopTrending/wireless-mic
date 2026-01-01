# Registro de Cambios

---

## v0.2.0 - 2026-01-01

### Rediseño Visual - Estilo Impostor/Liga

**Paleta de Colores**:
- Fondo base: `#0f172a` (slate-900)
- Fondo primario: `#1e293b` (slate-800)
- Fondo secundario: `#334155` (slate-700)
- Color accent: `#06b6d4` (cyan-500)
- Éxito: `#22c55e` (green-500)
- Peligro: `#ef4444` (red-500)

**Animaciones Implementadas**:
- `float` - Movimiento vertical suave (iconos)
- `glow` - Cambio de opacidad (estados activos)
- `slideUp` - Entrada desde abajo (componentes)
- `pulse-ring` - Anillo expansivo (botón micrófono activo)

**Componentes Rediseñados**:
- Botones con gradientes y sombras coloreadas
- Cards con efecto glow en hover
- Inputs con borde cyan al focus
- Modales con backdrop blur
- Toggle switches con animación suave
- VU meters con gradiente verde→amarillo→rojo
- Big mic button con animación de pulso cuando activo

**Archivos Modificados**:
- `public/css/styles.css` - CSS principal rediseñado completamente
- `public/index.html` - Nueva landing con animaciones
- `public/host.html` - Interfaz host con nuevo diseño
- `public/mic.html` - Interfaz micrófono con nuevo diseño
- Eliminados: `host.css`, `mic.css` (consolidado en styles.css)

---

## v0.1.0 - 2026-01-01

### MVP Completo - Wireless Microphone PWA

**Arquitectura Implementada**:
- Arquitectura híbrida WebSocket + WebRTC P2P
- Servidor Node.js con Express y Socket.io
- Streaming de audio en tiempo real con baja latencia (<150ms)

**Backend**:
- `server/index.js` - Entry point con Express + Socket.io
- `server/socket/handlers/room.handler.js` - Gestión de salas
- `server/socket/handlers/signaling.handler.js` - WebRTC signaling
- `server/socket/handlers/audio.handler.js` - Control de audio
- `server/services/room.service.js` - Gestión de salas en memoria
- `server/services/qr.service.js` - Generación de códigos QR

**Frontend Host**:
- `public/host.html` - Interfaz del receptor
- `public/js/host/audio-mixer.js` - Mezclador de audio multi-canal
- `public/js/host/room-manager.js` - Gestión de sala y WebRTC
- `public/js/host/main.js` - Lógica principal del host

**Frontend Micrófono**:
- `public/mic.html` - Interfaz del micrófono
- `public/js/mic/audio-capture.js` - Captura de audio del dispositivo
- `public/js/mic/webrtc-client.js` - Cliente WebRTC
- `public/js/mic/main.js` - Lógica principal del micrófono

**Features**:
- Conexión via código QR
- Soporte para 10+ micrófonos simultáneos
- Control de volumen individual y master
- VU meters en tiempo real
- Mute/Solo por canal
- EQ de 3 bandas (Bass, Mid, Treble)
- Panel de efectos (Reverb, Echo)
- PWA instalable

**Dependencias**:
- express: ^4.18.2
- socket.io: ^4.7.2
- qrcode: ^1.5.3
- uuid: ^9.0.0
- cors: ^2.8.5
- dotenv: ^16.3.1

---

## v0.0.1 - 2026-01-01

### Inicialización del Proyecto
- Creación de estructura de documentación
- Archivos: Instrucciones.md, Pendientes.md, Cambios.md
