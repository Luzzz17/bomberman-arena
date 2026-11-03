import { createGame } from '../src/game/game.js';

export const PLAYERS = [
  { id: 'a', pseudo: 'Alice', slot: 1 },
  { id: 'b', pseudo: 'Bob', slot: 4 },
];

/** Partie avec un plateau rempli de briques hors des zones de départ. */
export function fullGame() {
  return createGame(PLAYERS, () => 0);
}
