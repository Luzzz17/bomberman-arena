import { describe, it, expect } from 'vitest';
import { BOMB_TIMER, hasBomb, placeBomb, updateBombs } from '../src/game/bombs.js';
import { movePlayer } from '../src/game/game.js';
import { fullGame } from './helpers.js';

describe('placeBomb', () => {
  it('pose une bombe sur la case du joueur avec les bons champs', () => {
    const game = fullGame();
    game.players[0].range = 3;

    expect(placeBomb(game, 'a')).toBe(true);

    expect(game.bombs).toEqual([
      { id: expect.any(String), ownerId: 'a', x: 1, y: 1, range: 3, explodesIn: BOMB_TIMER },
    ]);
  });

  it('refuse une deuxième bombe au-delà de maxBombs, même après un déplacement', () => {
    const game = fullGame();

    expect(placeBomb(game, 'a')).toBe(true);
    expect(placeBomb(game, 'a')).toBe(false);
    expect(movePlayer(game, 'a', 'right')).toBe(true);
    expect(placeBomb(game, 'a')).toBe(false);
    expect(game.bombs).toHaveLength(1);
  });

  it('autorise deux bombes sur deux cases avec maxBombs à 2', () => {
    const game = fullGame();
    game.players[0].maxBombs = 2;

    expect(placeBomb(game, 'a')).toBe(true);
    expect(movePlayer(game, 'a', 'right')).toBe(true);
    expect(placeBomb(game, 'a')).toBe(true);
    expect(game.bombs.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
  });

  it('refuse une deuxième bombe sur la même case, même d’un autre joueur', () => {
    const game = fullGame();
    game.players[0].maxBombs = 2;
    game.players[1].x = 1;
    game.players[1].y = 1;

    expect(placeBomb(game, 'a')).toBe(true);
    expect(placeBomb(game, 'a')).toBe(false);
    expect(placeBomb(game, 'b')).toBe(false);
    expect(game.bombs).toHaveLength(1);
    expect(game.bombs[0].ownerId).toBe('a');
  });

  it('refuse un joueur mort sans modifier les bombes', () => {
    const game = fullGame();
    game.players[0].alive = false;

    expect(placeBomb(game, 'a')).toBe(false);
    expect(game.bombs).toEqual([]);
  });

  it('refuse un joueur inconnu sans modifier les bombes', () => {
    const game = fullGame();

    expect(placeBomb(game, 'inconnu')).toBe(false);
    expect(game.bombs).toEqual([]);
  });

  it('donne un identifiant unique à chaque bombe', () => {
    const game = fullGame();
    game.players[0].maxBombs = 2;

    placeBomb(game, 'a');
    movePlayer(game, 'a', 'right');
    placeBomb(game, 'a');
    placeBomb(game, 'b');

    const ids = game.bombs.map((bomb) => bomb.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('garde des identifiants distincts quand une bombe a expiré avant une nouvelle pose', () => {
    const game = fullGame();

    placeBomb(game, 'a');
    updateBombs(game, 1000);
    placeBomb(game, 'b');
    expect(updateBombs(game, BOMB_TIMER - 1000)).toHaveLength(1);
    expect(placeBomb(game, 'a')).toBe(true);

    const ids = game.bombs.map((bomb) => bomb.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('updateBombs', () => {
  it('diminue explodesIn sans rien enlever avant la fin de la mèche', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    expect(updateBombs(game, 50)).toEqual([]);
    expect(updateBombs(game, 1000)).toEqual([]);

    expect(game.bombs).toHaveLength(1);
    expect(game.bombs[0].explodesIn).toBe(BOMB_TIMER - 1050);
  });

  it('enlève et renvoie la bombe quand la mèche est écoulée', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    expect(updateBombs(game, BOMB_TIMER - 100)).toEqual([]);
    const removed = updateBombs(game, 100);

    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({ ownerId: 'a', x: 1, y: 1 });
    expect(game.bombs).toEqual([]);
  });

  it('enlève aussi une bombe dont explodesIn vaut exactement 0', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    expect(updateBombs(game, BOMB_TIMER)).toHaveLength(1);
    expect(game.bombs).toEqual([]);
  });

  it('enlève une bombe dont le temps est dépassé', () => {
    const game = fullGame();
    placeBomb(game, 'a');

    expect(updateBombs(game, BOMB_TIMER + 500)).toHaveLength(1);
    expect(game.bombs).toEqual([]);
  });

  it('ne retire que les bombes arrivées au bout de leur mèche', () => {
    const game = fullGame();
    placeBomb(game, 'a');
    updateBombs(game, 1000);
    placeBomb(game, 'b');

    const removed = updateBombs(game, BOMB_TIMER - 1000);

    expect(removed.map((bomb) => bomb.ownerId)).toEqual(['a']);
    expect(game.bombs.map((bomb) => bomb.ownerId)).toEqual(['b']);
  });

  it('renvoie un tableau vide sans bombe', () => {
    expect(updateBombs(fullGame(), 50)).toEqual([]);
  });

  it('permet au joueur de reposer une bombe après la fin de la mèche', () => {
    const game = fullGame();
    placeBomb(game, 'a');
    updateBombs(game, BOMB_TIMER);

    expect(placeBomb(game, 'a')).toBe(true);
    expect(game.bombs).toHaveLength(1);
    expect(game.bombs[0].explodesIn).toBe(BOMB_TIMER);
  });
});

describe('hasBomb', () => {
  it('est vrai sur la case de la bombe et faux à côté', () => {
    const game = fullGame();

    expect(hasBomb(game, 1, 1)).toBe(false);
    placeBomb(game, 'a');

    expect(hasBomb(game, 1, 1)).toBe(true);
    expect(hasBomb(game, 2, 1)).toBe(false);
    expect(hasBomb(game, 1, 2)).toBe(false);
  });

  it('est faux après la fin de la mèche', () => {
    const game = fullGame();
    placeBomb(game, 'a');
    updateBombs(game, BOMB_TIMER);

    expect(hasBomb(game, 1, 1)).toBe(false);
  });
});
