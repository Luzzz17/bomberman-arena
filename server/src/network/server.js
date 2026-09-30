import { Server } from 'socket.io';

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

    // Provisoire : confirme la connexion au client en attendant le protocole définitif.
    socket.emit('server:welcome', { id: socket.id });

    socket.on('disconnect', () => {
      console.log(`Client déconnecté : ${socket.id}`);
    });
  });

  console.log(`Serveur démarré sur le port ${port}`);
  return io;
}
