import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { CLIENT_EVENTS, PROTOCOL_VERSION, SERVER_EVENTS } from '../../../shared/index.js';
import type { Direction } from '../../../shared/index.js';
import type { GameTransport, GameTransportObserver } from '../session/types';

function serverOrigin(address: string): string {
  const url = new URL(address.trim());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Adresse invalide');
  }
  return url.origin;
}

export function createSocketTransport({ timeoutMs = 5000 } = {}): GameTransport {
  let activeSocket: Socket | undefined;
  let welcomed = false;
  let inGame = false;
  let observer: GameTransportObserver | null = null;

  return {
    setObserver(nextObserver) {
      observer = nextObserver;
    },

    isConnected() {
      return Boolean(activeSocket?.connected && welcomed);
    },

    isGameActive() {
      return inGame && Boolean(activeSocket?.connected && welcomed);
    },

    setGameActive(active: boolean) {
      inGame = active;
    },

    sendJoin(pseudo: string): boolean {
      if (!this.isConnected() || !activeSocket) return false;
      activeSocket.emit(CLIENT_EVENTS.JOIN, { pseudo });
      return true;
    },

    sendReady(ready: boolean): boolean {
      if (!this.isConnected() || !activeSocket) return false;
      activeSocket.emit(CLIENT_EVENTS.READY, { ready });
      return true;
    },

    sendMove(direction: Direction): boolean {
      if (!this.isGameActive() || !activeSocket) return false;
      activeSocket.emit(CLIENT_EVENTS.MOVE, { direction });
      return true;
    },

    sendBomb(): boolean {
      if (!this.isGameActive() || !activeSocket) return false;
      activeSocket.emit(CLIENT_EVENTS.BOMB, {});
      return true;
    },

    connect(address, observe) {
      let origin: string;
      try {
        origin = serverOrigin(address);
      } catch {
        observe({
          status: 'error',
          message: 'Saisis une adresse HTTP ou HTTPS sans chemin, identifiants ni paramètres.',
        });
        return () => {};
      }

      observe({ status: 'connecting', address: origin });
      const socket = io(origin, {
        autoConnect: false,
        forceNew: true,
        reconnection: false,
        transports: ['websocket'],
        timeout: timeoutMs,
      });
      activeSocket = socket;
      welcomed = false;
      inGame = false;
      let closed = false;
      const deadline = setTimeout(
        () => fail('Le serveur n’a pas confirmé la connexion dans le délai prévu.'),
        timeoutMs,
      );

      function close() {
        if (closed) return;
        closed = true;
        welcomed = false;
        inGame = false;
        clearTimeout(deadline);
        socket.removeAllListeners();
        socket.disconnect();
        if (activeSocket === socket) {
          activeSocket = undefined;
        }
      }

      function fail(message: string) {
        if (closed) return;
        close();
        observe({ status: 'error', message });
      }

      socket.on(SERVER_EVENTS.WELCOME, (payload: unknown) => {
        if (closed || welcomed) return;
        if (
          typeof payload !== 'object' ||
          payload === null ||
          !('id' in payload) ||
          typeof payload.id !== 'string' ||
          !payload.id.trim() ||
          !('protocolVersion' in payload) ||
          !Number.isInteger(payload.protocolVersion)
        ) {
          fail('Bienvenue invalide : le serveur a envoyé une réponse non reconnue.');
          return;
        }
        if (payload.protocolVersion !== PROTOCOL_VERSION) {
          fail('Version du protocole incompatible. Mets le client et le serveur à la même version.');
          return;
        }
        welcomed = true;
        clearTimeout(deadline);
        observe({ status: 'connected', address: origin, playerId: payload.id });

        socket.on(SERVER_EVENTS.LOBBY, (data: unknown) => observer?.onLobby?.(data));
        socket.on(SERVER_EVENTS.START, (data: unknown) => observer?.onStart?.(data));
        socket.on(SERVER_EVENTS.STATE, (data: unknown) => observer?.onState?.(data));
        socket.on(SERVER_EVENTS.OVER, (data: unknown) => observer?.onOver?.(data));
        socket.on(SERVER_EVENTS.ERROR, (data: unknown) => observer?.onError?.(data));
      });

      socket.on('connect_error', () =>
        fail('Connexion impossible. Vérifie l’adresse et que le serveur est lancé.'),
      );
      socket.on('disconnect', () =>
        fail('La connexion au serveur a été interrompue. Tu peux réessayer.'),
      );

      socket.connect();
      return close;
    },
  };
}
