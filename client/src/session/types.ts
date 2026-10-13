import type { Direction } from '../../../shared/index.js';

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

export interface ConnectionTransport {
  connect(address: string, observe: (state: ConnectionState) => void): () => void;
}

export interface GameTransportObserver {
  onLobby?: (payload: unknown) => void;
  onStart?: (payload: unknown) => void;
  onState?: (payload: unknown) => void;
  onOver?: (payload: unknown) => void;
  onError?: (payload: unknown) => void;
}

export interface GameTransport extends ConnectionTransport {
  setObserver(observer: GameTransportObserver | null): void;
  sendJoin(pseudo: string): boolean;
  sendReady(ready: boolean): boolean;
  sendMove(direction: Direction): boolean;
  sendBomb(): boolean;
  setGameActive(active: boolean): void;
  isGameActive(): boolean;
  isConnected(): boolean;
}
