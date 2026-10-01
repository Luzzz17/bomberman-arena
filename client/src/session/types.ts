/** Dernière observation de connexion, sans simulation du jeu. */
export type ConnectionState =
  | { readonly status: 'disconnected' }
  | { readonly status: 'connecting'; readonly address: string }
  | { readonly status: 'connected'; readonly address: string; readonly playerId: string }
  | { readonly status: 'error'; readonly message: string };

export interface SessionEvents {
  'connection:requested': string;
  'connection:closed': undefined;
  'session:changed': ConnectionState;
}

/** Contrat commun aux transports réels et aux futurs scénarios mock. */
export interface ConnectionTransport {
  connect(address: string, observe: (state: ConnectionState) => void): () => void;
}
