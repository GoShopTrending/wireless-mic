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
    this.noiseGateNode = null;
    this.analyser = null;
    this.processorNode = null;
    this.outputStream = null;
    this.initialized = false;
    this.capturing = false;

    // Configuración
    this.volume = 1.0;
    this.muted = false;

    // Noise Gate configuration
    this.noiseGateEnabled = true;
    this.noiseGateThreshold = -45; // dB threshold (ajustable)
    this.noiseGateOpen = false;
    this.noiseGateAttack = 0.01; // seconds
    this.noiseGateRelease = 0.15; // seconds
    this.noiseGateHold = 0.1; // seconds to hold open after speech
    this.noiseGateHoldTimeout = null;
    this.onNoiseGateChange = null; // callback for UI updates

    // Ducking configuration (anti-echo from host)
    this.duckingActive = false;
    this.duckingAmount = 0.3; // Reduce to 30% when ducking
    this.duckingNode = null;
    this.onDuckingChange = null; // callback for UI updates
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

      // Noise Gate node (ganancia controlada por nivel de audio)
      this.noiseGateNode = this.audioContext.createGain();
      this.noiseGateNode.gain.value = this.noiseGateEnabled ? 0 : 1;

      // Ducking node (reduce ganancia cuando el host está reproduciendo audio)
      this.duckingNode = this.audioContext.createGain();
      this.duckingNode.gain.value = 1.0;

      // Analizador para VU meter y noise gate
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      // Destino para crear stream de salida
      const destination = this.audioContext.createMediaStreamDestination();

      // Conectar cadena: source -> gain -> analyser -> noiseGate -> ducking -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.noiseGateNode);
      this.noiseGateNode.connect(this.duckingNode);
      this.duckingNode.connect(destination);

      this.outputStream = destination.stream;
      this.initialized = true;
      this.capturing = true;

      // Iniciar procesamiento de noise gate
      if (this.noiseGateEnabled) {
        this.startNoiseGateProcessing();
      }

      console.log('[AudioCapture] Inicializado con Noise Gate');

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
   * Inicia el procesamiento del noise gate
   */
  startNoiseGateProcessing() {
    if (this.noiseGateInterval) {
      clearInterval(this.noiseGateInterval);
    }

    let logCounter = 0;

    this.noiseGateInterval = setInterval(() => {
      if (!this.noiseGateEnabled || !this.analyser || this.muted) return;

      const level = this.getLevel();
      const shouldOpen = level > this.noiseGateThreshold;

      // Log cada 500ms para debug
      logCounter++;
      if (logCounter >= 25) {
        console.log(`[NoiseGate] Level: ${level.toFixed(1)} dB, Threshold: ${this.noiseGateThreshold} dB, Open: ${this.noiseGateOpen}`);
        logCounter = 0;
      }

      if (shouldOpen) {
        // Abrir gate
        if (!this.noiseGateOpen) {
          this.noiseGateOpen = true;
          this.noiseGateNode.gain.setTargetAtTime(
            1,
            this.audioContext.currentTime,
            this.noiseGateAttack
          );
          console.log('[NoiseGate] ABIERTO - Transmitiendo');
          if (this.onNoiseGateChange) this.onNoiseGateChange(true);
        }

        // Reset hold timeout
        if (this.noiseGateHoldTimeout) {
          clearTimeout(this.noiseGateHoldTimeout);
          this.noiseGateHoldTimeout = null;
        }
      } else if (this.noiseGateOpen && !this.noiseGateHoldTimeout) {
        // Iniciar hold timeout antes de cerrar
        this.noiseGateHoldTimeout = setTimeout(() => {
          this.noiseGateOpen = false;
          this.noiseGateNode.gain.setTargetAtTime(
            0,
            this.audioContext.currentTime,
            this.noiseGateRelease
          );
          console.log('[NoiseGate] CERRADO');
          if (this.onNoiseGateChange) this.onNoiseGateChange(false);
          this.noiseGateHoldTimeout = null;
        }, this.noiseGateHold * 1000);
      }
    }, 20); // Check every 20ms
  }

  /**
   * Detiene el procesamiento del noise gate
   */
  stopNoiseGateProcessing() {
    if (this.noiseGateInterval) {
      clearInterval(this.noiseGateInterval);
      this.noiseGateInterval = null;
    }
    if (this.noiseGateHoldTimeout) {
      clearTimeout(this.noiseGateHoldTimeout);
      this.noiseGateHoldTimeout = null;
    }
  }

  /**
   * Habilita/deshabilita el noise gate
   */
  setNoiseGateEnabled(enabled) {
    this.noiseGateEnabled = enabled;

    if (this.noiseGateNode) {
      if (enabled) {
        this.noiseGateNode.gain.value = 0;
        this.noiseGateOpen = false;
        this.startNoiseGateProcessing();
      } else {
        this.stopNoiseGateProcessing();
        this.noiseGateNode.gain.value = 1;
        this.noiseGateOpen = true;
      }
    }

    console.log('[AudioCapture] Noise Gate:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Establece el umbral del noise gate en dB
   */
  setNoiseGateThreshold(thresholdDb) {
    this.noiseGateThreshold = thresholdDb;
    console.log('[AudioCapture] Noise Gate Threshold:', thresholdDb, 'dB');
  }

  /**
   * Obtiene si el noise gate está abierto (transmitiendo)
   */
  isNoiseGateOpen() {
    return this.noiseGateOpen;
  }

  /**
   * Aplica ducking (reduce ganancia cuando el host reproduce audio)
   * @param {boolean} active - true = reducir ganancia, false = restaurar
   */
  applyDucking(active) {
    if (!this.duckingNode || !this.audioContext) return;

    this.duckingActive = active;
    const targetGain = active ? this.duckingAmount : 1.0;

    // Transición suave
    this.duckingNode.gain.setTargetAtTime(
      targetGain,
      this.audioContext.currentTime,
      active ? 0.02 : 0.1 // Rápido al ducking, lento al restaurar
    );

    console.log(`[AudioCapture] Ducking: ${active ? 'ON (30%)' : 'OFF (100%)'}`);

    if (this.onDuckingChange) {
      this.onDuckingChange(active);
    }
  }

  /**
   * Establece la cantidad de reducción del ducking (0.0 - 1.0)
   */
  setDuckingAmount(amount) {
    this.duckingAmount = Math.max(0, Math.min(1, amount));
    console.log('[AudioCapture] Ducking amount:', this.duckingAmount);
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

    // Usar getByteTimeDomainData para mejor detección de amplitud
    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(dataArray);

    // Calcular RMS desde la forma de onda (valores centrados en 128)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const amplitude = (dataArray[i] - 128) / 128; // Normalizar a -1 a 1
      sum += amplitude * amplitude;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Convertir a dB
    const db = 20 * Math.log10(rms + 0.0001); // +0.0001 para evitar log(0)

    return isFinite(db) ? db : -60;
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
    // Detener noise gate processing
    this.stopNoiseGateProcessing();

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

    if (this.noiseGateNode) {
      this.noiseGateNode.disconnect();
      this.noiseGateNode = null;
    }

    if (this.duckingNode) {
      this.duckingNode.disconnect();
      this.duckingNode = null;
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
