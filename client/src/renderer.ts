import { createEventBus } from './core/event-bus';
import { createSocketTransport } from './network/socket-client';
import { createSession } from './session/session';
import type { SessionEvents } from './session/types';
import { mountConnectionView } from './ui/connection-view';
import { mountLobbyView } from './ui/lobby-view';
import { createGameCoordinator } from './game/coordinator';

const bus = createEventBus<SessionEvents>();
const transport = createSocketTransport();
const session = createSession(bus, transport);

const unmountConnection = mountConnectionView(document, bus, session.getState());
const lobbyView = mountLobbyView({ root: document, transport });

const gameArenaSection = document.querySelector<HTMLElement>('#game-arena-section');
const arenaHost = document.querySelector<HTMLElement>('#arena-host');
const gameInfo = document.querySelector<HTMLElement>('#game-info');
const leaveButton = document.querySelector<HTMLButtonElement>('#game-leave-button');

let coordinator: ReturnType<typeof createGameCoordinator> | undefined;

if (arenaHost) {
  coordinator = createGameCoordinator({
    host: arenaHost,
    transport,
    playerId: () => {
      const state = session.getState();
      return state.status === 'connected' ? state.playerId : undefined;
    },
    onLobbyUpdate: (data) => {
      lobbyView.updateLobby(data);
    },
    onGameOver: (payload) => {
      if (gameInfo) {
        const p = payload as { winnerId?: string | null } | undefined;
        gameInfo.textContent = p?.winnerId ? `Victoire du joueur ${p.winnerId} !` : 'Fin de partie : Égalité !';
      }
    },
  });
}

function handleSessionChange(state: ReturnType<typeof session.getState>) {
  if (state.status === 'connected') {
    lobbyView.setVisible(true);
  } else {
    lobbyView.setVisible(false);
    if (gameArenaSection) gameArenaSection.hidden = true;
    coordinator?.dispose();
  }
}

const offSession = bus.on('session:changed', handleSessionChange);

const originalOnStart = transport.connect;
transport.connect = (address, observe) => {
  return originalOnStart(address, (state) => {
    observe(state);
    if (state.status !== 'connected' && gameArenaSection) {
      gameArenaSection.hidden = true;
    }
  });
};

const observerWrapper = {
  onStart: () => {
    if (gameArenaSection) {
      gameArenaSection.hidden = false;
    }
    if (gameInfo) {
      gameInfo.textContent = 'Partie en cours';
    }
  },
};

const existingSetObserver = transport.setObserver.bind(transport);
transport.setObserver = (obs) => {
  if (!obs) {
    existingSetObserver(null);
    return;
  }
  const prevStart = obs.onStart;
  obs.onStart = (payload) => {
    observerWrapper.onStart();
    prevStart?.(payload);
  };
  existingSetObserver(obs);
};

if (arenaHost) {
  coordinator = createGameCoordinator({
    host: arenaHost,
    transport,
    playerId: () => {
      const state = session.getState();
      return state.status === 'connected' ? state.playerId : undefined;
    },
    onLobbyUpdate: (data) => {
      lobbyView.updateLobby(data);
    },
    onGameOver: (payload) => {
      if (gameInfo) {
        const p = payload as { winnerId?: string | null } | undefined;
        gameInfo.textContent = p?.winnerId ? `Victoire du joueur ${p.winnerId} !` : 'Fin de partie : Égalité !';
      }
    },
  });
}

function handleLeave() {
  if (gameArenaSection) gameArenaSection.hidden = true;
  bus.emit('connection:closed', undefined);
}

leaveButton?.addEventListener('click', handleLeave);

window.addEventListener(
  'beforeunload',
  () => {
    offSession();
    leaveButton?.removeEventListener('click', handleLeave);
    unmountConnection();
    lobbyView.dispose();
    coordinator?.dispose();
    session.dispose();
  },
  { once: true },
);
