import { describe, expect, it } from 'vitest';
import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../shared/index.js';
import { validateStartPayload, validateStatePayload } from '../src/game/validator';

function makeValidGrid(): number[][] {
  return Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(CELL.EMPTY));
}

function makeValidPlayer(id = 'p1', x = 0, y = 0) {
  return { id, pseudo: 'Joueur', slot: 1, x, y, alive: true, maxBombs: 1, range: 2, speed: 1 };
}

describe('Validateur StartPayload et StatePayload', () => {
  it('valide un StartPayload correct', () => {
    const valid = {
      grid: makeValidGrid(),
      players: [makeValidPlayer('p1', 0, 0), makeValidPlayer('p2', 12, 10)],
    };
    expect(validateStartPayload(valid)).toEqual(valid);
  });

  it('rejette un StartPayload incomplet ou malformé', () => {
    expect(validateStartPayload(null)).toBeNull();
    expect(validateStartPayload({})).toBeNull();
    expect(validateStartPayload({ grid: [], players: [] })).toBeNull();

    const badGrid = Array.from({ length: 5 }, () => Array(MAP_WIDTH).fill(0));
    expect(validateStartPayload({ grid: badGrid, players: [] })).toBeNull();

    const dupPlayers = {
      grid: makeValidGrid(),
      players: [makeValidPlayer('dup', 0, 0), makeValidPlayer('dup', 1, 1)],
    };
    expect(validateStartPayload(dupPlayers)).toBeNull();

    const outPlayer = {
      grid: makeValidGrid(),
      players: [makeValidPlayer('p1', 99, 0)],
    };
    expect(validateStartPayload(outPlayer)).toBeNull();
  });

  it('valide un StatePayload correct', () => {
    const valid = {
      tick: 42,
      grid: makeValidGrid(),
      players: [makeValidPlayer('p1', 1, 1)],
      bombs: [{ id: 'b1', x: 2, y: 2, ownerId: 'p1', range: 2, explodesIn: 3000 }],
      explosions: [],
      bonuses: [],
    };
    expect(validateStatePayload(valid)).toEqual(valid);
  });

  it('rejette un StatePayload aux ticks ou bombes invalides', () => {
    const base = {
      tick: -1,
      grid: makeValidGrid(),
      players: [makeValidPlayer()],
      bombs: [],
    };
    expect(validateStatePayload(base)).toBeNull();

    const badBomb = {
      tick: 1,
      grid: makeValidGrid(),
      players: [makeValidPlayer()],
      bombs: [{ id: 'b1', x: 50, y: 0, ownerId: 'p1', range: 2, explodesIn: 3000 }],
    };
    expect(validateStatePayload(badBomb)).toBeNull();

    const dupBomb = {
      tick: 1,
      grid: makeValidGrid(),
      players: [makeValidPlayer()],
      bombs: [
        { id: 'b1', x: 0, y: 0, ownerId: 'p1', range: 2, explodesIn: 3000 },
        { id: 'b1', x: 1, y: 1, ownerId: 'p1', range: 2, explodesIn: 3000 },
      ],
    };
    expect(validateStatePayload(dupBomb)).toBeNull();
  });
});
