/** Directions possibles pour client:move. */
export const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);

/** Bonus lâchés par une brique détruite. */
export const BONUS_TYPES = Object.freeze(['bomb', 'fire', 'speed']);

/** @typedef {'up' | 'down' | 'left' | 'right'} Direction */
/** @typedef {'bomb' | 'fire' | 'speed'} BonusType */

/**
 * slot va de 1 à 4 et donne la couleur et le coin de départ.
 * @typedef {{ id: string, pseudo: string, slot: number, ready: boolean }} LobbyPlayer
 */
/** @typedef {{ id: string, pseudo: string, slot: number, x: number, y: number, alive: boolean, maxBombs: number, range: number, speed: number }} GamePlayer */
/**
 * explodesIn est en millisecondes.
 * @typedef {{ id: string, ownerId: string, x: number, y: number, range: number, explodesIn: number }} Bomb
 */
/** @typedef {{ bombId: string, cells: { x: number, y: number }[] }} Explosion */
/** @typedef {{ x: number, y: number, type: BonusType }} Bonus */
