/**
 * Mic Main - Punto de entrada para la interfaz del Micrófono
 */
(function() {
  // Referencias DOM - Vista de conexión
  const connectView = document.getElementById('connect-view');
  const roomCodeInput = document.getElementById('room-code-input');
  const micNameInput = document.getElementById('mic-name-input');
  const connectBtn = document.getElementById('connect-btn');
  const startScannerBtn = document.getElementById('start-scanner-btn');
  const qrReader = document.getElementById('qr-reader');
  const connectError = document.getElementById('connect-error');

  // Referencias DOM - Vista del micrófono
  const micView = document.getElementById('mic-view');
  const micStatus = document.getElementById('mic-status');
  const connectedRoomName = document.getElementById('connected-room-name');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const micToggleBtn = document.getElementById('mic-toggle-btn');
  const micHint = document.getElementById('mic-hint');
  const vuMeterFill = document.getElementById('vu-meter-fill');
  const vuLabel = document.getElementById('vu-label');
  const localVolumeEl = document.getElementById('local-volume');
  const localVolumeValueEl = document.getElementById('local-volume-value');
  const muteToggle = document.getElementById('mute-toggle');
  const localReverbEl = document.getElementById('local-reverb');
  const localReverbValueEl = document.getElementById('local-reverb-value');
  const localEchoEl = document.getElementById('local-echo');
  const localEchoValueEl = document.getElementById('local-echo-value');
  const myNameEl = document.getElementById('my-name');

  // Noise Gate controls
  const noiseGateToggle = document.getElementById('noise-gate-toggle');
  const noiseGateThresholdEl = document.getElementById('noise-gate-threshold');
  const noiseGateThresholdValueEl = document.getElementById('noise-gate-threshold-value');
  const gateStatusIndicator = document.getElementById('gate-status-indicator');
  const gateStatusText = document.getElementById('gate-status-text');

  // Modales
  const permissionModal = document.getElementById('permission-modal');
  const grantPermissionBtn = document.getElementById('grant-permission-btn');
  const disconnectedModal = document.getElementById('disconnected-modal');
  const disconnectReason = document.getElementById('disconnect-reason');

  // Estado
  let qrScanner = null;
  let roomId = null;
  let micName = '';
  let micActive = false;
  let vuMeterInterval = null;

  /**
   * Inicializa la aplicación
   */
  function init() {
    // Verificar si hay room en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl) {
      roomCodeInput.value = roomFromUrl.toUpperCase();
    }

    // Event listeners
    setupEventListeners();

    // Configurar WebRTC signaling
    webrtcClient.setupSignaling();
  }

  /**
   * Configura event listeners
   */
  function setupEventListeners() {
    // Conectar manualmente
    connectBtn.addEventListener('click', handleConnect);

    // Permitir Enter en los inputs
    roomCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (!micNameInput.value) {
          micNameInput.focus();
        } else {
          handleConnect();
        }
      }
    });

    micNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleConnect();
    });

    // Formatear código de sala
    roomCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // Escáner QR
    startScannerBtn.addEventListener('click', toggleQRScanner);

    // Permiso de micrófono
    grantPermissionBtn.addEventListener('click', handlePermissionGrant);

    // Toggle micrófono
    micToggleBtn.addEventListener('click', handleMicToggle);

    // Desconectar
    disconnectBtn.addEventListener('click', handleDisconnect);

    // Volumen local
    localVolumeEl.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      localVolumeValueEl.textContent = `${e.target.value}%`;
      audioCapture.setVolume(volume);

      // Notificar al servidor
      socketClient.send('mic-volume-change', {
        roomId: roomId,
        volume: volume
      });
    });

    // Mute toggle
    muteToggle.addEventListener('change', (e) => {
      const muted = e.target.checked;
      audioCapture.setMuted(muted);
      updateMicButtonState();

      socketClient.send('mic-mute-toggle', {
        roomId: roomId,
        muted: muted
      });
    });

    // Efectos locales
    localReverbEl.addEventListener('input', (e) => {
      localReverbValueEl.textContent = `${e.target.value}%`;
      // Efectos se aplican en el Host, aquí solo notificamos preferencia
    });

    localEchoEl.addEventListener('input', (e) => {
      localEchoValueEl.textContent = `${e.target.value}%`;
    });

    // Noise Gate controls
    noiseGateToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      audioCapture.setNoiseGateEnabled(enabled);
      noiseGateThresholdEl.parentElement.style.opacity = enabled ? '1' : '0.5';
    });

    noiseGateThresholdEl.addEventListener('input', (e) => {
      const threshold = parseInt(e.target.value);
      noiseGateThresholdValueEl.textContent = `${threshold} dB`;
      audioCapture.setNoiseGateThreshold(threshold);
    });

    // Callback para actualizar UI del noise gate
    audioCapture.onNoiseGateChange = (isOpen) => {
      if (isOpen) {
        gateStatusIndicator.className = 'status-indicator connected';
        gateStatusText.textContent = 'Transmitiendo...';
      } else {
        gateStatusIndicator.className = 'status-indicator';
        gateStatusText.textContent = 'Gate cerrado';
      }
    };

    // Eventos del socket
    socketClient.on('room-closed', (data) => {
      showDisconnectedModal('El host cerró la sala');
    });

    socketClient.on('kicked', (data) => {
      showDisconnectedModal('Fuiste expulsado de la sala');
    });

    socketClient.on('host-mute-override', (data) => {
      if (data.muted !== undefined) {
        muteToggle.checked = data.muted;
        audioCapture.setMuted(data.muted);
        updateMicButtonState();
      }
    });

    socketClient.on('disconnected', (data) => {
      showDisconnectedModal('Se perdió la conexión');
    });

    // WebRTC callbacks
    webrtcClient.onConnected = () => {
      updateStatus('connected', 'Transmitiendo');
      micToggleBtn.classList.add('active');
      micActive = true;
      updateMicButtonState();
    };

    webrtcClient.onDisconnected = () => {
      updateStatus('disconnected', 'Desconectado');
    };

    webrtcClient.onError = (err) => {
      updateStatus('disconnected', 'Error de conexión');
      showError('Error en la conexión de audio');
    };
  }

  /**
   * Maneja la conexión a la sala
   */
  async function handleConnect() {
    const code = roomCodeInput.value.trim().toUpperCase();
    const name = micNameInput.value.trim() || 'Micrófono';

    if (!code || code.length < 4) {
      showError('Ingresa un código de sala válido');
      return;
    }

    roomId = code;
    micName = name;

    showError('');
    connectBtn.disabled = true;
    connectBtn.textContent = 'Conectando...';

    try {
      // Conectar socket
      await socketClient.connect();

      // Verificar que la sala existe
      socketClient.sendWithCallback('check-room', { roomId: code })
        .then(async (response) => {
          if (!response.exists) {
            showError('Sala no encontrada');
            resetConnectButton();
            return;
          }

          // Mostrar modal de permiso de micrófono
          permissionModal.classList.add('active');
        })
        .catch((err) => {
          showError('Error al verificar la sala');
          resetConnectButton();
        });

    } catch (error) {
      showError('Error de conexión');
      resetConnectButton();
    }
  }

  /**
   * Maneja el permiso de micrófono
   */
  async function handlePermissionGrant() {
    try {
      permissionModal.classList.remove('active');

      // Inicializar captura de audio
      const stream = await audioCapture.init();

      // Configurar WebRTC
      webrtcClient.setStream(stream);
      webrtcClient.setRoomId(roomId);

      // Unirse a la sala
      const response = await socketClient.sendWithCallback('join-room', {
        roomId: roomId,
        micName: micName
      });

      // Cambiar a vista de micrófono
      showMicView(response.room.roomName);

      // Iniciar VU meter
      startVUMeter();

    } catch (error) {
      console.error('[Mic] Error:', error);
      showError(error.message || 'Error al acceder al micrófono');
      permissionModal.classList.remove('active');
      resetConnectButton();
    }
  }

  /**
   * Toggle del micrófono
   */
  function handleMicToggle() {
    micActive = audioCapture.toggle();
    updateMicButtonState();

    socketClient.send('mic-mute-toggle', {
      roomId: roomId,
      muted: !micActive
    });
  }

  /**
   * Actualiza el estado visual del botón de micrófono
   */
  function updateMicButtonState() {
    const isMuted = audioCapture.isMuted();
    const isCapturing = audioCapture.isCapturing();

    micToggleBtn.classList.toggle('active', isCapturing && !isMuted);
    micToggleBtn.classList.toggle('muted', isMuted);

    if (isMuted) {
      micHint.textContent = 'Micrófono silenciado';
    } else if (isCapturing) {
      micHint.textContent = 'Transmitiendo audio...';
    } else {
      micHint.textContent = 'Toca para activar el micrófono';
    }
  }

  /**
   * Muestra la vista del micrófono
   */
  function showMicView(roomName) {
    connectView.classList.add('hidden');
    micView.classList.remove('hidden');

    connectedRoomName.textContent = roomName;
    myNameEl.textContent = micName;

    updateStatus('connecting', 'Conectando...');
  }

  /**
   * Actualiza el indicador de estado
   */
  function updateStatus(status, text) {
    micStatus.className = `status-indicator ${status}`;
    micStatus.innerHTML = `
      <span class="status-dot ${status === 'connecting' ? 'pulse' : ''}"></span>
      ${text}
    `;
  }

  /**
   * Inicia el VU meter
   */
  function startVUMeter() {
    vuMeterInterval = setInterval(() => {
      const level = audioCapture.getLevelPercent();
      const db = audioCapture.getLevel();

      vuMeterFill.style.width = `${level}%`;
      vuLabel.textContent = isFinite(db) ? `${db.toFixed(1)} dB` : '-∞ dB';

      // Enviar nivel al host (throttled)
      if (Math.random() < 0.2) { // Solo enviar 20% del tiempo
        socketClient.send('audio-level', {
          roomId: roomId,
          level: db
        });
      }
    }, 50);
  }

  /**
   * Desconecta de la sala
   */
  function handleDisconnect() {
    cleanup();
    window.location.href = '/';
  }

  /**
   * Muestra modal de desconexión
   */
  function showDisconnectedModal(reason) {
    cleanup();
    disconnectReason.textContent = reason;
    disconnectedModal.classList.add('active');
  }

  /**
   * Limpieza de recursos
   */
  function cleanup() {
    if (vuMeterInterval) {
      clearInterval(vuMeterInterval);
    }

    if (qrScanner) {
      qrScanner.stop();
    }

    webrtcClient.destroy();
    audioCapture.destroy();
    socketClient.disconnect();
  }

  /**
   * Toggle escáner QR
   */
  async function toggleQRScanner() {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner = null;
      qrReader.innerHTML = '';
      startScannerBtn.textContent = '📷 Abrir Cámara';
      return;
    }

    try {
      qrScanner = new Html5Qrcode('qr-reader');

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          // Extraer room ID de la URL
          try {
            const url = new URL(decodedText);
            const room = url.searchParams.get('room');
            if (room) {
              roomCodeInput.value = room.toUpperCase();
              qrScanner.stop();
              qrScanner = null;
              qrReader.innerHTML = '<p style="text-align:center;padding:20px;">✓ Código detectado</p>';
              startScannerBtn.textContent = '📷 Abrir Cámara';

              // Auto-focus en nombre
              micNameInput.focus();
            }
          } catch (e) {
            // No es una URL válida
          }
        },
        (error) => {
          // Ignorar errores de escaneo continuo
        }
      );

      startScannerBtn.textContent = '✕ Cerrar Cámara';
    } catch (error) {
      console.error('[QR] Error:', error);
      showError('No se pudo acceder a la cámara');
    }
  }

  /**
   * Muestra error
   */
  function showError(message) {
    connectError.textContent = message;
  }

  /**
   * Resetea el botón de conectar
   */
  function resetConnectButton() {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Conectar';
  }

  /**
   * Limpieza al salir
   */
  window.addEventListener('beforeunload', cleanup);

  // Iniciar
  init();
})();
