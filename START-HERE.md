# Wireless Microphone PWA - Punto de Partida

## Metadata

| Campo | Valor |
|-------|-------|
| **Proyecto** | Wireless Microphone PWA |
| **Puerto** | Ver .env (default 3000) |
| **Base de Datos** | N/A - Sin BD |
| **Stack** | Node.js + Express + Socket.IO + Web Audio API + WebRTC |
| **Version** | 0.2.4 (ver package.json + version.json) |
| **Repositorio** | GitHub (usar `bash C:/Users/cisra/scripts/git-push.sh`) |

## Descripcion

App PWA de microfono inalambrico multi-dispositivo con conexion QR. Permite usar un telefono como microfono inalambrico conectandose a otro dispositivo via codigo QR. Audio en ultra baja latencia usando Web Audio API directo (sin HTML Audio element).

---

## Arranque

```bash
npm run status
npm run dev
```

**URLs del sistema**:
- Host: http://localhost:{PORT}/host
- Mic: http://localhost:{PORT}/mic

---

## Arquitectura

```
[Telefono (Mic)] --WebRTC/Socket.IO--> [Express :PORT] --Audio--> [PC (Host/Speaker)]
```

---

## Estructura de Archivos Clave

| Archivo | Descripcion |
|---------|-------------|
| `server/index.js` | Servidor Express + Socket.IO |
| `public/` | Frontend PWA (host y mic views) |
| `scripts/start-server.js` | Script de inicio con PID |
| `scripts/stop-server.js` | Detener servidor |
| `scripts/status-server.js` | Estado del servidor |
| `package.json` | Dependencias y scripts |
| `version.json` | Version + changelog |
| `render.yaml` | Configuracion para deploy en Render |

---

## Respaldo de Base de Datos

- **Tipo**: N/A (sin base de datos)

---

## Documentacion de Seguimiento

| Archivo | Proposito |
|---------|-----------|
| `Pendientes.md` | Tareas activas (historico archivado en BD project-manager-dashboard) |
| `Instrucciones.md` | Ultimas instrucciones del usuario (historico en BD) |
| `version.json` | Changelog (ultimas versiones, historico en BD) |

### Proceso al recibir instruccion:
1. Registrar en `Instrucciones.md` (texto literal)
2. Registrar en `Pendientes.md` (plan de accion + estado)
3. Implementar cambios
4. Actualizar version en `package.json` + `version.json`
5. Marcar como completada en `Pendientes.md`

### Archivo historico:
Las secciones completadas se archivan automaticamente en BD. Consultar en: http://localhost:4000/doc-archive.html

---

## Comandos de Referencia

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Iniciar servidor desarrollo |
| `npm run stop` | Detener servidor (usa PID guardado) |
| `npm run status` | Ver estado del servidor |
