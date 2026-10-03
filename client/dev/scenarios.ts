import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../shared/index.js';
import type { ArenaSnapshot } from '../src/arena/types';

/** Instantanés prédéfinis pour inspecter le rendu ; aucune simulation de partie. */
export function previewState(frame: number): ArenaSnapshot {
  const grid = Array.from({ length: MAP_HEIGHT }, (_, y) => Array.from({ length: MAP_WIDTH }, (_, x) => {
    if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1 || (x % 2 === 0 && y % 2 === 0)) return CELL.WALL;
    // Le scénario de déplacement utilise ce couloir prédéfini, sans moteur local.
    if (x === 11 && y === 3) return CELL.EMPTY;
    if ((x <= 2 || x >= 10) && (y <= 2 || y >= 8)) return CELL.EMPTY;
    return (x + y * 3) % 4 === 0 || (x * 7 + y) % 5 === 0 ? CELL.BRICK : CELL.EMPTY;
  }));
  const positions = [[1, 1], [11, 1], [1, 9], [11, 9]];
  const players = positions.map(([x, y], index) => ({
    id: `player-${index + 1}`, pseudo: ['Jay', 'Milo', 'Luna', 'Nino'][index], slot: index + 1,
    x, y, alive: true, maxBombs: 1, range: 2, speed: 1,
  }));
  if (frame >= 1) { players[0].x = 3; players[1].y = 3; }
  return { grid, players,
    bombs: frame === 2 ? [
      { id: 'bomb-1', ownerId: 'player-1', x: 2, y: 1, range: 2, explodesIn: 2100 },
      { id: 'bomb-2', ownerId: 'player-2', x: 11, y: 2, range: 2, explodesIn: 1500 },
    ] : [],
  };
}
