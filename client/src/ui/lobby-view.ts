import type { LobbyPayload } from '../../../shared/index.js';
import type { GameTransport } from '../session/types';

export interface LobbyViewOptions {
  root: ParentNode;
  transport: GameTransport;
  playerId: () => string | undefined;
}

/** Confirme l'adhésion avec l'identité serveur et permet de corriger un refus. */
export function mountLobbyView({ root, transport, playerId }: LobbyViewOptions) {
  const container = root.querySelector<HTMLElement>('#lobby-section');
  const pseudoInput = root.querySelector<HTMLInputElement>('#lobby-pseudo');
  const joinButton = root.querySelector<HTMLButtonElement>('#lobby-join-button');
  const readyButton = root.querySelector<HTMLButtonElement>('#lobby-ready-button');
  const lobbyStatus = root.querySelector<HTMLElement>('#lobby-status');

  if (!container || !pseudoInput || !joinButton || !readyButton || !lobbyStatus) {
    return {
      updateLobby: () => {},
      showError: () => {},
      setVisible: () => {},
      dispose: () => {},
    };
  }

  const formContainer = container;
  const input = pseudoInput;
  const btnJoin = joinButton;
  const btnReady = readyButton;
  const statusEl = lobbyStatus;

  let isReady = false;
  let membership: 'idle' | 'joining' | 'joined' = 'idle';
  let joinError: string | null = null;

  function updateControls() {
    btnJoin.disabled = membership !== 'idle';
    input.disabled = membership !== 'idle';
    btnReady.disabled = membership !== 'joined';
    btnReady.textContent = isReady ? 'Prêt ! (Cliquer pour annuler)' : 'Je suis prêt';
  }

  function setVisible(visible: boolean) {
    formContainer.hidden = !visible;
    if (!visible) {
      isReady = false;
      membership = 'idle';
      joinError = null;
      updateControls();
      statusEl.textContent = '';
    }
  }

  function handleJoin() {
    if (membership !== 'idle') return;
    const pseudo = input.value.trim();
    if (!pseudo) return;
    membership = 'joining';
    joinError = null;
    updateControls();
    statusEl.textContent = 'Demande envoyée, en attente du serveur…';
    if (!transport.sendJoin(pseudo)) {
      membership = 'idle';
      joinError = 'Impossible d’envoyer la demande. Vérifie la connexion.';
      updateControls();
      statusEl.textContent = joinError;
    }
  }

  function handleReady() {
    if (membership !== 'joined') return;
    isReady = !isReady;
    transport.sendReady(isReady);
    btnReady.textContent = isReady ? 'Prêt ! (Cliquer pour annuler)' : 'Je suis prêt';
  }

  btnJoin.addEventListener('click', handleJoin);
  btnReady.addEventListener('click', handleReady);

  function updateLobby(rawPayload: unknown) {
    if (typeof rawPayload !== 'object' || rawPayload === null) return;
    const payload = rawPayload as LobbyPayload;
    if (!Array.isArray(payload.players) || !payload.players.every((p) =>
      p !== null && typeof p === 'object' && typeof p.id === 'string' &&
      typeof p.pseudo === 'string' && typeof p.ready === 'boolean',
    )) return;

    // Un autre joueur peut avoir le même pseudo que la demande refusée.
    const localPlayer = payload.players.find((p) => p.id === playerId());
    if (localPlayer) {
      membership = 'joined';
      joinError = null;
      isReady = localPlayer.ready;
    } else if (membership === 'joined') {
      membership = 'idle';
      isReady = false;
    }
    updateControls();
    if (membership === 'joining' || joinError) return;

    const count = payload.players.length;
    const readyCount = payload.players.filter((p) => p.ready).length;
    const playerNames = payload.players.map((p) => `${p.pseudo}${p.ready ? ' (prêt)' : ''}`).join(', ');

    statusEl.textContent = `${count} joueur(s) (${readyCount} prêt(s)) : ${playerNames || 'aucun'}`;
  }

  /** Un refus d'adhésion rend la saisie disponible, sans interpréter le message en HTML. */
  function showError(payload: unknown) {
    if (membership !== 'joining' || typeof payload !== 'object' || payload === null) return;
    if (!('code' in payload) || typeof payload.code !== 'string' ||
      !('message' in payload) || typeof payload.message !== 'string' || !payload.message.trim()) return;
    membership = 'idle';
    isReady = false;
    joinError = payload.message;
    updateControls();
    statusEl.textContent = joinError;
    if (!formContainer.hidden) input.focus();
  }

  return {
    setVisible,
    updateLobby,
    showError,
    dispose() {
      btnJoin.removeEventListener('click', handleJoin);
      btnReady.removeEventListener('click', handleReady);
    },
  };
}
