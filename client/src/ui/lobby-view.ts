import type { LobbyPayload } from '../../../shared/index.js';
import type { GameTransport } from '../session/types';

export interface LobbyViewOptions {
  root: ParentNode;
  transport: GameTransport;
}

export function mountLobbyView({ root, transport }: LobbyViewOptions) {
  const container = root.querySelector<HTMLElement>('#lobby-section');
  const pseudoInput = root.querySelector<HTMLInputElement>('#lobby-pseudo');
  const joinButton = root.querySelector<HTMLButtonElement>('#lobby-join-button');
  const readyButton = root.querySelector<HTMLButtonElement>('#lobby-ready-button');
  const lobbyStatus = root.querySelector<HTMLElement>('#lobby-status');

  if (!container || !pseudoInput || !joinButton || !readyButton || !lobbyStatus) {
    return {
      updateLobby: () => {},
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
  let hasJoined = false;

  function setVisible(visible: boolean) {
    formContainer.hidden = !visible;
    if (!visible) {
      isReady = false;
      hasJoined = false;
      btnReady.disabled = true;
      btnJoin.disabled = false;
      input.disabled = false;
      btnReady.textContent = 'Je suis prêt';
      statusEl.textContent = '';
    }
  }

  function handleJoin() {
    const pseudo = input.value.trim();
    if (!pseudo) return;
    const sent = transport.sendJoin(pseudo);
    if (sent) {
      hasJoined = true;
      btnJoin.disabled = true;
      input.disabled = true;
      btnReady.disabled = false;
      statusEl.textContent = 'Dans le lobby. Clique sur "Je suis prêt" pour lancer.';
    }
  }

  function handleReady() {
    if (!hasJoined) return;
    isReady = !isReady;
    transport.sendReady(isReady);
    btnReady.textContent = isReady ? 'Prêt ! (Cliquer pour annuler)' : 'Je suis prêt';
  }

  btnJoin.addEventListener('click', handleJoin);
  btnReady.addEventListener('click', handleReady);

  function updateLobby(rawPayload: unknown) {
    if (typeof rawPayload !== 'object' || rawPayload === null) return;
    const payload = rawPayload as LobbyPayload;
    if (!Array.isArray(payload.players)) return;

    const count = payload.players.length;
    const readyCount = payload.players.filter((p) => p.ready).length;
    const playerNames = payload.players.map((p) => `${p.pseudo}${p.ready ? ' (prêt)' : ''}`).join(', ');

    statusEl.textContent = `${count} joueur(s) (${readyCount} prêt(s)) : ${playerNames || 'aucun'}`;
  }

  return {
    setVisible,
    updateLobby,
    dispose() {
      btnJoin.removeEventListener('click', handleJoin);
      btnReady.removeEventListener('click', handleReady);
    },
  };
}
