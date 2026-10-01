/** Nombre de colonnes du plateau. */
export const MAP_WIDTH = 13;

/** Nombre de lignes du plateau. */
export const MAP_HEIGHT = 11;

/** Contenu d'une case. */
export const CELL = Object.freeze({
  EMPTY: 0,
  WALL: 1,
  BRICK: 2,
});

/**
 * Une case se lit avec grid[y][x], origine en haut à gauche.
 * @typedef {number[][]} Grid
 */
