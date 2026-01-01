/**
 * Audio Mixer para el Host
 * Recibe, mezcla y reproduce audio de múltiples micrófonos
 */
class AudioMixer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.compressor = null;
    this.channels = new Map(); // micId -> channel info
    this.initialized = false;
    this.masterVolume = 1.0;

    // Efectos globales
    this.globalEffects = {
      reverb: 0,
      echo: 0,
      eqBass: 0,
      eqMid: 0,
      eqTreble: 0
    };

    // Ducking system (anti-echo)
    this.duckingEnabled = true;
    this.duckingThreshold = -35; // dB - cuando el audio supera esto, enviar ducking
    this.isDucking = false;
    this.duckingInterval = null;
    this.onDuckingChange = null; // callback para notificar al socket
    this.masterAnalyser = null;
  }

  /**
   * Inicializa el contexto de audio
   */
  async init() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Nodo de ganancia master
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;

      // Compresor para evitar distorsión
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Analizador master para detectar nivel de salida (ducking)
      this.masterAnalyser = this.audioContext.createAnalyser();
      this.masterAnalyser.fftSize = 256;
      this.masterAnalyser.smoothingTimeConstant = 0.5;

      // Conectar cadena master: masterGain -> compressor -> analyser -> destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.audioContext.destination);

      this.initialized = true;
      console.log('[AudioMixer] Inicializado');

      // Iniciar detección de ducking
      this.startDuckingDetection();
    } catch (error) {
      console.error('[AudioMixer] Error al inicializar:', error);
      throw error;
    }
  }

  /**
   * Inicia la detección de ducking (monitorea salida de audio)
   */
  startDuckingDetection() {
    if (this.duckingInterval) {
      clearInterval(this.duckingInterval);
    }

    this.duckingInterval = setInterval(() => {
      if (!this.duckingEnabled || !this.masterAnalyser) return;

      const level = this.getMasterLevel();
      const shouldDuck = level > this.duckingThreshold;

      if (shouldDuck !== this.isDucking) {
        this.isDucking = shouldDuck;
        console.log(`[AudioMixer] Ducking: ${shouldDuck ? 'ON' : 'OFF'} (level: ${level.toFixed(1)} dB)`);

        if (this.onDuckingChange) {
          this.onDuckingChange(shouldDuck);
        }
      }
    }, 50); // Check every 50ms
  }

  /**
   * Obtiene el nivel de audio master (salida)
   */
  getMasterLevel() {
    if (!this.masterAnalyser) return -Infinity;

    const dataArray = new Uint8Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const amplitude = (dataArray[i] - 128) / 128;
      sum += amplitude * amplitude;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const db = 20 * Math.log10(rms + 0.0001);

    return isFinite(db) ? db : -60;
  }

  /**
   * Habilita/deshabilita el sistema de ducking
   */
  setDuckingEnabled(enabled) {
    this.duckingEnabled = enabled;
    console.log('[AudioMixer] Ducking system:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Establece el umbral de ducking
   */
  setDuckingThreshold(thresholdDb) {
    this.duckingThreshold = thresholdDb;
    console.log('[AudioMixer] Ducking threshold:', thresholdDb, 'dB');
  }

  /**
   * Resume el contexto de audio (necesario después de interacción de usuario)
   */
  async resume() {
    if (this.audioContext) {
      console.log('[AudioMixer] Estado del contexto:', this.audioContext.state);
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('[AudioMixer] Contexto resumido, nuevo estado:', this.audioContext.state);
      }
    }
  }

  /**
   * Agrega un canal para un micrófono
   */
  addMicChannel(micId, stream) {
    if (!this.initialized) {
      console.error('[AudioMixer] No inicializado');
      return null;
    }

    if (this.channels.has(micId)) {
      console.warn('[AudioMixer] Canal ya existe para:', micId);
      return this.channels.get(micId);
    }

    try {
      // IMPORTANTE: Crear elemento de audio para reproducir el stream directamente
      // Esto es necesario para WebRTC en algunos navegadores
      const audioElement = new Audio();
      audioElement.srcObject = stream;
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.volume = 1.0;

      // Forzar reproducción
      audioElement.play().then(() => {
        console.log('[AudioMixer] Audio element reproduciendo para:', micId);
      }).catch(err => {
        console.error('[AudioMixer] Error reproduciendo audio element:', err);
      });

      // Crear source desde el stream para Web Audio API (efectos y VU meter)
      const source = this.audioContext.createMediaStreamSource(stream);

      // Nodo de ganancia individual
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0;

      // Panner para posicionamiento estéreo (opcional)
      const panner = this.audioContext.createStereoPanner();
      panner.pan.value = 0;

      // Analizador para VU meter
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // EQ por canal
      const lowShelf = this.audioContext.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 320;
      lowShelf.gain.value = 0;

      const midPeak = this.audioContext.createBiquadFilter();
      midPeak.type = 'peaking';
      midPeak.frequency.value = 1000;
      midPeak.Q.value = 0.5;
      midPeak.gain.value = 0;

      const highShelf = this.audioContext.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 3200;
      highShelf.gain.value = 0;

      // Conectar cadena para análisis (VU meter)
      source.connect(analyser);

      const channel = {
        audioElement,
        source,
        gainNode,
        panner,
        analyser,
        eq: { lowShelf, midPeak, highShelf },
        muted: false,
        solo: false,
        volume: 1.0
      };

      this.channels.set(micId, channel);
      console.log('[AudioMixer] Canal agregado para:', micId);

      return channel;
    } catch (error) {
      console.error('[AudioMixer] Error al agregar canal:', error);
      return null;
    }
  }

  /**
   * Elimina un canal de micrófono
   */
  removeMicChannel(micId) {
    const channel = this.channels.get(micId);
    if (!channel) return;

    try {
      // Detener y limpiar elemento de audio
      if (channel.audioElement) {
        channel.audioElement.pause();
        channel.audioElement.srcObject = null;
      }

      channel.source.disconnect();
      channel.analyser.disconnect();

      this.channels.delete(micId);
      console.log('[AudioMixer] Canal eliminado:', micId);
    } catch (error) {
      console.error('[AudioMixer] Error al eliminar canal:', error);
    }
  }

  /**
   * Establece el volumen de un micrófono
   */
  setMicVolume(micId, volume) {
    const channel = this.channels.get(micId);
    if (!channel) return;

    channel.volume = volume;

    // Usar audioElement para el volumen
    if (channel.audioElement && !channel.muted) {
      channel.audioElement.volume = volume;
    }
  }

  /**
   * Silencia/des-silencia un micrófono
   */
  setMicMuted(micId, muted) {
    const channel = this.channels.get(micId);
    if (!channel) return;

    channel.muted = muted;

    // Usar audioElement para mute
    if (channel.audioElement) {
      channel.audioElement.volume = muted ? 0 : channel.volume;
    }
  }

  /**
   * Solo un micrófono (silencia todos los demás)
   */
  setMicSolo(micId, solo) {
    const channel = this.channels.get(micId);
    if (!channel) return;

    channel.solo = solo;

    // Si hay algún solo activo, silenciar los no-solo
    const hasSolo = Array.from(this.channels.values()).some(ch => ch.solo);

    this.channels.forEach((ch, id) => {
      if (ch.audioElement) {
        if (hasSolo) {
          ch.audioElement.volume = ch.solo ? ch.volume : 0;
        } else {
          ch.audioElement.volume = ch.muted ? 0 : ch.volume;
        }
      }
    });
  }

  /**
   * Establece el volumen master
   */
  setMasterVolume(volume) {
    this.masterVolume = volume;

    // Aplicar a todos los canales
    this.channels.forEach((ch, id) => {
      if (ch.audioElement && !ch.muted) {
        ch.audioElement.volume = ch.volume * volume;
      }
    });
  }

  /**
   * Establece EQ de un micrófono
   */
  setMicEQ(micId, bass, mid, treble) {
    const channel = this.channels.get(micId);
    if (!channel) return;

    channel.eq.lowShelf.gain.setValueAtTime(bass, this.audioContext.currentTime);
    channel.eq.midPeak.gain.setValueAtTime(mid, this.audioContext.currentTime);
    channel.eq.highShelf.gain.setValueAtTime(treble, this.audioContext.currentTime);
  }

  /**
   * Obtiene el nivel de audio de un micrófono (para VU meter)
   */
  getMicLevel(micId) {
    const channel = this.channels.get(micId);
    if (!channel || !channel.analyser) return -Infinity;

    const dataArray = new Uint8Array(channel.analyser.frequencyBinCount);
    channel.analyser.getByteFrequencyData(dataArray);

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
   * Obtiene todos los niveles de audio
   */
  getAllLevels() {
    const levels = {};
    this.channels.forEach((channel, micId) => {
      levels[micId] = this.getMicLevel(micId);
    });
    return levels;
  }

  /**
   * Lista dispositivos de salida disponibles
   */
  async getOutputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audiooutput');
    } catch (error) {
      console.error('[AudioMixer] Error al obtener dispositivos:', error);
      return [];
    }
  }

  /**
   * Cambia el dispositivo de salida (si el navegador lo soporta)
   */
  async setOutputDevice(deviceId) {
    // Esto requiere un elemento <audio> o hack con setSinkId
    // Por ahora, el audio va al dispositivo por defecto
    console.log('[AudioMixer] Cambio de dispositivo no implementado aún');
  }

  /**
   * Destruye el mixer y libera recursos
   */
  destroy() {
    this.channels.forEach((channel, micId) => {
      this.removeMicChannel(micId);
    });

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.initialized = false;
    console.log('[AudioMixer] Destruido');
  }
}

// Instancia global
window.audioMixer = new AudioMixer();
