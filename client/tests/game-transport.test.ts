import { afterEach, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import type { Socket as ServerSocket } from 'socket.io';
import { CLIENT_EVENTS, PROTOCOL_VERSION, SERVER_EVENTS } from '../../shared/index.js';
import { createSocketTransport } from '../src/network/socket-client';

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

async function createTestServer(onConnection?: (socket: ServerSocket) => void) {
  const io = new Server();
  if (onConnection) io.on('connection', onConnection);
  io.listen(0);
  cleanup.push(() => new Promise<void>((resolve) => io.close(() => resolve())));
  if (!io.httpServer.listening) {
    await new Promise<void>((resolve) => io.httpServer.once('listening', resolve));
  }
  const address = io.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Port éphémère absent');
  return { io, url: `http://localhost:${address.port}` };
}

describe('Transport étendu du jeu et de l’arène', () => {
  it('bloque les émissions hors connexion ou hors partie active', () => {
    const transport = createSocketTransport();
    expect(transport.isConnected()).toBe(false);
    expect(transport.isGameActive()).toBe(false);

    expect(transport.sendJoin('Alice')).toBe(false);
    expect(transport.sendReady(true)).toBe(false);
    expect(transport.sendMove('up')).toBe(false);
    expect(transport.sendBomb()).toBe(false);
  });

  it('émet move et bomb uniquement quand la partie est active et sur la même socket', async () => {
    let serverPeer: ServerSocket | undefined;
    const receivedMove: unknown[] = [];
    const receivedBomb: unknown[] = [];
    const receivedJoin: unknown[] = [];
    const receivedReady: unknown[] = [];

    const { url } = await createTestServer((socket) => {
      serverPeer = socket;
      socket.on(CLIENT_EVENTS.JOIN, (p) => receivedJoin.push(p));
      socket.on(CLIENT_EVENTS.READY, (p) => receivedReady.push(p));
      socket.on(CLIENT_EVENTS.MOVE, (p) => receivedMove.push(p));
      socket.on(CLIENT_EVENTS.BOMB, (p) => receivedBomb.push(p));
    });

    const transport = createSocketTransport({ timeoutMs: 1500 });
    let connected = false;

    const stop = transport.connect(url, (state) => {
      if (state.status === 'connected') connected = true;
    });
    cleanup.push(stop);

    await expect.poll(() => Boolean(serverPeer?.connected)).toBe(true);
    expect(transport.sendMove('left')).toBe(false);

    serverPeer!.emit(SERVER_EVENTS.WELCOME, { id: serverPeer!.id, protocolVersion: PROTOCOL_VERSION });
    await expect.poll(() => connected).toBe(true);
    expect(transport.isConnected()).toBe(true);

    expect(transport.isGameActive()).toBe(false);
    expect(transport.sendMove('right')).toBe(false);
    expect(transport.sendBomb()).toBe(false);
    expect(receivedMove).toHaveLength(0);
    expect(receivedBomb).toHaveLength(0);

    expect(transport.sendJoin('Bob')).toBe(true);
    expect(transport.sendReady(true)).toBe(true);
    await expect.poll(() => receivedJoin).toHaveLength(1);
    expect(receivedJoin[0]).toEqual({ pseudo: 'Bob' });
    expect(receivedReady[0]).toEqual({ ready: true });

    transport.setGameActive(true);
    expect(transport.isGameActive()).toBe(true);

    expect(transport.sendMove('down')).toBe(true);
    expect(transport.sendBomb()).toBe(true);
    await expect.poll(() => receivedMove).toHaveLength(1);
    expect(receivedMove[0]).toEqual({ direction: 'down' });
    expect(receivedBomb).toHaveLength(1);
    expect(receivedBomb[0]).toEqual({});

    transport.setGameActive(false);
    expect(transport.sendMove('up')).toBe(false);
    expect(transport.sendBomb()).toBe(false);
    expect(receivedMove).toHaveLength(1);

    stop();
    expect(transport.isConnected()).toBe(false);
    expect(transport.isGameActive()).toBe(false);
    expect(transport.sendMove('down')).toBe(false);
    expect(transport.sendBomb()).toBe(false);
  });

  it('transmet les messages du serveur à l’observateur enregistré', async () => {
    let serverPeer: ServerSocket | undefined;
    const { url } = await createTestServer((socket) => {
      serverPeer = socket;
    });

    const transport = createSocketTransport({ timeoutMs: 1500 });
    const received: {
      lobby?: unknown;
      start?: unknown;
      state?: unknown;
      over?: unknown;
      error?: unknown;
    } = {};

    transport.setObserver({
      onLobby: (data) => { received.lobby = data; },
      onStart: (data) => { received.start = data; },
      onState: (data) => { received.state = data; },
      onOver: (data) => { received.over = data; },
      onError: (data) => { received.error = data; },
    });

    let connected = false;
    const stop = transport.connect(url, (state) => {
      if (state.status === 'connected') connected = true;
    });
    cleanup.push(stop);

    await expect.poll(() => Boolean(serverPeer?.connected)).toBe(true);
    serverPeer!.emit(SERVER_EVENTS.WELCOME, { id: 'p1', protocolVersion: PROTOCOL_VERSION });
    await expect.poll(() => connected).toBe(true);

    const dummyLobby = { players: [], minPlayers: 2, maxPlayers: 4, canStart: false };
    serverPeer!.emit(SERVER_EVENTS.LOBBY, dummyLobby);
    await expect.poll(() => received.lobby).toEqual(dummyLobby);

    const dummyStart = { grid: [[0]], players: [] };
    serverPeer!.emit(SERVER_EVENTS.START, dummyStart);
    await expect.poll(() => received.start).toEqual(dummyStart);

    const dummyState = { tick: 1, grid: [[0]], players: [], bombs: [], explosions: [], bonuses: [] };
    serverPeer!.emit(SERVER_EVENTS.STATE, dummyState);
    await expect.poll(() => received.state).toEqual(dummyState);

    const dummyOver = { winnerId: 'p1' };
    serverPeer!.emit(SERVER_EVENTS.OVER, dummyOver);
    await expect.poll(() => received.over).toEqual(dummyOver);

    const dummyError = { code: 'NOT_IN_GAME', message: 'Erreur test' };
    serverPeer!.emit(SERVER_EVENTS.ERROR, dummyError);
    await expect.poll(() => received.error).toEqual(dummyError);
  });
});
