/**
 * Room Manager para el Host
 * Gestiona la sala, micrófonos conectados y WebRTC
 */
class RoomManager {
  constructor() {
    this.roomId = null;
    this.roomName = null;
    this.qrDataUrl = null;
    this.roomUrl = null;
    this.mics = new Map(); // micId -> mic info + peer
    this.onMicJoined = null;
    this.onMicLeft = null;
    this.onMicStream = null;
    this.onMicUpdate = null;
  }

  /**
   * Crea una nueva sala
   */
  async createRoom(roomName = null) {
    try {
      await socketClient.connect();

      const response = await socketClient.sendWithCallback('create-room', { roomName });

      this.roomId = response.room.roomId;
      this.roomName = response.room.roomName;
      this.qrDataUrl = response.qr.dataUrl;
      this.roomUrl = response.qr.url;

      console.log('[RoomManager] Sala creada:', this.roomId);

      // Configurar listeners
      this.setupListeners();

      return {
        roomId: this.roomId,
        roomName: this.roomName,
        qrDataUrl: this.qrDataUrl,
        roomUrl: this.roomUrl
      };
    } catch (error) {
      console.error('[RoomManager] Error al crear sala:', error);
      throw error;
    }
  }

  /**
   * Configura los listeners de Socket.io
   */
  setupListeners() {
    // Un micrófono se unió
    socketClient.on('mic-joined', (data) => {
      console.log('[RoomManager] Mic joined:', data);

      const mic = {
        micId: data.micId,
        peerId: data.peerId,
        name: data.name,
        settings: data.settings,
        peer: null,
        stream: null,
        status: 'connecting'
      };

      this.mics.set(data.micId, mic);

      if (this.onMicJoined) {
        this.onMicJoined(mic);
      }

      // Iniciar conexión WebRTC
      this.initiateWebRTC(data.micId);
    });

    // Un micrófono se desconectó
    socketClient.on('mic-disconnected', (data) => {
      console.log('[RoomManager] Mic disconnected:', data);

      const mic = this.mics.get(data.micId);
      if (mic) {
        if (mic.peer) {
          mic.peer.destroy();
        }
        this.mics.delete(data.micId);

        if (this.onMicLeft) {
          this.onMicLeft(data);
        }
      }
    });

    // Señal WebRTC recibida
    socketClient.on('webrtc-signal', (data) => {
      const mic = this.mics.get(data.from);
      if (mic && mic.peer) {
        mic.peer.signal(data.signal);
      }
    });

    // Mic listo para WebRTC
    socketClient.on('mic-webrtc-ready', (data) => {
      console.log('[RoomManager] Mic WebRTC ready:', data.micId);
    });

    // Estado de WebRTC del mic
    socketClient.on('mic-webrtc-state', (data) => {
      const mic = this.mics.get(data.micId);
      if (mic) {
        mic.status = data.state;
        if (this.onMicUpdate) {
          this.onMicUpdate(mic);
        }
      }
    });

    // Nivel de audio del mic
    socketClient.on('mic-audio-level', (data) => {
      const mic = this.mics.get(data.micId);
      if (mic) {
        mic.audioLevel = data.level;
      }
    });

    // Volumen local del mic cambió
    socketClient.on('mic-local-volume', (data) => {
      const mic = this.mics.get(data.micId);
      if (mic) {
        mic.localVolume = data.volume;
        if (this.onMicUpdate) {
          this.onMicUpdate(mic);
        }
      }
    });

    // Estado de mute del mic
    socketClient.on('mic-mute-state', (data) => {
      const mic = this.mics.get(data.micId);
      if (mic) {
        mic.muted = data.muted;
        if (this.onMicUpdate) {
          this.onMicUpdate(mic);
        }
      }
    });

    // Latencia del mic
    socketClient.on('mic-latency', (data) => {
      const mic = this.mics.get(data.micId);
      if (mic) {
        mic.latency = data.latency;
        if (this.onMicUpdate) {
          this.onMicUpdate(mic);
        }
      }
    });

    // Sala cerrada
    socketClient.on('room-closed', (data) => {
      console.log('[RoomManager] Sala cerrada:', data.reason);
    });
  }

  /**
   * Inicia conexión WebRTC con un micrófono
   */
  initiateWebRTC(micId) {
    const mic = this.mics.get(micId);
    if (!mic) return;

    console.log('[RoomManager] Iniciando WebRTC con:', micId);

    // Crear peer (no iniciador, esperamos offer del mic)
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      socketClient.send('webrtc-signal', {
        to: micId,
        signal: signal,
        roomId: this.roomId
      });
    });

    peer.on('connect', () => {
      console.log('[RoomManager] WebRTC conectado con:', micId);
      mic.status = 'connected';
      if (this.onMicUpdate) {
        this.onMicUpdate(mic);
      }
    });

    peer.on('stream', (stream) => {
      console.log('[RoomManager] Stream recibido de:', micId);
      console.log('[RoomManager] Audio tracks:', stream.getAudioTracks().length);
      console.log('[RoomManager] Track enabled:', stream.getAudioTracks()[0]?.enabled);

      mic.stream = stream;
      mic.status = 'streaming';

      if (this.onMicStream) {
        this.onMicStream(micId, stream);
      }

      if (this.onMicUpdate) {
        this.onMicUpdate(mic);
      }
    });

    peer.on('error', (err) => {
      console.error('[RoomManager] WebRTC error con', micId, ':', err);
      mic.status = 'error';
      if (this.onMicUpdate) {
        this.onMicUpdate(mic);
      }
    });

    peer.on('close', () => {
      console.log('[RoomManager] WebRTC cerrado con:', micId);
      mic.status = 'disconnected';
      if (this.onMicUpdate) {
        this.onMicUpdate(mic);
      }
    });

    mic.peer = peer;

    // Notificar al mic que inicie la conexión
    socketClient.send('initiate-webrtc', {
      roomId: this.roomId,
      micId: micId
    });
  }

  /**
   * Establece volumen de un micrófono (desde host)
   */
  setMicVolume(micId, volume) {
    socketClient.send('host-set-mic-volume', {
      roomId: this.roomId,
      micId: micId,
      volume: volume
    });
  }

  /**
   * Silencia/des-silencia un micrófono (desde host)
   */
  muteMic(micId, muted) {
    socketClient.send('host-mute-mic', {
      roomId: this.roomId,
      micId: micId,
      muted: muted
    });
  }

  /**
   * Expulsa un micrófono
   */
  kickMic(micId) {
    socketClient.send('kick-mic', {
      roomId: this.roomId,
      micId: micId
    });
  }

  /**
   * Establece volumen master
   */
  setMasterVolume(volume) {
    socketClient.send('master-volume-change', {
      roomId: this.roomId,
      volume: volume
    });
  }

  /**
   * Establece efectos globales
   */
  setGlobalEffects(effects) {
    socketClient.send('global-effects-change', {
      roomId: this.roomId,
      effects: effects
    });
  }

  /**
   * Establece efectos de un micrófono específico
   */
  setMicEffects(micId, effects) {
    socketClient.send('mic-effects-change', {
      roomId: this.roomId,
      micId: micId,
      effects: effects
    });
  }

  /**
   * Envía señal de ducking a todos los micrófonos (anti-echo)
   * @param {boolean} ducking - true = reducir ganancia, false = restaurar
   */
  sendDuckingSignal(ducking) {
    socketClient.send('ducking-signal', {
      roomId: this.roomId,
      ducking: ducking
    });
  }

  /**
   * Obtiene lista de micrófonos
   */
  getMics() {
    return Array.from(this.mics.values());
  }

  /**
   * Obtiene un micrófono por ID
   */
  getMic(micId) {
    return this.mics.get(micId);
  }

  /**
   * Cierra la sala y desconecta todo
   */
  destroy() {
    // Cerrar todos los peers
    this.mics.forEach((mic, micId) => {
      if (mic.peer) {
        mic.peer.destroy();
      }
    });

    this.mics.clear();

    // Desconectar socket
    socketClient.disconnect();

    console.log('[RoomManager] Destruido');
  }
}

// Instancia global
window.roomManager = new RoomManager();
