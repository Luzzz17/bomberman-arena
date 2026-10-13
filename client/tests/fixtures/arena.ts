import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../../shared/index.js';
import type { ArenaSnapshot } from '../../src/arena/types';

/** Observations fixes de test, sans calcul de règles. */
export function arenaSnapshot(): ArenaSnapshot {
  return {
    grid: Array.from({ length: MAP_HEIGHT }, (_, y) => Array.from({ length: MAP_WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1 ? CELL.WALL : CELL.EMPTY)),
    players: [{ id: 'jay', pseudo: 'Jay', slot: 1, x: 1, y: 1, alive: true, maxBombs: 1, range: 2, speed: 1 }],
    bombs: [{ id: 'b1', ownerId: 'jay', x: 3, y: 1, range: 2, explodesIn: 2000 }],
  };
}
