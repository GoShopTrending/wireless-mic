# 🎤 Wireless Mic

Convierte cualquier celular en un micrófono inalámbrico. Conexión via QR, streaming de audio en tiempo real con WebRTC.

## Características

- 📱 **Conexión via QR** - Escanea y conecta en segundos
- 🎙️ **Multi-micrófono** - Soporta 10+ micrófonos simultáneos
- ⚡ **Baja latencia** - Streaming WebRTC P2P (<150ms)
- 🎛️ **Control de audio** - Volumen individual, master, mute/solo
- 🎵 **Efectos** - EQ, Reverb, Echo
- 📲 **PWA** - Instalable en cualquier dispositivo

## Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 + CSS3 + Vanilla JS
- **Audio**: Web Audio API + WebRTC (simple-peer)
- **QR**: qrcode + html5-qrcode

## Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/GoShopTrending/wireless-mic.git
cd wireless-mic

# Instalar dependencias
npm install

# Copiar configuración
cp .env.example .env

# Iniciar servidor
npm run dev
```

## URLs

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/host` | Crear sala (receptor de audio) |
| `/mic` | Conectar como micrófono |

## Deploy

### Render.com (Recomendado)

1. Conecta tu repositorio de GitHub
2. Render detectará automáticamente el `render.yaml`
3. Deploy automático en cada push

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | 3000 |
| `HOST` | Host del servidor | 0.0.0.0 |
| `NODE_ENV` | Entorno | development |
| `BASE_URL` | URL pública | http://localhost:3000 |

## Uso

1. **Host** abre `/host` → Se genera código QR
2. **Micrófonos** escanean el QR → Se conectan automáticamente
3. **Audio** fluye en tiempo real del micrófono al host
4. **Host** controla volumen, efectos, mute de cada micrófono

## Arquitectura

```
[Mic 1] ──┐
[Mic 2] ──┼── WebSocket ──► [Server] ◄── WebSocket ── [HOST]
[Mic N] ──┘   (signaling)
     │                                              │
     └──────────── WebRTC P2P (audio) ──────────────┘
```

## Licencia

MIT
