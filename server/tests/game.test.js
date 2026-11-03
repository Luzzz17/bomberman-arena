import { describe, it, expect } from 'vitest';
import { movePlayer, stateOf, winnerOf } from '../src/game/game.js';
import { BOMB_TIMER, placeBomb } from '../src/game/bombs.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../../shared/index.js';
import { fullGame } from './helpers.js';

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

  it('démarre sans bombe', () => {
    expect(fullGame().bombs).toEqual([]);
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

  it('refuse une case occupée par une bombe', () => {
    const game = fullGame();
    game.bombs.push({ id: 'x', ownerId: 'b', x: 2, y: 1, range: 1, explodesIn: BOMB_TIMER });

    expect(movePlayer(game, 'a', 'right')).toBe(false);
    expect(game.players[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('laisse le joueur quitter sa bombe mais pas y revenir', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    expect(movePlayer(game, 'a', 'right')).toBe(true);
    expect(movePlayer(game, 'a', 'left')).toBe(false);
    expect(game.players[0]).toMatchObject({ x: 2, y: 1 });
  });
});

describe('stateOf', () => {
  it('contient les bombes posées', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    expect(stateOf(game, 1).bombs).toEqual([
      { id: expect.any(String), ownerId: 'a', x: 1, y: 1, range: 1, explodesIn: BOMB_TIMER },
    ]);
  });

  it('renvoie des copies des bombes', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    const state = stateOf(game, 1);
    state.bombs[0].explodesIn = 1;
    state.bombs.push({ id: 'faux' });

    expect(game.bombs).toHaveLength(1);
    expect(game.bombs[0].explodesIn).toBe(BOMB_TIMER);
  });

  it('produit le contenu de server:state d’une partie sans bombe', () => {
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
