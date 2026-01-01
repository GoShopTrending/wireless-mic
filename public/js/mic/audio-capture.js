/**
 * Audio Capture para el Cliente Micrófono
 * Captura, procesa y transmite audio del micrófono del dispositivo
 */
class AudioCapture {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.analyser = null;
    this.processorNode = null;
    this.outputStream = null;
    this.initialized = false;
    this.capturing = false;

    // Configuración
    this.volume = 1.0;
    this.muted = false;
  }

  /**
   * Solicita permisos y captura el micrófono
   */
  async init() {
    if (this.initialized) return this.outputStream;

    try {
      // Solicitar acceso al micrófono
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });

      // Crear contexto de audio
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Crear nodos
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Ganancia para control de volumen
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;

      // Analizador para VU meter
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Destino para crear stream de salida
      const destination = this.audioContext.createMediaStreamDestination();

      // Conectar cadena
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.gainNode.connect(destination);

      this.outputStream = destination.stream;
      this.initialized = true;
      this.capturing = true;

      console.log('[AudioCapture] Inicializado correctamente');

      return this.outputStream;
    } catch (error) {
      console.error('[AudioCapture] Error al inicializar:', error);

      if (error.name === 'NotAllowedError') {
        throw new Error('Permiso de micrófono denegado');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No se encontró ningún micrófono');
      } else {
        throw error;
      }
    }
  }

  /**
   * Resume el contexto de audio (necesario después de interacción de usuario)
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[AudioCapture] Contexto resumido');
    }
  }

  /**
   * Obtiene el stream de audio procesado
   */
  getStream() {
    return this.outputStream;
  }

  /**
   * Establece el volumen (0.0 - 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));

    if (this.gainNode && !this.muted) {
      this.gainNode.gain.setValueAtTime(
        this.volume,
        this.audioContext.currentTime
      );
    }
  }

  /**
   * Silencia/des-silencia el micrófono
   */
  setMuted(muted) {
    this.muted = muted;

    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        muted ? 0 : this.volume,
        this.audioContext.currentTime
      );
    }

    // También silenciar el stream original
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Obtiene el nivel de audio actual (para VU meter)
   * @returns {number} Nivel en dB (aproximado)
   */
  getLevel() {
    if (!this.analyser) return -Infinity;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calcular RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Convertir a dB (aproximado)
    const db = 20 * Math.log10(rms / 255);

    return isFinite(db) ? db : -Infinity;
  }

  /**
   * Obtiene el nivel como porcentaje (0-100)
   */
  getLevelPercent() {
    const db = this.getLevel();
    // Rango aproximado -60 a 0 dB
    return Math.max(0, Math.min(100, (db + 60) * (100 / 60)));
  }

  /**
   * Verifica si el micrófono está capturando
   */
  isCapturing() {
    return this.capturing && !this.muted;
  }

  /**
   * Verifica si está silenciado
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Pausa la captura (mantiene el stream pero lo silencia)
   */
  pause() {
    this.capturing = false;
    this.setMuted(true);
  }

  /**
   * Reanuda la captura
   */
  unpause() {
    this.capturing = true;
    this.setMuted(false);
  }

  /**
   * Toggle captura
   */
  toggle() {
    if (this.capturing) {
      this.pause();
    } else {
      this.unpause();
    }
    return this.capturing;
  }

  /**
   * Detiene la captura y libera recursos
   */
  stop() {
    // Detener tracks del stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Desconectar nodos
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    // Cerrar contexto
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.outputStream = null;
    this.initialized = false;
    this.capturing = false;

    console.log('[AudioCapture] Detenido');
  }

  /**
   * Destruye la instancia
   */
  destroy() {
    this.stop();
  }
}

// Instancia global
window.audioCapture = new AudioCapture();
