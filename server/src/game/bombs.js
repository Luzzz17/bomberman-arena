/** Durée de la mèche d'une bombe, en millisecondes. */
export const BOMB_TIMER = 3000;

/**
 * Indique si une bombe est posée sur la case.
 *
 * @param {{ bombs: import('../../../shared/index.js').Bomb[] }} game
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function hasBomb(game, x, y) {
  return game.bombs.some((bomb) => bomb.x === x && bomb.y === y);
}

/**
 * Pose une bombe sur la case du joueur si les règles l'autorisent.
 *
 * @param {{ players: import('../../../shared/index.js').GamePlayer[], bombs: import('../../../shared/index.js').Bomb[], nextBombId: number }} game
 * @param {string} playerId
 * @returns {boolean} Vrai si la bombe a été posée.
 */
export function placeBomb(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player?.alive) return false;

  const ownBombs = game.bombs.filter((bomb) => bomb.ownerId === playerId).length;
  if (ownBombs >= player.maxBombs || hasBomb(game, player.x, player.y)) return false;

  game.bombs.push({
    id: String(game.nextBombId++),
    ownerId: playerId,
    x: player.x,
    y: player.y,
    range: player.range,
    explodesIn: BOMB_TIMER,
  });
  return true;
}

/**
 * Fait avancer les mèches et retire les bombes arrivées à zéro.
 *
 * @param {{ bombs: import('../../../shared/index.js').Bomb[] }} game
 * @param {number} elapsed - Temps écoulé, en millisecondes.
 * @returns {import('../../../shared/index.js').Bomb[]} Bombes retirées pendant cet appel.
 */
export function updateBombs(game, elapsed) {
  game.bombs.forEach((bomb) => {
    bomb.explodesIn -= elapsed;
  });

  const expired = game.bombs.filter((bomb) => bomb.explodesIn <= 0);
  game.bombs = game.bombs.filter((bomb) => bomb.explodesIn > 0);
  return expired;
}
