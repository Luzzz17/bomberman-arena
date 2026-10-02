import type { BombPayload, MovePayload, StartPayload, StatePayload } from '../../../shared/index.js';

/** Contrat interne proposé au coordinateur, distinct des messages Socket.IO. */
export interface ArenaEvents {
  'arena:started': StartPayload;
  'arena:updated': StatePayload;
  'arena:stopped': undefined;
  'controls:enabled': boolean;
  'player:move-requested': MovePayload;
  'player:bomb-requested': BombPayload;
}

/** Le rendu de phase 2 ne consomme que ces observations, jamais les intentions. */
export type ArenaSnapshot = Pick<StatePayload, 'grid' | 'players' | 'bombs'>;
