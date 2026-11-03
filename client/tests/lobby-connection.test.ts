// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { CLIENT_EVENTS, ERROR_CODES, PROTOCOL_VERSION, SERVER_EVENTS } from '../../shared/index.js';
import type { LobbyPlayer } from '../../shared/index.js';

const html = readFileSync('src/index.html', 'utf8');
const cleanup: (() => void | Promise<void>)[] = [];
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
});
afterEach(async () => {
  window.dispatchEvent(new Event('beforeunload'));
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

it('raccorde le refus Socket.IO au formulaire puis accepte un nouveau pseudo sur la même connexion', async () => {
  const io = new Server();
  cleanup.push(() => new Promise<void>((resolve) => io.close(() => resolve())));
  const joins: string[] = [];
  const ready: unknown[] = [];
  let connections = 0;
  const players: LobbyPlayer[] = [{ id: 'autre', pseudo: 'Joueur', slot: 1, ready: false }];
  const payload = () => ({ players, minPlayers: 2, maxPlayers: 4, canStart: false });
  io.on('connection', (socket) => {
    connections++;
    socket.emit(SERVER_EVENTS.WELCOME, { id: socket.id, protocolVersion: PROTOCOL_VERSION });
    socket.emit(SERVER_EVENTS.LOBBY, payload());
    socket.on(CLIENT_EVENTS.JOIN, ({ pseudo }: { pseudo: string }) => {
      joins.push(pseudo);
      if (players.some((player) => player.pseudo === pseudo)) {
        socket.emit(SERVER_EVENTS.ERROR, { code: ERROR_CODES.PSEUDO_TAKEN, message: 'Ce pseudo est déjà utilisé.' });
        return;
      }
      players.push({ id: socket.id, pseudo, slot: 2, ready: false });
      socket.emit(SERVER_EVENTS.LOBBY, payload());
    });
    socket.on(CLIENT_EVENTS.READY, (data: unknown) => ready.push(data));
  });
  io.listen(0);
  if (!io.httpServer.listening) await new Promise<void>((resolve) => io.httpServer.once('listening', resolve));
  const address = io.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Port de test absent');

  // Le renderer réel doit transmettre onError à la vue, sans initialiser de scène GPU.
  await import('../src/renderer');
  document.querySelector<HTMLInputElement>('#server-address')!.value = `http://localhost:${address.port}`;
  document.querySelector<HTMLFormElement>('#connection-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  const status = document.querySelector<HTMLElement>('#lobby-status')!;
  const input = document.querySelector<HTMLInputElement>('#lobby-pseudo')!;
  const join = document.querySelector<HTMLButtonElement>('#lobby-join-button')!;
  const readyButton = document.querySelector<HTMLButtonElement>('#lobby-ready-button')!;
  await expect.poll(() => document.querySelector<HTMLElement>('#lobby-section')!.hidden).toBe(false);
  join.click();
  await expect.poll(() => status.textContent).toBe('Ce pseudo est déjà utilisé.');
  expect(input.disabled).toBe(false);
  expect(join.disabled).toBe(false);
  expect(readyButton.disabled).toBe(true);
  input.value = 'Jay';
  join.click();
  await expect.poll(() => readyButton.disabled).toBe(false);
  expect(status.textContent).toContain('Jay');
  readyButton.click();
  await expect.poll(() => ready).toEqual([{ ready: true }]);
  expect(joins).toEqual(['Joueur', 'Jay']);
  expect(connections).toBe(1);
});
