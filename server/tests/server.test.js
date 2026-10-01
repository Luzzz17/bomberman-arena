import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { io as connect } from 'socket.io-client';
import { startServer } from '../src/network/server.js';
import { PROTOCOL_VERSION, SERVER_EVENTS } from '../../shared/index.js';

describe('Serveur WebSocket', () => {
  let io;
  let url;

  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    io = startServer(0);
    url = `http://localhost:${io.httpServer.address().port}`;
  });

  afterAll(async () => {
    await io.close();
    vi.restoreAllMocks();
  });

  it('accepte la connexion d’un client et lui envoie server:welcome', async () => {
    const client = connect(url, { transports: ['websocket'] });

    const welcome = await new Promise((resolve, reject) => {
      client.on(SERVER_EVENTS.WELCOME, resolve);
      client.on('connect_error', reject);
    });

    expect(client.connected).toBe(true);
    expect(welcome).toEqual({ id: client.id, protocolVersion: PROTOCOL_VERSION });

    client.close();
  });
});
