import { createArenaView } from '../arena/view';
import type { ArenaView } from '../arena/view';
import type { StartPayload, StatePayload } from '../../../shared/index.js';
import { createKeyboardControls } from '../inputs/keyboard';
import type { GameControls } from '../inputs/types';
import type { GameTransport, GameTransportObserver } from '../session/types';
import { validateStartPayload, validateStatePayload } from './validator';

export interface GameCoordinatorOptions {
  host: HTMLElement;
  transport: GameTransport;
  playerId: () => string | undefined;
  controlsFactory?: (
    canvasOrHandlers: HTMLCanvasElement | {
      onMove: (direction: Parameters<GameTransport['sendMove']>[0]) => void;
      onBomb: () => void;
    },
    maybeHandlers?: {
      onMove: (direction: Parameters<GameTransport['sendMove']>[0]) => void;
      onBomb: () => void;
    },
  ) => GameControls;
  viewFactory?: (host: HTMLElement, playerId: string, signal: AbortSignal) => Promise<ArenaView>;
  onGameStart?: (payload: StartPayload) => void;
  onGameOver?: (payload: unknown) => void;
  onLobbyUpdate?: (payload: unknown) => void;
  onError?: (payload: unknown) => void;
}

function enableControls(controls: GameControls | undefined): void {
  if (!controls) return;
  if (typeof controls.setEnabled === 'function') {
    controls.setEnabled(true);
  } else if (typeof controls.enable === 'function') {
    controls.enable();
  }
}

function disableControls(controls: GameControls | undefined): void {
  if (!controls) return;
  if (typeof controls.setEnabled === 'function') {
    controls.setEnabled(false);
  } else if (typeof controls.disable === 'function') {
    controls.disable();
  }
}

export function createGameCoordinator(options: GameCoordinatorOptions) {
  const {
    host,
    transport,
    playerId,
    controlsFactory,
    viewFactory = createArenaView,
    onGameStart,
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
      disableControls(controls);
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
      disableControls(controls);
      onGameOver?.(payload);
    },

    onStart(rawStart) {
      const validStart = validateStartPayload(rawStart);
      if (!validStart) return;

      const currentId = playerId();
      if (!currentId) return;

      cleanupGame();

      pendingStart = validStart;
      onGameStart?.(validStart);

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

          const handlers = {
            onMove: (dir: Parameters<GameTransport['sendMove']>[0]) => transport.sendMove(dir),
            onBomb: () => transport.sendBomb(),
          };

          if (controlsFactory) {
            controls = controlsFactory.length <= 1
              ? (controlsFactory as (h: typeof handlers) => GameControls)(handlers)
              : controlsFactory(view.element, handlers);
          } else {
            controls = createKeyboardControls(view.element, handlers);
          }

          enableControls(controls);

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
