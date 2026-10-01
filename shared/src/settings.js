/** Règles de partie communes au client et au serveur. */
export const GAME_SETTINGS = Object.freeze({
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  PSEUDO_MIN_LENGTH: 1,
  PSEUDO_MAX_LENGTH: 16,
  /** Envois de server:state par seconde. */
  TICK_RATE: 20,
});
