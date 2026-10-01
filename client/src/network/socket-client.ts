import { io } from 'socket.io-client';
import { PROTOCOL_VERSION, SERVER_EVENTS } from '../../../shared/index.js';
import type { ConnectionTransport } from '../session/types';

/** Valide une origine, sans transmettre de secret ou choisir un namespace implicite. */
function serverOrigin(address: string): string {
  const url = new URL(address.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Adresse invalide');
  }
  return url.origin;
}

/** Le transport reste non connecté pour l'application jusqu'à une bienvenue compatible. */
export function createSocketTransport({ timeoutMs = 5000 } = {}): ConnectionTransport {
  return {
    connect(address, observe) {
      let origin: string;
      try {
        origin = serverOrigin(address);
      } catch {
        observe({ status: 'error', message: 'Saisis une adresse HTTP ou HTTPS sans chemin, identifiants ni paramètres.' });
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
      let closed = false;
      let welcomed = false;
      const deadline = setTimeout(() => fail('Le serveur n’a pas confirmé la connexion dans le délai prévu.'), timeoutMs);

      function close() {
        if (closed) return;
        closed = true;
        clearTimeout(deadline);
        socket.removeAllListeners();
        socket.disconnect();
      }

      function fail(message: string) {
        if (closed) return;
        close();
        observe({ status: 'error', message });
      }

      socket.on(SERVER_EVENTS.WELCOME, (payload: unknown) => {
        if (closed || welcomed) return;
        if (typeof payload !== 'object' || payload === null ||
            !('id' in payload) || typeof payload.id !== 'string' || !payload.id.trim() ||
            !('protocolVersion' in payload) || !Number.isInteger(payload.protocolVersion)) {
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
      });
      socket.on('connect_error', () => fail('Connexion impossible. Vérifie l’adresse et que le serveur est lancé.'));
      socket.on('disconnect', () => fail('La connexion au serveur a été interrompue. Tu peux réessayer.'));
      socket.connect();
      return close;
    },
  };
}
