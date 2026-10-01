import { Server } from 'socket.io';
import { PROTOCOL_VERSION, SERVER_EVENTS } from '../../../shared/index.js';

/**
 * Démarre le serveur WebSocket et enregistre les gestionnaires de connexion.
 *
 * @param {number} port - Port d'écoute du serveur.
 * @returns {Server} Instance socket.io, à fermer avec `io.close()`.
 */
export function startServer(port) {
  const io = new Server(port, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log(`Client connecté : ${socket.id}`);

    socket.emit(SERVER_EVENTS.WELCOME, { id: socket.id, protocolVersion: PROTOCOL_VERSION });

    socket.on('disconnect', () => {
      console.log(`Client déconnecté : ${socket.id}`);
    });
  });

  console.log(`Serveur démarré sur le port ${port}`);
  return io;
}
