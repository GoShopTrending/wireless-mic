/**
 * Host Main - Punto de entrada para la interfaz del Host
 */
(function() {
  // Referencias DOM
  const roomNameEl = document.getElementById('room-name');
  const connectionStatusEl = document.getElementById('connection-status');
  const qrImageEl = document.getElementById('qr-image');
  const qrUrlEl = document.getElementById('qr-url');
  const qrSectionEl = document.getElementById('qr-section');
  const micsListEl = document.getElementById('mics-list');
  const noMicsEl = document.getElementById('no-mics');
  const micCountEl = document.getElementById('mic-count');
  const masterVolumeEl = document.getElementById('master-volume');
  const masterVolumeValueEl = document.getElementById('master-volume-value');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const toggleQrBtn = document.getElementById('toggle-qr-btn');
  const muteAllBtn = document.getElementById('mute-all-btn');
  const effectsBtn = document.getElementById('effects-btn');
  const effectsModal = document.getElementById('effects-modal');
  const closeEffectsBtn = document.getElementById('close-effects-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const audioOutputSelect = document.getElementById('audio-output-select');

  // Estado
  let allMuted = false;
  let vuMeterInterval = null;

  /**
   * Inicializa la aplicación
   */
  async function init() {
    try {
      // Inicializar audio mixer
      await audioMixer.init();

      // Crear sala
      updateStatus('connecting', 'Creando sala...');
      const room = await roomManager.createRoom();

      // Mostrar información de la sala
      roomNameEl.textContent = room.roomName;
      qrImageEl.src = room.qrDataUrl;
      qrUrlEl.textContent = room.roomUrl;

      updateStatus('connected', 'Sala activa');

      // Configurar callbacks del room manager
      setupRoomCallbacks();

      // Configurar event listeners
      setupEventListeners();

      // Iniciar VU meters
      startVUMeters();

      // Cargar dispositivos de audio
      loadAudioDevices();

      // Resumir audio context en primera interacción
      document.body.addEventListener('click', async () => {
        await audioMixer.resume();
      }, { once: true });

    } catch (error) {
      console.error('[Host] Error al inicializar:', error);
      updateStatus('disconnected', 'Error de conexión');
    }
  }

  /**
   * Actualiza el indicador de estado
   */
  function updateStatus(status, text) {
    connectionStatusEl.className = `status-indicator ${status}`;
    connectionStatusEl.innerHTML = `
      <span class="status-dot ${status === 'connecting' ? 'pulse' : ''}"></span>
      ${text}
    `;
  }

  /**
   * Configura callbacks del RoomManager
   */
  function setupRoomCallbacks() {
    // Cuando un micrófono se une
    roomManager.onMicJoined = (mic) => {
      addMicCard(mic);
      updateMicCount();
    };

    // Cuando un micrófono se va
    roomManager.onMicLeft = (data) => {
      removeMicCard(data.micId);
      audioMixer.removeMicChannel(data.micId);
      updateMicCount();
    };

    // Cuando recibimos stream de audio
    roomManager.onMicStream = (micId, stream) => {
      audioMixer.addMicChannel(micId, stream);
    };

    // Cuando se actualiza un micrófono
    roomManager.onMicUpdate = (mic) => {
      updateMicCard(mic);
    };
  }

  /**
   * Agrega una tarjeta de micrófono al DOM
   */
  function addMicCard(mic) {
    // Ocultar mensaje de "sin micrófonos"
    noMicsEl.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'mic-card fade-in';
    card.id = `mic-${mic.micId}`;
    card.innerHTML = `
      <div class="mic-avatar">🎤</div>
      <div class="mic-info">
        <div class="mic-name">${escapeHtml(mic.name)}</div>
        <div class="mic-details">
          <span class="mic-status-text">Conectando...</span>
          <span class="latency-badge" style="display:none">-- ms</span>
        </div>
        <div class="vu-meter">
          <div class="vu-meter-fill" style="width: 0%"></div>
        </div>
      </div>
      <div class="mic-controls">
        <input type="range" class="mic-volume-slider" min="0" max="100" value="100" title="Volumen">
        <button class="mic-btn mute-btn" title="Silenciar">🔊</button>
        <button class="mic-btn solo-btn" title="Solo">S</button>
        <button class="mic-btn kick-btn" title="Expulsar">✕</button>
      </div>
    `;

    // Event listeners para controles
    const volumeSlider = card.querySelector('.mic-volume-slider');
    const muteBtn = card.querySelector('.mute-btn');
    const soloBtn = card.querySelector('.solo-btn');
    const kickBtn = card.querySelector('.kick-btn');

    volumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      audioMixer.setMicVolume(mic.micId, volume);
      roomManager.setMicVolume(mic.micId, volume);
    });

    muteBtn.addEventListener('click', () => {
      const isMuted = muteBtn.classList.toggle('muted');
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
      audioMixer.setMicMuted(mic.micId, isMuted);
      roomManager.muteMic(mic.micId, isMuted);
      card.classList.toggle('muted', isMuted);
    });

    soloBtn.addEventListener('click', () => {
      const isSolo = soloBtn.classList.toggle('active');
      audioMixer.setMicSolo(mic.micId, isSolo);
    });

    kickBtn.addEventListener('click', () => {
      if (confirm(`¿Expulsar a ${mic.name}?`)) {
        roomManager.kickMic(mic.micId);
      }
    });

    micsListEl.appendChild(card);
  }

  /**
   * Elimina una tarjeta de micrófono
   */
  function removeMicCard(micId) {
    const card = document.getElementById(`mic-${micId}`);
    if (card) {
      card.remove();
    }

    // Mostrar mensaje si no hay micrófonos
    if (roomManager.getMics().length === 0) {
      noMicsEl.style.display = 'block';
    }
  }

  /**
   * Actualiza una tarjeta de micrófono
   */
  function updateMicCard(mic) {
    const card = document.getElementById(`mic-${mic.micId}`);
    if (!card) return;

    const statusText = card.querySelector('.mic-status-text');
    const latencyBadge = card.querySelector('.latency-badge');

    // Actualizar estado
    const statusMap = {
      'connecting': 'Conectando...',
      'connected': 'Conectado',
      'streaming': 'Transmitiendo',
      'error': 'Error',
      'disconnected': 'Desconectado'
    };
    statusText.textContent = statusMap[mic.status] || mic.status;

    // Actualizar latencia
    if (mic.latency !== undefined) {
      latencyBadge.style.display = 'inline';
      latencyBadge.textContent = `${Math.round(mic.latency)} ms`;
      latencyBadge.className = 'latency-badge ' +
        (mic.latency < 80 ? 'good' : mic.latency < 150 ? 'medium' : 'poor');
    }
  }

  /**
   * Actualiza el contador de micrófonos
   */
  function updateMicCount() {
    micCountEl.textContent = roomManager.getMics().length;
  }

  /**
   * Configura event listeners
   */
  function setupEventListeners() {
    // Copiar link
    copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(roomManager.roomUrl);
        copyLinkBtn.textContent = '¡Copiado!';
        setTimeout(() => {
          copyLinkBtn.textContent = 'Copiar Link';
        }, 2000);
      } catch (e) {
        console.error('Error al copiar:', e);
      }
    });

    // Toggle QR
    toggleQrBtn.addEventListener('click', () => {
      qrSectionEl.classList.toggle('collapsed');
    });

    // Volumen master
    masterVolumeEl.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      masterVolumeValueEl.textContent = `${e.target.value}%`;
      audioMixer.setMasterVolume(volume);
      roomManager.setMasterVolume(volume);
    });

    // Silenciar todos
    muteAllBtn.addEventListener('click', () => {
      allMuted = !allMuted;
      muteAllBtn.textContent = allMuted ? '🔊 Activar Todos' : '🔇 Silenciar Todos';

      roomManager.getMics().forEach(mic => {
        audioMixer.setMicMuted(mic.micId, allMuted);
        roomManager.muteMic(mic.micId, allMuted);

        const card = document.getElementById(`mic-${mic.micId}`);
        if (card) {
          const muteBtn = card.querySelector('.mute-btn');
          muteBtn.classList.toggle('muted', allMuted);
          muteBtn.textContent = allMuted ? '🔇' : '🔊';
          card.classList.toggle('muted', allMuted);
        }
      });
    });

    // Abrir modal de efectos
    effectsBtn.addEventListener('click', () => {
      effectsModal.classList.add('active');
    });

    closeEffectsBtn.addEventListener('click', () => {
      effectsModal.classList.remove('active');
    });

    // Sliders de efectos
    setupEffectsSliders();

    // Abrir modal de configuración
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('active');
    });

    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });

    // Cerrar modales al hacer click fuera
    [effectsModal, settingsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  /**
   * Configura los sliders de efectos
   */
  function setupEffectsSliders() {
    const effects = {
      reverb: { slider: 'reverb-slider', value: 'reverb-value', suffix: '%' },
      echo: { slider: 'echo-slider', value: 'echo-value', suffix: '%' },
      bass: { slider: 'bass-slider', value: 'bass-value', suffix: ' dB' },
      mid: { slider: 'mid-slider', value: 'mid-value', suffix: ' dB' },
      treble: { slider: 'treble-slider', value: 'treble-value', suffix: ' dB' }
    };

    Object.entries(effects).forEach(([name, config]) => {
      const slider = document.getElementById(config.slider);
      const valueEl = document.getElementById(config.value);

      slider.addEventListener('input', (e) => {
        valueEl.textContent = e.target.value + config.suffix;

        // Aplicar efectos globales
        const globalEffects = {
          reverb: parseInt(document.getElementById('reverb-slider').value) / 100,
          echo: parseInt(document.getElementById('echo-slider').value) / 100,
          eqBass: parseInt(document.getElementById('bass-slider').value),
          eqMid: parseInt(document.getElementById('mid-slider').value),
          eqTreble: parseInt(document.getElementById('treble-slider').value)
        };

        roomManager.setGlobalEffects(globalEffects);

        // Aplicar EQ a todos los canales
        roomManager.getMics().forEach(mic => {
          audioMixer.setMicEQ(
            mic.micId,
            globalEffects.eqBass,
            globalEffects.eqMid,
            globalEffects.eqTreble
          );
        });
      });
    });
  }

  /**
   * Inicia actualización de VU meters
   */
  function startVUMeters() {
    vuMeterInterval = setInterval(() => {
      const levels = audioMixer.getAllLevels();

      Object.entries(levels).forEach(([micId, level]) => {
        const card = document.getElementById(`mic-${micId}`);
        if (!card) return;

        const vuFill = card.querySelector('.vu-meter-fill');
        if (!vuFill) return;

        // Convertir dB a porcentaje (rango aproximado -60 a 0 dB)
        const percent = Math.max(0, Math.min(100, (level + 60) * (100 / 60)));
        vuFill.style.width = `${percent}%`;
      });
    }, 50);
  }

  /**
   * Carga dispositivos de audio disponibles
   */
  async function loadAudioDevices() {
    try {
      const devices = await audioMixer.getOutputDevices();

      audioOutputSelect.innerHTML = '<option value="default">Dispositivo por defecto</option>';

      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`;
        audioOutputSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error al cargar dispositivos:', error);
    }
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Limpieza al salir
   */
  window.addEventListener('beforeunload', () => {
    if (vuMeterInterval) {
      clearInterval(vuMeterInterval);
    }
    roomManager.destroy();
    audioMixer.destroy();
  });

  // Iniciar
  init();
})();
