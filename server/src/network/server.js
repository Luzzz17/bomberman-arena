import { Server } from 'socket.io';
import {
  CLIENT_EVENTS,
  DIRECTIONS,
  ERROR_CODES,
  GAME_SETTINGS,
  PROTOCOL_VERSION,
  SERVER_EVENTS,
} from '../../../shared/index.js';
import { createGame, movePlayer, stateOf, winnerOf } from '../game/game.js';
import { canStart, createLobby, joinLobby, leaveLobby, lobbyPayload, resetReady, setReady } from '../game/lobby.js';

/** Room socket.io des joueurs inscrits au lobby. */
const PLAYERS_ROOM = 'players';

/** Messages renvoyés avec chaque code d'erreur. */
const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.INVALID_PAYLOAD]: 'Données absentes ou au mauvais format.',
  [ERROR_CODES.INVALID_PSEUDO]: `Le pseudo doit faire entre ${GAME_SETTINGS.PSEUDO_MIN_LENGTH} et ${GAME_SETTINGS.PSEUDO_MAX_LENGTH} caractères.`,
  [ERROR_CODES.PSEUDO_TAKEN]: 'Ce pseudo est déjà utilisé.',
  [ERROR_CODES.LOBBY_FULL]: 'Le lobby est complet.',
  [ERROR_CODES.GAME_IN_PROGRESS]: 'Une partie est en cours.',
  [ERROR_CODES.NOT_IN_LOBBY]: 'Rejoins le lobby avant cette action.',
  [ERROR_CODES.NOT_IN_GAME]: 'Aucune partie en cours pour ce joueur.',
});

/** Vrai si la valeur est un objet simple, ni null ni tableau. */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Démarre le serveur WebSocket et enregistre les gestionnaires de connexion.
 *
 * @param {number} port - Port d'écoute du serveur.
 * @param {{ random?: () => number }} [options] - `random` est transmis à createGame, remplaçable dans les tests.
 * @returns {Server} Instance socket.io, à fermer avec `io.close()`.
 */
export function startServer(port, { random } = {}) {
  const io = new Server(port, { cors: { origin: '*' } });
  const lobby = createLobby();
  /** Joueurs ayant déjà bougé pendant le tick en cours. */
  const movedThisTick = new Set();
  let game = null;
  let tick = 0;
  let loop = null;

  function sendError(socket, code, message = ERROR_MESSAGES[code]) {
    socket.emit(SERVER_EVENTS.ERROR, { code, message });
  }

  function broadcastLobby() {
    io.emit(SERVER_EVENTS.LOBBY, lobbyPayload(lobby));
  }

  function stopLoop() {
    clearInterval(loop);
    loop = null;
  }

  function startGame() {
    game = createGame(lobby.players, random);
    tick = 0;
    movedThisTick.clear();
    io.to(PLAYERS_ROOM).emit(SERVER_EVENTS.START, { grid: game.grid, players: game.players });
    loop = setInterval(() => {
      movedThisTick.clear();
      io.to(PLAYERS_ROOM).emit(SERVER_EVENTS.STATE, stateOf(game, tick++));
    }, 1000 / GAME_SETTINGS.TICK_RATE);
  }

  function endGameIfOver() {
    const { over, winnerId } = winnerOf(game);
    if (!over) return;

    stopLoop();
    game = null;
    io.to(PLAYERS_ROOM).emit(SERVER_EVENTS.OVER, { winnerId });
    resetReady(lobby);
    broadcastLobby();
  }

  io.on('connection', (socket) => {
    console.log(`Client connecté : ${socket.id}`);

    socket.emit(SERVER_EVENTS.WELCOME, { id: socket.id, protocolVersion: PROTOCOL_VERSION });
    socket.emit(SERVER_EVENTS.LOBBY, lobbyPayload(lobby));

    socket.on(CLIENT_EVENTS.JOIN, (payload) => {
      if (!isObject(payload)) return sendError(socket, ERROR_CODES.INVALID_PAYLOAD);
      if (game) return sendError(socket, ERROR_CODES.GAME_IN_PROGRESS);

      if (lobby.players.some((player) => player.id === socket.id)) {
        return sendError(socket, ERROR_CODES.INVALID_PAYLOAD, 'Tu es déjà dans le lobby.');
      }

      const error = joinLobby(lobby, socket.id, payload.pseudo);
      if (error) return sendError(socket, error);

      socket.join(PLAYERS_ROOM);
      broadcastLobby();
    });

    socket.on(CLIENT_EVENTS.READY, (payload) => {
      if (!isObject(payload)) return sendError(socket, ERROR_CODES.INVALID_PAYLOAD);
      if (game) return sendError(socket, ERROR_CODES.GAME_IN_PROGRESS);

      const error = setReady(lobby, socket.id, payload.ready);
      if (error) return sendError(socket, error);

      broadcastLobby();
      if (canStart(lobby)) startGame();
    });

    socket.on(CLIENT_EVENTS.MOVE, (payload) => {
      if (!isObject(payload)) return sendError(socket, ERROR_CODES.INVALID_PAYLOAD);
      if (!game?.players.some((player) => player.id === socket.id)) {
        return sendError(socket, ERROR_CODES.NOT_IN_GAME);
      }
      if (!DIRECTIONS.includes(payload.direction)) return sendError(socket, ERROR_CODES.INVALID_PAYLOAD);

      // Un seul déplacement par tick, pour qu'un client ne traverse pas la carte en rafale.
      if (movedThisTick.has(socket.id)) return;
      if (movePlayer(game, socket.id, payload.direction)) movedThisTick.add(socket.id);
    });

    socket.on('disconnect', () => {
      console.log(`Client déconnecté : ${socket.id}`);

      if (!leaveLobby(lobby, socket.id)) return;

      if (game) {
        const player = game.players.find((p) => p.id === socket.id);
        if (player) player.alive = false;
        endGameIfOver();
        return;
      }

      broadcastLobby();
      if (canStart(lobby)) startGame();
    });
  });

  io.httpServer.on('close', stopLoop);

  console.log(`Serveur démarré sur le port ${port}`);
  return io;
}
