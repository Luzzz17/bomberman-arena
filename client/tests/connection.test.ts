import { afterEach, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import type { Socket as ServerSocket } from 'socket.io';
import { PROTOCOL_VERSION, SERVER_EVENTS } from '../../shared/index.js';
import { createEventBus } from '../src/core/event-bus';
import { createSocketTransport } from '../src/network/socket-client';
import { createSession } from '../src/session/session';
import type { ConnectionState, SessionEvents } from '../src/session/types';

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

async function server(onConnection: (socket: ServerSocket) => void) {
  const io = new Server();
  io.on('connection', onConnection);
  io.listen(0);
  cleanup.push(() => new Promise<void>((resolve) => io.close(() => resolve())));
  if (!io.httpServer.listening) await new Promise<void>((resolve) => io.httpServer.once('listening', resolve));
  const address = io.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Port de test absent');
  return { io, url: `http://localhost:${address.port}` };
}

function setup(timeoutMs = 1000) {
  const bus = createEventBus<SessionEvents>();
  const states: ConnectionState[] = [];
  bus.on('session:changed', (state) => states.push(state));
  const session = createSession(bus, createSocketTransport({ timeoutMs }));
  cleanup.push(session.dispose);
  return { bus, session, states };
}

function waitFor(bus: ReturnType<typeof createEventBus<SessionEvents>>, status: ConnectionState['status']) {
  return new Promise<ConnectionState>((resolve, reject) => {
    const timeout = setTimeout(() => { off(); reject(new Error(`État ${status} absent`)); }, 2000);
    const off = bus.on('session:changed', (state) => {
      if (state.status === status) { clearTimeout(timeout); off(); resolve(state); }
    });
  });
}

describe('Connexion réelle au protocole partagé', () => {
  it('attend la bienvenue avant de conserver une identité et nettoie après déconnexion', async () => {
    let peer: ServerSocket | undefined;
    const { url } = await server((socket) => { peer = socket; });
    const { bus, session, states } = setup();
    bus.emit('connection:requested', url);
    await expect.poll(() => peer?.connected).toBe(true);
    expect(session.getState().status).toBe('connecting');
    const received = waitFor(bus, 'connected');
    peer!.emit(SERVER_EVENTS.WELCOME, { id: peer!.id, protocolVersion: PROTOCOL_VERSION });
    expect(await received).toEqual({ status: 'connected', address: url, playerId: peer!.id });
    peer!.emit(SERVER_EVENTS.WELCOME, { id: peer!.id, protocolVersion: PROTOCOL_VERSION });
    bus.emit('connection:closed', undefined);
    expect(session.getState()).toEqual({ status: 'disconnected' });
    await expect.poll(() => peer?.connected).toBe(false);
    expect(states.filter((state) => state.status === 'connected')).toHaveLength(1);
  });

  it.each([
    [null, 'Bienvenue invalide'],
    [{ id: '', protocolVersion: PROTOCOL_VERSION }, 'Bienvenue invalide'],
    [{ id: 'joueur', protocolVersion: PROTOCOL_VERSION + 1 }, 'Version du protocole incompatible'],
  ])('refuse une bienvenue invalide ou incompatible : %j', async (payload, message) => {
    const { io, url } = await server((socket) => socket.emit(SERVER_EVENTS.WELCOME, payload));
    const { bus } = setup();
    const failed = waitFor(bus, 'error');
    bus.emit('connection:requested', url);
    expect(await failed).toMatchObject({ status: 'error', message: expect.stringContaining(message) });
    await expect.poll(() => io.of('/').sockets.size).toBe(0);
  });

  it('borne le délai sans bienvenue, même si le transport est connecté', async () => {
    const { url } = await server(() => {});
    const { bus } = setup(100);
    const failed = waitFor(bus, 'error');
    bus.emit('connection:requested', url);
    expect(await failed).toMatchObject({ message: expect.stringContaining('délai') });
  });

  it('signale un serveur indisponible', async () => {
    const { io, url } = await server(() => {});
    await new Promise<void>((resolve) => io.close(() => resolve()));
    const { bus } = setup(150);
    const failed = waitFor(bus, 'error');
    bus.emit('connection:requested', url);
    expect(await failed).toMatchObject({ status: 'error' });
  });

  it('oublie l’identité après perte du serveur et permet une nouvelle connexion', async () => {
    let peer: ServerSocket | undefined;
    const { url } = await server((socket) => {
      peer = socket;
      socket.emit(SERVER_EVENTS.WELCOME, { id: socket.id, protocolVersion: PROTOCOL_VERSION });
    });
    const { bus, session, states } = setup();
    const first = waitFor(bus, 'connected');
    bus.emit('connection:requested', url);
    await first;
    const failed = waitFor(bus, 'error');
    peer!.disconnect(true);
    await failed;
    expect(session.getState()).not.toHaveProperty('playerId');
    const second = waitFor(bus, 'connected');
    bus.emit('connection:requested', url);
    await second;
    expect(states.filter((state) => state.status === 'connected')).toHaveLength(2);
  });

  it('annule une tentative précédente sans recevoir sa bienvenue tardive', async () => {
    let firstPeer: ServerSocket | undefined;
    const first = await server((socket) => { firstPeer = socket; });
    const second = await server((socket) => socket.emit(SERVER_EVENTS.WELCOME, { id: socket.id, protocolVersion: PROTOCOL_VERSION }));
    const { bus, session, states } = setup();
    bus.emit('connection:requested', first.url);
    await expect.poll(() => firstPeer?.connected).toBe(true);
    const ready = waitFor(bus, 'connected');
    bus.emit('connection:requested', second.url);
    await ready;
    firstPeer!.emit(SERVER_EVENTS.WELCOME, { id: 'ancien', protocolVersion: PROTOCOL_VERSION });
    await expect.poll(() => firstPeer?.connected).toBe(false);
    expect(session.getState()).toMatchObject({ status: 'connected', address: second.url });
    expect(states.filter((state) => state.status === 'connected')).toHaveLength(1);
    session.dispose();
    bus.emit('connection:requested', first.url);
    expect(session.getState()).toEqual({ status: 'disconnected' });
  });

  it.each(['', 'file:///etc/passwd', 'http://user:secret@localhost:3000', 'http://localhost:3000/lobby', 'http://localhost:3000?token=secret'])('refuse une adresse invalide : %s', async (address) => {
    const { bus } = setup();
    const failed = waitFor(bus, 'error');
    bus.emit('connection:requested', address);
    expect(await failed).toMatchObject({ message: expect.stringContaining('adresse HTTP') });
  });
});
