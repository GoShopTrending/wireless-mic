/**
 * Socket Client Wrapper
 * Maneja la conexión WebSocket con el servidor
 */
class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomId = null;
    this.role = null; // 'host' o 'mic'
    this.listeners = new Map();
  }

  /**
   * Conecta al servidor Socket.io
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket && this.connected) {
        resolve(this.socket);
        return;
      }

      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Conectado:', this.socket.id);
        this.connected = true;
        resolve(this.socket);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Desconectado:', reason);
        this.connected = false;
        this.emit('disconnected', { reason });
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Error de conexión:', error);
        reject(error);
      });

      // Timeout de conexión
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Timeout de conexión'));
        }
      }, 10000);
    });
  }

  /**
   * Desconecta del servidor
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.roomId = null;
    }
  }

  /**
   * Emite un evento al servidor
   */
  send(event, data) {
    if (!this.socket || !this.connected) {
      console.warn('[Socket] No conectado, no se puede enviar:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Emite un evento y espera respuesta (callback)
   */
  sendWithCallback(event, data) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('No conectado'));
        return;
      }

      this.socket.emit(event, data, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Error desconocido'));
        }
      });
    });
  }

  /**
   * Escucha un evento del servidor
   */
  on(event, callback) {
    if (!this.socket) return;

    // Guardar referencia para poder remover después
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    this.socket.on(event, callback);
  }

  /**
   * Deja de escuchar un evento
   */
  off(event, callback) {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Emite evento local (no al servidor)
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  /**
   * Obtiene el ID del socket
   */
  getId() {
    return this.socket ? this.socket.id : null;
  }

  /**
   * Verifica si está conectado
   */
  isConnected() {
    return this.connected;
  }
}

// Instancia global
window.socketClient = new SocketClient();
