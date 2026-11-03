import { DIRECTIONS } from '../../../shared/index.js';
import { createGrid, isWalkable, SPAWN_POINTS } from './grid.js';

/** Décalage appliqué par chaque direction. */
const STEPS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

/**
 * Crée une partie : grille neuve et joueurs placés sur le départ de leur slot.
 *
 * @param {{ id: string, pseudo: string, slot: number }[]} players
 * @param {() => number} [random] - Transmis à createGrid.
 * @returns {{ grid: import('../../../shared/index.js').Grid, players: import('../../../shared/index.js').GamePlayer[] }}
 */
export function createGame(players, random) {
  return {
    grid: createGrid(random),
    players: players.map(({ id, pseudo, slot }) => ({
      id,
      pseudo,
      slot,
      ...SPAWN_POINTS[slot - 1],
      alive: true,
      maxBombs: 1,
      range: 1,
      speed: 1,
    })),
  };
}

/**
 * Avance le joueur d'une case si la direction est valide et la case libre.
 *
 * @param {ReturnType<typeof createGame>} game
 * @param {string} playerId
 * @param {unknown} direction - Valeur reçue du client, vérifiée ici.
 * @returns {boolean} Vrai si le joueur a bougé.
 */
export function movePlayer(game, playerId, direction) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player?.alive || !DIRECTIONS.includes(direction)) return false;

  const x = player.x + STEPS[direction].x;
  const y = player.y + STEPS[direction].y;
  if (!isWalkable(game.grid, x, y)) return false;

  player.x = x;
  player.y = y;
  return true;
}

/**
 * Contenu du message server:state.
 *
 * @param {ReturnType<typeof createGame>} game
 * @param {number} tick
 * @returns {import('../../../shared/index.js').StatePayload}
 */
export function stateOf(game, tick) {
  return {
    tick,
    grid: game.grid,
    players: game.players,
    bombs: [],
    explosions: [],
    bonuses: [],
  };
}

/**
 * Indique si la partie est finie : un seul joueur vivant ou aucun.
 *
 * @param {ReturnType<typeof createGame>} game
 * @returns {{ over: boolean, winnerId: string | null }}
 */
export function winnerOf(game) {
  const alive = game.players.filter((player) => player.alive);
  return { over: alive.length <= 1, winnerId: alive.length === 1 ? alive[0].id : null };
}
