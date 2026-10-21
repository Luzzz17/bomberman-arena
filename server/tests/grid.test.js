import { describe, it, expect } from 'vitest';
import { createGrid, isWalkable, SPAWN_POINTS } from '../src/game/grid.js';
import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../shared/index.js';

/** Cases où createGrid peut placer une brique. */
function brickCandidates(grid) {
  const cells = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const nearSpawn = SPAWN_POINTS.some((spawn) => Math.abs(spawn.x - x) + Math.abs(spawn.y - y) <= 1);
      if (grid[y][x] !== CELL.WALL && !nearSpawn) cells.push(grid[y][x]);
    }
  }

  return cells;
}

describe('createGrid', () => {
  it('génère un plateau aux dimensions du protocole', () => {
    const grid = createGrid();

    expect(grid).toHaveLength(MAP_HEIGHT);
    grid.forEach((row) => expect(row).toHaveLength(MAP_WIDTH));
  });

  it('entoure le plateau de murs', () => {
    const grid = createGrid(() => 1);

    for (let x = 0; x < MAP_WIDTH; x++) {
      expect(grid[0][x]).toBe(CELL.WALL);
      expect(grid[MAP_HEIGHT - 1][x]).toBe(CELL.WALL);
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      expect(grid[y][0]).toBe(CELL.WALL);
      expect(grid[y][MAP_WIDTH - 1]).toBe(CELL.WALL);
    }
  });

  it('place un pilier sur les cases de coordonnées paires', () => {
    const grid = createGrid(() => 1);

    expect(grid[2][2]).toBe(CELL.WALL);
    expect(grid[4][6]).toBe(CELL.WALL);
    expect(grid[2][3]).not.toBe(CELL.WALL);
  });

  it('laisse chaque départ et ses voisines libres, même plateau plein', () => {
    const grid = createGrid(() => 0);

    expect(SPAWN_POINTS).toHaveLength(4);
    for (const { x, y } of SPAWN_POINTS) {
      const horizontal = x === 1 ? x + 1 : x - 1;
      const vertical = y === 1 ? y + 1 : y - 1;

      expect(grid[y][x]).toBe(CELL.EMPTY);
      expect(grid[y][horizontal]).toBe(CELL.EMPTY);
      expect(grid[vertical][x]).toBe(CELL.EMPTY);
    }
  });

  it('remplit toutes les cases libres de briques quand le tirage est au plus bas', () => {
    const cells = brickCandidates(createGrid(() => 0));

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((cell) => cell === CELL.BRICK)).toBe(true);
  });

  it('ne place aucune brique quand le tirage est au plus haut', () => {
    const cells = brickCandidates(createGrid(() => 1));

    expect(cells.every((cell) => cell === CELL.EMPTY)).toBe(true);
  });

  it('renvoie un plateau indépendant à chaque appel', () => {
    const first = createGrid(() => 1);
    const second = createGrid(() => 1);

    first[1][1] = CELL.BRICK;

    expect(second[1][1]).toBe(CELL.EMPTY);
  });
});

describe('isWalkable', () => {
  const grid = createGrid(() => 0);

  it('accepte une case vide', () => {
    expect(isWalkable(grid, 1, 1)).toBe(true);
  });

  it('refuse un mur et une brique', () => {
    expect(isWalkable(grid, 0, 0)).toBe(false);
    expect(isWalkable(grid, 3, 1)).toBe(false);
  });

  it('refuse une case hors du plateau', () => {
    expect(isWalkable(grid, -1, 1)).toBe(false);
    expect(isWalkable(grid, 1, -1)).toBe(false);
    expect(isWalkable(grid, MAP_WIDTH, 1)).toBe(false);
    expect(isWalkable(grid, 1, MAP_HEIGHT)).toBe(false);
  });
});
