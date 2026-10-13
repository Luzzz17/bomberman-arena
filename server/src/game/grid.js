import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../../shared/index.js';

/** Part des cases libres remplies par une brique. */
const BRICK_RATE = 0.75;

/** Cases de départ, dans l'ordre des slots 1 à 4. */
export const SPAWN_POINTS = Object.freeze([
  { x: 1, y: 1 },
  { x: MAP_WIDTH - 2, y: 1 },
  { x: 1, y: MAP_HEIGHT - 2 },
  { x: MAP_WIDTH - 2, y: MAP_HEIGHT - 2 },
]);

/** Vrai si la case est sur le bord du plateau ou sur un pilier. */
function isWall(x, y) {
  const onBorder = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
  return onBorder || (x % 2 === 0 && y % 2 === 0);
}

/** Vrai si la case est un départ ou une de ses voisines directes. */
function isSpawnArea(x, y) {
  return SPAWN_POINTS.some((spawn) => Math.abs(spawn.x - x) + Math.abs(spawn.y - y) <= 1);
}

/**
 * Génère un plateau neuf : murs fixes, briques aléatoires, départs dégagés.
 *
 * @param {() => number} [random] - Tirage entre 0 et 1, remplaçable dans les tests.
 * @returns {import('../../../shared/index.js').Grid}
 */
export function createGrid(random = Math.random) {
  const grid = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row = [];

    for (let x = 0; x < MAP_WIDTH; x++) {
      if (isWall(x, y)) {
        row.push(CELL.WALL);
      } else if (isSpawnArea(x, y)) {
        row.push(CELL.EMPTY);
      } else {
        row.push(random() < BRICK_RATE ? CELL.BRICK : CELL.EMPTY);
      }
    }

    grid.push(row);
  }

  return grid;
}

/**
 * Indique si un joueur peut entrer sur la case.
 *
 * @param {import('../../../shared/index.js').Grid} grid
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isWalkable(grid, x, y) {
  const inside = x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
  return inside && grid[y][x] === CELL.EMPTY;
}
