/**
 * WebRTC Client para el Micrófono
 * Maneja la conexión P2P con el Host para transmitir audio
 */
class WebRTCClient {
  constructor() {
    this.peer = null;
    this.connected = false;
    this.hostId = null;
    this.roomId = null;
    this.stream = null;

    // Callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
  }

  /**
   * Configura los listeners de Socket.io para signaling
   */
  setupSignaling() {
    // Recibir señal del host para iniciar WebRTC
    socketClient.on('start-webrtc', (data) => {
      console.log('[WebRTC] Iniciando conexión con host:', data.hostId);
      this.hostId = data.hostId;
      this.createPeer(true);
    });

    // Recibir señales WebRTC del host
    socketClient.on('webrtc-signal', (data) => {
      if (this.peer && data.from === this.hostId) {
        this.peer.signal(data.signal);
      }
    });
  }

  /**
   * Establece el stream de audio a transmitir
   */
  setStream(stream) {
    this.stream = stream;
  }

  /**
   * Establece el room ID
   */
  setRoomId(roomId) {
    this.roomId = roomId;
  }

  /**
   * Crea la conexión peer
   */
  createPeer(initiator = true) {
    if (!this.stream) {
      console.error('[WebRTC] No hay stream de audio');
      return;
    }

    // Destruir peer anterior si existe
    if (this.peer) {
      this.peer.destroy();
    }

    console.log('[WebRTC] Creando peer, initiator:', initiator);

    this.peer = new SimplePeer({
      initiator: initiator,
      stream: this.stream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        // Forzar modo de transporte más directo
        iceCandidatePoolSize: 0
      },
      // Optimizaciones AGRESIVAS para baja latencia
      sdpTransform: (sdp) => {
        // Configurar Opus para mínima latencia:
        // - ptime=10: frames de 10ms (mínimo)
        // - maxptime=10: no permitir frames más grandes
        // - cbr=1: bitrate constante (menos procesamiento)
        // - useinbandfec=0: desactivar FEC (reduce latencia)
        // - usedtx=0: desactivar DTX (transmisión continua)
        sdp = sdp.replace(
          /useinbandfec=1/g,
          'useinbandfec=0; stereo=0; cbr=1; maxplaybackrate=48000; maxaveragebitrate=32000; ptime=10; maxptime=10; usedtx=0'
        );

        // Priorizar Opus sobre otros codecs
        const lines = sdp.split('\r\n');
        const audioLine = lines.findIndex(l => l.startsWith('m=audio'));
        if (audioLine > -1) {
          console.log('[WebRTC] SDP audio line:', lines[audioLine]);
        }

        return sdp;
      }
    });

    // Enviar señales al host
    this.peer.on('signal', (signal) => {
      socketClient.send('webrtc-signal', {
        to: this.hostId,
        signal: signal,
        roomId: this.roomId
      });
    });

    // Conexión establecida
    this.peer.on('connect', () => {
      console.log('[WebRTC] Conectado al host');
      this.connected = true;

      socketClient.send('webrtc-state', {
        roomId: this.roomId,
        state: 'connected'
      });

      if (this.onConnected) {
        this.onConnected();
      }

      // Iniciar medición de latencia
      this.startLatencyMeasurement();
    });

    // Error
    this.peer.on('error', (err) => {
      console.error('[WebRTC] Error:', err);
      this.connected = false;

      socketClient.send('webrtc-state', {
        roomId: this.roomId,
        state: 'error'
      });

      if (this.onError) {
        this.onError(err);
      }
    });

    // Conexión cerrada
    this.peer.on('close', () => {
      console.log('[WebRTC] Conexión cerrada');
      this.connected = false;

      socketClient.send('webrtc-state', {
        roomId: this.roomId,
        state: 'disconnected'
      });

      if (this.onDisconnected) {
        this.onDisconnected();
      }
    });

    // Notificar que estamos listos
    socketClient.send('webrtc-ready', {
      roomId: this.roomId
    });
  }

  /**
   * Inicia medición de latencia
   */
  startLatencyMeasurement() {
    // Medir latencia cada 5 segundos
    this.latencyInterval = setInterval(() => {
      if (!this.peer || !this.connected) return;

      const start = performance.now();

      // Enviar ping via data channel si está disponible
      try {
        this.peer.send(JSON.stringify({ type: 'ping', t: start }));
      } catch (e) {
        // Data channel no disponible, estimar basado en ICE
      }
    }, 5000);

    // Recibir pong
    if (this.peer) {
      this.peer.on('data', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'pong' && msg.t) {
            const latency = (performance.now() - msg.t) / 2;
            socketClient.send('latency-report', {
              roomId: this.roomId,
              latency: latency
            });
          }
        } catch (e) {
          // Ignorar mensajes no JSON
        }
      });
    }
  }

  /**
   * Actualiza el stream de audio
   */
  updateStream(newStream) {
    if (!this.peer) return;

    // Reemplazar tracks
    const sender = this.peer._pc?.getSenders().find(s => s.track?.kind === 'audio');
    if (sender && newStream.getAudioTracks().length > 0) {
      sender.replaceTrack(newStream.getAudioTracks()[0]);
      this.stream = newStream;
    }
  }

  /**
   * Verifica si está conectado
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Desconecta y limpia
   */
  disconnect() {
    if (this.latencyInterval) {
      clearInterval(this.latencyInterval);
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.connected = false;
    this.hostId = null;
  }

  /**
   * Destruye la instancia
   */
  destroy() {
    this.disconnect();
  }
}

// Instancia global
window.webrtcClient = new WebRTCClient();
