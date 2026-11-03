import { describe, it, expect } from 'vitest';
import { createGame, movePlayer, stateOf, winnerOf } from '../src/game/game.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../../shared/index.js';

const PLAYERS = [
  { id: 'a', pseudo: 'Alice', slot: 1 },
  { id: 'b', pseudo: 'Bob', slot: 4 },
];

/** Partie avec un plateau rempli de briques hors des zones de départ. */
function fullGame() {
  return createGame(PLAYERS, () => 0);
}

describe('createGame', () => {
  it('place chaque joueur sur le départ de son slot', () => {
    const { players } = fullGame();

    expect(players[0]).toMatchObject({ id: 'a', x: 1, y: 1 });
    expect(players[1]).toMatchObject({ id: 'b', x: MAP_WIDTH - 2, y: MAP_HEIGHT - 2 });
  });

  it('crée des joueurs vivants avec les valeurs de départ', () => {
    const [player] = fullGame().players;

    expect(player).toEqual({
      id: 'a',
      pseudo: 'Alice',
      slot: 1,
      x: 1,
      y: 1,
      alive: true,
      maxBombs: 1,
      range: 1,
      speed: 1,
    });
  });
});

describe('movePlayer', () => {
  it('avance le joueur sur une case libre', () => {
    const game = fullGame();

    expect(movePlayer(game, 'a', 'right')).toBe(true);
    expect(game.players[0]).toMatchObject({ x: 2, y: 1 });

    expect(movePlayer(game, 'a', 'left')).toBe(true);
    expect(movePlayer(game, 'a', 'down')).toBe(true);
    expect(game.players[0]).toMatchObject({ x: 1, y: 2 });

    expect(movePlayer(game, 'a', 'up')).toBe(true);
    expect(game.players[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('refuse un mur et une brique sans bouger le joueur', () => {
    const game = fullGame();

    expect(movePlayer(game, 'a', 'up')).toBe(false);
    expect(movePlayer(game, 'a', 'right')).toBe(true);
    expect(movePlayer(game, 'a', 'right')).toBe(false);
    expect(game.players[0]).toMatchObject({ x: 2, y: 1 });
  });

  it('refuse une direction invalide', () => {
    const game = fullGame();

    expect(movePlayer(game, 'a', 'diagonal')).toBe(false);
    expect(movePlayer(game, 'a', undefined)).toBe(false);
    expect(game.players[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('refuse un joueur inconnu ou mort', () => {
    const game = fullGame();
    game.players[0].alive = false;

    expect(movePlayer(game, 'inconnu', 'right')).toBe(false);
    expect(movePlayer(game, 'a', 'right')).toBe(false);
    expect(game.players[0]).toMatchObject({ x: 1, y: 1 });
  });
});

describe('stateOf', () => {
  it('produit le contenu de server:state avec des listes vides', () => {
    const game = fullGame();

    expect(stateOf(game, 3)).toEqual({
      tick: 3,
      grid: game.grid,
      players: game.players,
      bombs: [],
      explosions: [],
      bonuses: [],
    });
  });
});

describe('winnerOf', () => {
  it('continue tant que deux joueurs sont vivants', () => {
    expect(winnerOf(fullGame())).toEqual({ over: false, winnerId: null });
  });

  it('désigne le dernier joueur vivant', () => {
    const game = fullGame();
    game.players[0].alive = false;

    expect(winnerOf(game)).toEqual({ over: true, winnerId: 'b' });
  });

  it('termine sur une égalité quand plus personne n’est vivant', () => {
    const game = fullGame();
    game.players.forEach((player) => {
      player.alive = false;
    });

    expect(winnerOf(game)).toEqual({ over: true, winnerId: null });
  });
});
