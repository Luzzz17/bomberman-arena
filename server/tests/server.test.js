import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io as connect } from 'socket.io-client';
import { startServer } from '../src/network/server.js';
import { SPAWN_POINTS } from '../src/game/grid.js';
import { BOMB_TIMER } from '../src/game/bombs.js';
import { CLIENT_EVENTS, ERROR_CODES, MAP_HEIGHT, PROTOCOL_VERSION, SERVER_EVENTS } from '../../shared/index.js';

// La mesure côté test peut décaler d'un tick ou deux ; la dérive de Windows donnait ~3700 ms.
const FUSE_TOLERANCE = 500;
/** Marge ajoutée à la mèche pour le délai d'attente du message. */
const WAIT_MARGIN = 1000;
/** Marge ajoutée au délai d'attente pour le timeout Vitest (connexion et lancement de la partie). */
const TEST_MARGIN = 2000;

/** Attend un message qui respecte la condition, avec un délai maximal. */
function waitFor(socket, event, condition = () => true, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`${event} non reçu dans le délai`));
    }, timeout);

    function listener(payload) {
      if (!condition(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    }

    socket.on(event, listener);
  });
}

/** Joueur de l'état correspondant au client. */
function playerOf(state, client) {
  return state.players.find((player) => player.id === client.id);
}

describe('Serveur WebSocket', () => {
  let io;
  let url;
  let clients;

  /** Connecte un client et attend son server:welcome. */
  async function connectClient() {
    const client = connect(url, { transports: ['websocket'] });
    clients.push(client);
    const welcome = await waitFor(client, SERVER_EVENTS.WELCOME);
    return { client, welcome };
  }

  /** Connecte un client et le fait rejoindre le lobby. */
  async function joinedClient(pseudo) {
    const { client } = await connectClient();
    const joined = waitFor(client, SERVER_EVENTS.LOBBY, (lobby) => lobby.players.some((p) => p.id === client.id));
    client.emit(CLIENT_EVENTS.JOIN, { pseudo });
    const lobby = await joined;
    return { client, lobby };
  }

  /** Erreur reçue par le client après l'envoi d'un message. */
  function errorAfter(client, event, payload) {
    const error = waitFor(client, SERVER_EVENTS.ERROR);
    client.emit(event, payload);
    return error;
  }

  /** Lance une partie : les joueurs rejoignent dans l'ordre, donc prennent les slots 1, 2... */
  async function startGame(pseudos) {
    const players = [];
    for (const pseudo of pseudos) players.push((await joinedClient(pseudo)).client);

    const started = waitFor(players[0], SERVER_EVENTS.START);
    players.forEach((client) => client.emit(CLIENT_EVENTS.READY, { ready: true }));
    const start = await started;

    return { players, start };
  }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // Plateau sans brique : seuls les murs fixes bloquent.
    io = startServer(0, { random: () => 1 });
    url = `http://localhost:${io.httpServer.address().port}`;
    clients = [];
  });

  afterEach(async () => {
    clients.forEach((client) => client.close());
    await io.close();
    vi.restoreAllMocks();
  });

  describe('connexion et lobby', () => {
    it('envoie server:welcome puis l’état du lobby à la connexion', async () => {
      const client = connect(url, { transports: ['websocket'] });
      clients.push(client);
      const lobby = waitFor(client, SERVER_EVENTS.LOBBY);

      const welcome = await waitFor(client, SERVER_EVENTS.WELCOME);

      expect(welcome).toEqual({ id: client.id, protocolVersion: PROTOCOL_VERSION });
      expect((await lobby).players).toEqual([]);
    });

    it('ajoute les joueurs au lobby dans l’ordre d’arrivée', async () => {
      const { client: a } = await joinedClient('Alice');
      const { client: b, lobby } = await joinedClient('Bob');

      expect(lobby.players).toEqual([
        { id: a.id, pseudo: 'Alice', slot: 1, ready: false },
        { id: b.id, pseudo: 'Bob', slot: 2, ready: false },
      ]);
      expect(lobby.canStart).toBe(false);
    });

    it('refuse un pseudo invalide', async () => {
      const { client } = await connectClient();

      expect(await errorAfter(client, CLIENT_EVENTS.JOIN, { pseudo: '' }))
        .toMatchObject({ code: ERROR_CODES.INVALID_PSEUDO });
    });

    it('refuse un joueur déjà dans le lobby', async () => {
      const { client } = await joinedClient('Alice');

      expect(await errorAfter(client, CLIENT_EVENTS.JOIN, { pseudo: 'Autre' }))
        .toEqual({ code: ERROR_CODES.INVALID_PAYLOAD, message: 'Tu es déjà dans le lobby.' });
    });

    it('refuse un message qui n’est pas un objet', async () => {
      const { client } = await connectClient();

      expect(await errorAfter(client, CLIENT_EVENTS.JOIN, null)).toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
      expect(await errorAfter(client, CLIENT_EVENTS.READY, [true])).toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
      expect(await errorAfter(client, CLIENT_EVENTS.MOVE, 'right')).toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
      expect(await errorAfter(client, CLIENT_EVENTS.BOMB, 'bombe')).toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
    });

    it('refuse « prêt » sans avoir rejoint le lobby', async () => {
      const { client } = await connectClient();

      expect(await errorAfter(client, CLIENT_EVENTS.READY, { ready: true }))
        .toMatchObject({ code: ERROR_CODES.NOT_IN_LOBBY });
    });

    it('retire du lobby un joueur qui se déconnecte', async () => {
      const { client: a } = await joinedClient('Alice');
      const { client: b } = await joinedClient('Bob');

      const lobby = waitFor(a, SERVER_EVENTS.LOBBY);
      b.close();

      expect((await lobby).players).toEqual([{ id: a.id, pseudo: 'Alice', slot: 1, ready: false }]);
    });

    it('démarre la partie quand le seul joueur pas prêt s’en va', async () => {
      const { client: a } = await joinedClient('Alice');
      const { client: b } = await joinedClient('Bob');
      const { client: c } = await joinedClient('Carl');
      a.emit(CLIENT_EVENTS.READY, { ready: true });
      await waitFor(a, SERVER_EVENTS.LOBBY, (lobby) => lobby.players[0].ready);
      b.emit(CLIENT_EVENTS.READY, { ready: true });
      await waitFor(a, SERVER_EVENTS.LOBBY, (lobby) => lobby.players[1].ready);

      const started = waitFor(a, SERVER_EVENTS.START);
      c.close();

      expect((await started).players).toHaveLength(2);
    });
  });

  describe('partie', () => {
    it('démarre quand tous les joueurs sont prêts', async () => {
      const { players: [a, b], start } = await startGame(['Alice', 'Bob']);

      expect(start.grid).toHaveLength(MAP_HEIGHT);
      expect(start.players).toMatchObject([
        { id: a.id, slot: 1, ...SPAWN_POINTS[0], alive: true },
        { id: b.id, slot: 2, ...SPAWN_POINTS[1], alive: true },
      ]);
    });

    it('envoie des états avec un tick croissant', async () => {
      const { players: [a] } = await startGame(['Alice', 'Bob']);

      const first = await waitFor(a, SERVER_EVENTS.STATE);
      const second = await waitFor(a, SERVER_EVENTS.STATE);

      expect(second.tick).toBe(first.tick + 1);
      expect(first).toMatchObject({ bombs: [], explosions: [], bonuses: [] });
    });

    it('refuse de rejoindre ou de changer « prêt » pendant une partie', async () => {
      const { players: [a] } = await startGame(['Alice', 'Bob']);
      const { client: late } = await connectClient();

      expect(await errorAfter(late, CLIENT_EVENTS.JOIN, { pseudo: 'Retard' }))
        .toMatchObject({ code: ERROR_CODES.GAME_IN_PROGRESS });
      expect(await errorAfter(a, CLIENT_EVENTS.READY, { ready: true }))
        .toMatchObject({ code: ERROR_CODES.GAME_IN_PROGRESS });
    });

    it('refuse un déplacement d’un client qui n’est pas dans la partie', async () => {
      const { client } = await connectClient();
      expect(await errorAfter(client, CLIENT_EVENTS.MOVE, { direction: 'right' }))
        .toMatchObject({ code: ERROR_CODES.NOT_IN_GAME });

      await startGame(['Alice', 'Bob']);

      expect(await errorAfter(client, CLIENT_EVENTS.MOVE, { direction: 'right' }))
        .toMatchObject({ code: ERROR_CODES.NOT_IN_GAME });
    });

    it('refuse une bombe d’un client qui n’est pas dans la partie', async () => {
      const { client } = await connectClient();
      expect(await errorAfter(client, CLIENT_EVENTS.BOMB, {}))
        .toMatchObject({ code: ERROR_CODES.NOT_IN_GAME });

      await startGame(['Alice', 'Bob']);

      expect(await errorAfter(client, CLIENT_EVENTS.BOMB, {}))
        .toMatchObject({ code: ERROR_CODES.NOT_IN_GAME });
    });

    it('refuse un message de bombe qui n’est pas un objet', async () => {
      const { players: [a] } = await startGame(['Alice', 'Bob']);

      expect(await errorAfter(a, CLIENT_EVENTS.BOMB, null)).toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
      expect(await errorAfter(a, CLIENT_EVENTS.BOMB, [])).toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
    });

    it('montre à B la bombe posée par A', async () => {
      const { players: [a, b] } = await startGame(['Alice', 'Bob']);

      a.emit(CLIENT_EVENTS.BOMB, {});
      const state = await waitFor(b, SERVER_EVENTS.STATE, (payload) => payload.bombs.length > 0);

      expect(state.bombs).toEqual([
        {
          id: expect.any(String),
          ownerId: a.id,
          ...SPAWN_POINTS[0],
          range: 1,
          explodesIn: expect.any(Number),
        },
      ]);
      // Le tick qui émet l'état a déjà décrémenté la mèche.
      expect(state.bombs[0].explodesIn).toBeGreaterThan(0);
      expect(state.bombs[0].explodesIn).toBeLessThan(BOMB_TIMER);
    });

    it('fait disparaître la bombe après environ BOMB_TIMER', async () => {
      const { players: [a, b] } = await startGame(['Alice', 'Bob']);

      a.emit(CLIENT_EVENTS.BOMB, {});
      await waitFor(b, SERVER_EVENTS.STATE, (payload) => payload.bombs.length > 0);
      const seenAt = performance.now();

      await waitFor(b, SERVER_EVENTS.STATE, (payload) => payload.bombs.length === 0, BOMB_TIMER + WAIT_MARGIN);
      const elapsed = performance.now() - seenAt;

      expect(elapsed).toBeGreaterThanOrEqual(BOMB_TIMER - FUSE_TOLERANCE);
      expect(elapsed).toBeLessThanOrEqual(BOMB_TIMER + FUSE_TOLERANCE);
    }, BOMB_TIMER + WAIT_MARGIN + TEST_MARGIN);

    it('ignore sans erreur une bombe posée sur une case occupée', async () => {
      const { players: [a, b] } = await startGame(['Alice', 'Bob']);
      const errors = [];
      a.on(SERVER_EVENTS.ERROR, (error) => errors.push(error));

      a.emit(CLIENT_EVENTS.BOMB, {});
      a.emit(CLIENT_EVENTS.BOMB, {});
      await waitFor(b, SERVER_EVENTS.STATE, (payload) => payload.bombs.length > 0);
      const state = await waitFor(b, SERVER_EVENTS.STATE);

      expect(state.bombs).toHaveLength(1);
      expect(errors).toEqual([]);
    });

    it('refuse une direction invalide', async () => {
      const { players: [a] } = await startGame(['Alice', 'Bob']);

      expect(await errorAfter(a, CLIENT_EVENTS.MOVE, { direction: 'diagonal' }))
        .toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD });
    });

    it('montre à B le déplacement de A', async () => {
      const { players: [a, b] } = await startGame(['Alice', 'Bob']);

      a.emit(CLIENT_EVENTS.MOVE, { direction: 'right' });
      await waitFor(a, SERVER_EVENTS.STATE);
      const state = await waitFor(b, SERVER_EVENTS.STATE);

      expect(playerOf(state, a)).toMatchObject({ x: 2, y: 1 });
    });

    it('laisse le joueur sur place contre un mur', async () => {
      const { players: [a] } = await startGame(['Alice', 'Bob']);

      a.emit(CLIENT_EVENTS.MOVE, { direction: 'up' });
      await waitFor(a, SERVER_EVENTS.STATE);
      const state = await waitFor(a, SERVER_EVENTS.STATE);

      expect(playerOf(state, a)).toMatchObject(SPAWN_POINTS[0]);
    });

    it('n’applique qu’un déplacement par tick', async () => {
      const { players: [a] } = await startGame(['Alice', 'Bob']);
      await waitFor(a, SERVER_EVENTS.STATE);

      for (let i = 0; i < 10; i++) a.emit(CLIENT_EVENTS.MOVE, { direction: 'right' });
      await waitFor(a, SERVER_EVENTS.STATE);
      const state = await waitFor(a, SERVER_EVENTS.STATE);

      // Une case par tick ; deux si un tick tombe au milieu de la rafale.
      expect(playerOf(state, a).x).toBeLessThanOrEqual(SPAWN_POINTS[0].x + 2);
    });

    it('continue la partie tant que deux joueurs sont vivants', async () => {
      const { players: [a, b, c] } = await startGame(['Alice', 'Bob', 'Carl']);

      // socket.io-client efface l'id à la fermeture.
      const cId = c.id;
      c.close();
      await waitFor(a, SERVER_EVENTS.STATE, (state) => playerOf(state, { id: cId })?.alive === false);
      const state = await waitFor(b, SERVER_EVENTS.STATE);

      expect(state.players.filter((player) => player.alive)).toHaveLength(2);
    });

    it('termine la partie quand A se déconnecte et revient au lobby', async () => {
      const { players: [a, b] } = await startGame(['Alice', 'Bob']);

      const over = waitFor(b, SERVER_EVENTS.OVER);
      const lobby = waitFor(b, SERVER_EVENTS.LOBBY, (payload) => payload.players.length === 1);
      a.close();

      expect(await over).toEqual({ winnerId: b.id });
      expect((await lobby).players).toEqual([{ id: b.id, pseudo: 'Bob', slot: 2, ready: false }]);
    });
  });
});
