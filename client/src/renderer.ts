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

function initCoordinator() {
  if (!arenaHost) return;
  coordinator?.dispose();
  coordinator = createGameCoordinator({
    host: arenaHost,
    transport,
    playerId: () => {
      const state = session.getState();
      return state.status === 'connected' ? state.playerId : undefined;
    },
    onGameStart: () => {
      if (gameArenaSection) gameArenaSection.hidden = false;
      if (gameInfo) gameInfo.textContent = 'Partie en cours';
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
    initCoordinator();
  } else if (state.status === 'disconnected' || state.status === 'error') {
    lobbyView.setVisible(false);
    if (gameArenaSection) gameArenaSection.hidden = true;
    coordinator?.dispose();
    coordinator = undefined;
  }
}

const offSession = bus.on('session:changed', handleSessionChange);

if (session.getState().status === 'connected') {
  lobbyView.setVisible(true);
  initCoordinator();
}

function handleLeave() {
  if (gameArenaSection) gameArenaSection.hidden = true;
  coordinator?.dispose();
  coordinator = undefined;
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
