import type { StatePayload } from '../../../shared/index.js';

/** Observation validée par l'appelant ; le rendu ne consomme aucune intention. */
export type ArenaSnapshot = Pick<StatePayload, 'grid' | 'players' | 'bombs'>;
