import { createArenaView } from '../arena/view';
import type { ArenaView } from '../arena/view';
import type { StartPayload, StatePayload } from '../../../shared/index.js';
import type { GameControls } from '../inputs/types';
import type { GameTransport, GameTransportObserver } from '../session/types';
import { validateStartPayload, validateStatePayload } from './validator';

export interface GameCoordinatorOptions {
  host: HTMLElement;
  transport: GameTransport;
  playerId: () => string | undefined;
  controlsFactory?: (handlers: {
    onMove: (direction: Parameters<GameTransport['sendMove']>[0]) => void;
    onBomb: () => void;
  }) => GameControls;
  viewFactory?: (host: HTMLElement, playerId: string, signal: AbortSignal) => Promise<ArenaView>;
  onGameOver?: (payload: unknown) => void;
  onLobbyUpdate?: (payload: unknown) => void;
  onError?: (payload: unknown) => void;
}

export function createGameCoordinator(options: GameCoordinatorOptions) {
  const {
    host,
    transport,
    playerId,
    controlsFactory,
    viewFactory = createArenaView,
    onGameOver,
    onLobbyUpdate,
    onError,
  } = options;

  let currentView: ArenaView | undefined;
  let controls: GameControls | undefined;
  let abortController: AbortController | undefined;
  let pendingStart: StartPayload | null = null;
  let pendingState: StatePayload | null = null;
  let lastTick = -1;
  let isMounted = false;

  function cleanupGame() {
    transport.setGameActive(false);
    if (abortController) {
      abortController.abort();
      abortController = undefined;
    }
    if (controls) {
      controls.disable();
      controls.destroy();
      controls = undefined;
    }
    if (currentView) {
      currentView.destroy();
      currentView = undefined;
    }
    pendingStart = null;
    pendingState = null;
    lastTick = -1;
    isMounted = false;
  }

  const observer: GameTransportObserver = {
    onLobby(payload) {
      onLobbyUpdate?.(payload);
    },

    onError(payload) {
      onError?.(payload);
    },

    onOver(payload) {
      transport.setGameActive(false);
      controls?.disable();
      onGameOver?.(payload);
    },

    onStart(rawStart) {
      const validStart = validateStartPayload(rawStart);
      if (!validStart) return;

      const currentId = playerId();
      if (!currentId) return;

      cleanupGame();

      pendingStart = validStart;
      abortController = new AbortController();
      const signal = abortController.signal;

      viewFactory(host, currentId, signal)
        .then((view) => {
          if (signal.aborted) {
            view.destroy();
            return;
          }

          currentView = view;
          isMounted = true;

          view.setSnapshot({
            grid: validStart.grid,
            players: validStart.players,
            bombs: [],
          });

          if (pendingState) {
            view.setSnapshot(pendingState);
            lastTick = pendingState.tick;
            pendingState = null;
          }

          transport.setGameActive(true);

          if (controlsFactory) {
            controls = controlsFactory({
              onMove: (dir) => transport.sendMove(dir),
              onBomb: () => transport.sendBomb(),
            });
            controls.enable();
          }

          view.focus();
        })
        .catch(() => {
          cleanupGame();
        });
    },

    onState(rawState) {
      if (!pendingStart && !isMounted) return;

      const validState = validateStatePayload(rawState);
      if (!validState) return;

      if (validState.tick <= lastTick) return;

      if (!isMounted || !currentView) {
        if (!pendingState || validState.tick > pendingState.tick) {
          pendingState = validState;
        }
        return;
      }

      lastTick = validState.tick;
      currentView.setSnapshot(validState);
    },
  };

  transport.setObserver(observer);

  return {
    dispose() {
      transport.setObserver(null);
      cleanupGame();
    },
  };
}
