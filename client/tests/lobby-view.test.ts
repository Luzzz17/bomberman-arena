// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ERROR_CODES } from '../../shared/index.js';
import type { GameTransport } from '../src/session/types';
import { mountLobbyView } from '../src/ui/lobby-view';

const html = readFileSync('src/index.html', 'utf8');
const cleanups: (() => void)[] = [];
beforeEach(() => { document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')); });
afterEach(() => { for (const dispose of cleanups.splice(0)) dispose(); });

function setup() {
  const transport = {
    sendJoin: vi.fn(() => true),
    sendReady: vi.fn(() => true),
  } as unknown as GameTransport;
  const view = mountLobbyView({ root: document, transport, playerId: () => 'local' });
  cleanups.push(view.dispose);
  view.setVisible(true);
  const input = document.querySelector<HTMLInputElement>('#lobby-pseudo')!;
  const join = document.querySelector<HTMLButtonElement>('#lobby-join-button')!;
  const ready = document.querySelector<HTMLButtonElement>('#lobby-ready-button')!;
  const status = document.querySelector<HTMLElement>('#lobby-status')!;
  const lobby = (players: { id: string; pseudo: string; ready: boolean }[]) => ({
    players: players.map((p, i) => ({ ...p, slot: i + 1 })), minPlayers: 2, maxPlayers: 4, canStart: false,
  });
  return { view, transport, input, join, ready, status, lobby };
}

describe('Adhésion au lobby confirmée par le serveur', () => {
  it('attend la présence de son identité avant d’activer le bouton prêt', () => {
    const { view, input, join, ready, status, transport, lobby } = setup();
    join.click();
    expect(transport.sendJoin).toHaveBeenCalledExactlyOnceWith('Joueur');
    expect(input.disabled).toBe(true);
    expect(join.disabled).toBe(true);
    expect(ready.disabled).toBe(true);
    expect(status.textContent).toContain('attente');
    view.updateLobby(lobby([{ id: 'autre', pseudo: 'Joueur', ready: false }]));
    expect(ready.disabled).toBe(true);
    expect(status.textContent).toContain('attente');
    view.updateLobby(lobby([{ id: 'local', pseudo: 'Joueur', ready: false }]));
    expect(ready.disabled).toBe(false);
    ready.click();
    expect(transport.sendReady).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each([ERROR_CODES.PSEUDO_TAKEN, ERROR_CODES.INVALID_PSEUDO, ERROR_CODES.LOBBY_FULL, ERROR_CODES.GAME_IN_PROGRESS])(
    'affiche le refus %s, permet la correction puis confirme la nouvelle demande', (code) => {
      const { view, input, join, ready, status, transport, lobby } = setup();
      join.click();
      view.showError({ code, message: 'La demande a été refusée.' });
      expect(status.textContent).toBe('La demande a été refusée.');
      expect(input.disabled).toBe(false);
      expect(join.disabled).toBe(false);
      expect(ready.disabled).toBe(true);
      expect(document.activeElement).toBe(input);
      view.updateLobby(lobby([{ id: 'autre', pseudo: 'Joueur', ready: false }]));
      expect(status.textContent).toBe('La demande a été refusée.');
      input.value = 'Jay';
      join.click();
      expect(transport.sendJoin).toHaveBeenLastCalledWith('Jay');
      expect(ready.disabled).toBe(true);
      expect(status.textContent).toContain('attente');
      view.updateLobby(lobby([{ id: 'local', pseudo: 'Jay', ready: false }]));
      expect(ready.disabled).toBe(false);
      expect(status.textContent).toContain('Jay');
    },
  );

  it('affiche le message comme du texte et ignore les erreurs malformées', () => {
    const { view, join, ready, status } = setup();
    join.click();
    for (const invalid of [null, {}, { code: ERROR_CODES.PSEUDO_TAKEN, message: 42 }]) view.showError(invalid);
    expect(join.disabled).toBe(true);
    const message = '<img src=x onerror=alert(1)>';
    view.showError({ code: ERROR_CODES.PSEUDO_TAKEN, message });
    expect(status.textContent).toBe(message);
    expect(status.querySelector('img')).toBeNull();
    expect(ready.disabled).toBe(true);
  });

  it('permet de réessayer si l’envoi est impossible', () => {
    const { transport, input, join, ready, status } = setup();
    vi.mocked(transport.sendJoin).mockReturnValue(false);
    join.click();
    expect(input.disabled).toBe(false);
    expect(join.disabled).toBe(false);
    expect(ready.disabled).toBe(true);
    expect(status.textContent).toContain('connexion');
  });

  it('réinitialise une demande interrompue à la déconnexion', () => {
    const { view, join, ready, input, status } = setup();
    join.click();
    view.setVisible(false);
    view.showError({ code: ERROR_CODES.PSEUDO_TAKEN, message: 'Ancien refus' });
    view.setVisible(true);
    expect(status.textContent).toBe('');
    expect(join.disabled).toBe(false);
    expect(input.disabled).toBe(false);
    expect(ready.disabled).toBe(true);
  });

  it('répercute l’état prêt reçu et ne désinscrit pas un joueur pour une erreur hors adhésion', () => {
    const { view, join, ready, input, lobby } = setup();
    join.click();
    view.updateLobby(lobby([{ id: 'local', pseudo: 'Joueur', ready: true }]));
    expect(ready.textContent).toContain('annuler');
    view.showError({ code: ERROR_CODES.INVALID_PAYLOAD, message: 'Autre action refusée' });
    expect(input.disabled).toBe(true);
    expect(ready.disabled).toBe(false);
  });
});
