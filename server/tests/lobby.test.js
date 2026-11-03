import { describe, it, expect } from 'vitest';
import {
  canStart,
  createLobby,
  joinLobby,
  leaveLobby,
  lobbyPayload,
  resetReady,
  setReady,
} from '../src/game/lobby.js';
import { ERROR_CODES, GAME_SETTINGS } from '../../shared/index.js';

/** Lobby où les joueurs id0, id1... ont déjà rejoint. */
function lobbyWith(count) {
  const lobby = createLobby();
  for (let i = 0; i < count; i++) joinLobby(lobby, `id${i}`, `Joueur${i}`);
  return lobby;
}

describe('joinLobby', () => {
  it('ajoute les joueurs avec des slots croissants et pas prêts', () => {
    const lobby = lobbyWith(2);

    expect(lobby.players).toEqual([
      { id: 'id0', pseudo: 'Joueur0', slot: 1, ready: false },
      { id: 'id1', pseudo: 'Joueur1', slot: 2, ready: false },
    ]);
  });

  it('retire les espaces autour du pseudo', () => {
    const lobby = createLobby();

    expect(joinLobby(lobby, 'a', '  Theo  ')).toBeNull();
    expect(lobby.players[0].pseudo).toBe('Theo');
  });

  it('accepte un pseudo de la longueur maximale', () => {
    const lobby = createLobby();

    expect(joinLobby(lobby, 'a', 'x'.repeat(GAME_SETTINGS.PSEUDO_MAX_LENGTH))).toBeNull();
  });

  it('refuse un pseudo vide, trop long ou absent', () => {
    const lobby = createLobby();

    expect(joinLobby(lobby, 'a', '   ')).toBe(ERROR_CODES.INVALID_PSEUDO);
    expect(joinLobby(lobby, 'a', 'x'.repeat(GAME_SETTINGS.PSEUDO_MAX_LENGTH + 1))).toBe(ERROR_CODES.INVALID_PSEUDO);
    expect(joinLobby(lobby, 'a', undefined)).toBe(ERROR_CODES.INVALID_PAYLOAD);
    expect(lobby.players).toHaveLength(0);
  });

  it('refuse un pseudo déjà pris, même avec des espaces', () => {
    const lobby = createLobby();
    joinLobby(lobby, 'a', 'Theo');

    expect(joinLobby(lobby, 'b', 'Theo ')).toBe(ERROR_CODES.PSEUDO_TAKEN);
  });

  it('refuse un joueur quand le lobby est plein, avant de regarder son pseudo', () => {
    const lobby = lobbyWith(GAME_SETTINGS.MAX_PLAYERS);

    expect(joinLobby(lobby, 'extra', 'Extra')).toBe(ERROR_CODES.LOBBY_FULL);
    expect(joinLobby(lobby, 'extra', 'Joueur0')).toBe(ERROR_CODES.LOBBY_FULL);
  });
});

describe('setReady', () => {
  it('change l’état prêt du joueur', () => {
    const lobby = lobbyWith(1);

    expect(setReady(lobby, 'id0', true)).toBeNull();
    expect(lobby.players[0].ready).toBe(true);
  });

  it('refuse un joueur hors du lobby', () => {
    expect(setReady(createLobby(), 'inconnu', true)).toBe(ERROR_CODES.NOT_IN_LOBBY);
  });

  it('refuse une valeur qui n’est pas un booléen', () => {
    const lobby = lobbyWith(1);

    expect(setReady(lobby, 'id0', 'oui')).toBe(ERROR_CODES.INVALID_PAYLOAD);
    expect(lobby.players[0].ready).toBe(false);
  });
});

describe('canStart', () => {
  it('attend au moins deux joueurs tous prêts', () => {
    const lobby = lobbyWith(1);
    setReady(lobby, 'id0', true);
    expect(canStart(lobby)).toBe(false);

    joinLobby(lobby, 'id1', 'Joueur1');
    expect(canStart(lobby)).toBe(false);

    setReady(lobby, 'id1', true);
    expect(canStart(lobby)).toBe(true);
  });

  it('attend que tous les joueurs soient prêts', () => {
    const lobby = lobbyWith(3);
    setReady(lobby, 'id0', true);
    setReady(lobby, 'id1', true);

    expect(canStart(lobby)).toBe(false);
  });
});

describe('leaveLobby', () => {
  it('retire le joueur et libère son slot', () => {
    const lobby = lobbyWith(2);

    expect(leaveLobby(lobby, 'id0')).toBe(true);
    expect(leaveLobby(lobby, 'id0')).toBe(false);

    joinLobby(lobby, 'id2', 'Joueur2');
    expect(lobby.players.find((p) => p.id === 'id2').slot).toBe(1);
  });
});

describe('resetReady', () => {
  it('remet tous les joueurs à pas prêt', () => {
    const lobby = lobbyWith(2);
    setReady(lobby, 'id0', true);
    setReady(lobby, 'id1', true);

    resetReady(lobby);

    expect(lobby.players.every((p) => !p.ready)).toBe(true);
  });
});

describe('lobbyPayload', () => {
  it('produit le contenu de server:lobby', () => {
    const lobby = lobbyWith(1);

    expect(lobbyPayload(lobby)).toEqual({
      players: [{ id: 'id0', pseudo: 'Joueur0', slot: 1, ready: false }],
      minPlayers: GAME_SETTINGS.MIN_PLAYERS,
      maxPlayers: GAME_SETTINGS.MAX_PLAYERS,
      canStart: false,
    });
  });
});
