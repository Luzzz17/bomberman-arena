/**
 * @typedef {import('./map.js').Grid} Grid
 * @typedef {import('./entities.js').Direction} Direction
 * @typedef {import('./entities.js').LobbyPlayer} LobbyPlayer
 * @typedef {import('./entities.js').GamePlayer} GamePlayer
 * @typedef {import('./entities.js').Bomb} Bomb
 * @typedef {import('./entities.js').Explosion} Explosion
 * @typedef {import('./entities.js').Bonus} Bonus
 */

/** Version du protocole, envoyée dans server:welcome. */
export const PROTOCOL_VERSION = 1;

/** Messages envoyés par le client. */
export const CLIENT_EVENTS = Object.freeze({
  JOIN: 'client:join',
  READY: 'client:ready',
  MOVE: 'client:move',
  BOMB: 'client:bomb',
});

/** Messages envoyés par le serveur. */
export const SERVER_EVENTS = Object.freeze({
  WELCOME: 'server:welcome',
  LOBBY: 'server:lobby',
  START: 'server:start',
  STATE: 'server:state',
  OVER: 'server:over',
  ERROR: 'server:error',
});

/** @typedef {{ pseudo: string }} JoinPayload */
/** @typedef {{ ready: boolean }} ReadyPayload */
/** @typedef {{ direction: Direction }} MovePayload */
/** @typedef {Record<string, never>} BombPayload */

/** @typedef {{ id: string, protocolVersion: number }} WelcomePayload */
/** @typedef {{ players: LobbyPlayer[], minPlayers: number, maxPlayers: number, canStart: boolean }} LobbyPayload */
/** @typedef {{ grid: Grid, players: GamePlayer[] }} StartPayload */
/** @typedef {{ tick: number, grid: Grid, players: GamePlayer[], bombs: Bomb[], explosions: Explosion[], bonuses: Bonus[] }} StatePayload */
/**
 * winnerId vaut null en cas d'égalité.
 * @typedef {{ winnerId: string | null }} OverPayload
 */
/**
 * code est une valeur de ERROR_CODES.
 * @typedef {{ code: string, message: string }} ErrorPayload
 */
