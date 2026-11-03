import { ERROR_CODES, GAME_SETTINGS } from '../../../shared/index.js';

/**
 * Crée un lobby vide.
 *
 * @returns {{ players: import('../../../shared/index.js').LobbyPlayer[] }}
 */
export function createLobby() {
  return { players: [] };
}

/** Plus petit slot de 1 à MAX_PLAYERS non utilisé. */
function freeSlot(lobby) {
  let slot = 1;
  while (lobby.players.some((player) => player.slot === slot)) slot++;
  return slot;
}

/**
 * Ajoute un joueur au lobby.
 *
 * @param {ReturnType<typeof createLobby>} lobby
 * @param {string} id
 * @param {unknown} pseudo - Valeur reçue du client, vérifiée ici.
 * @returns {string | null} Code d'erreur, ou null si le joueur a rejoint.
 */
export function joinLobby(lobby, id, pseudo) {
  if (typeof pseudo !== 'string') return ERROR_CODES.INVALID_PAYLOAD;
  if (lobby.players.length >= GAME_SETTINGS.MAX_PLAYERS) return ERROR_CODES.LOBBY_FULL;

  const name = pseudo.trim();
  if (name.length < GAME_SETTINGS.PSEUDO_MIN_LENGTH || name.length > GAME_SETTINGS.PSEUDO_MAX_LENGTH) {
    return ERROR_CODES.INVALID_PSEUDO;
  }
  if (lobby.players.some((player) => player.pseudo === name)) return ERROR_CODES.PSEUDO_TAKEN;

  lobby.players.push({ id, pseudo: name, slot: freeSlot(lobby), ready: false });
  return null;
}

/**
 * Change l'état prêt d'un joueur.
 *
 * @param {ReturnType<typeof createLobby>} lobby
 * @param {string} id
 * @param {unknown} ready - Valeur reçue du client, vérifiée ici.
 * @returns {string | null} Code d'erreur, ou null si l'état a changé.
 */
export function setReady(lobby, id, ready) {
  const player = lobby.players.find((p) => p.id === id);
  if (!player) return ERROR_CODES.NOT_IN_LOBBY;
  if (typeof ready !== 'boolean') return ERROR_CODES.INVALID_PAYLOAD;

  player.ready = ready;
  return null;
}

/**
 * Retire un joueur du lobby.
 *
 * @param {ReturnType<typeof createLobby>} lobby
 * @param {string} id
 * @returns {boolean} Vrai si le joueur était dans le lobby.
 */
export function leaveLobby(lobby, id) {
  const count = lobby.players.length;
  lobby.players = lobby.players.filter((player) => player.id !== id);
  return lobby.players.length < count;
}

/** Remet tous les joueurs à « pas prêt », pour le retour au lobby. */
export function resetReady(lobby) {
  lobby.players.forEach((player) => {
    player.ready = false;
  });
}

/** Vrai si le lobby compte assez de joueurs et qu'ils sont tous prêts. */
export function canStart(lobby) {
  const count = lobby.players.length;
  return count >= GAME_SETTINGS.MIN_PLAYERS
    && count <= GAME_SETTINGS.MAX_PLAYERS
    && lobby.players.every((player) => player.ready);
}

/**
 * Contenu du message server:lobby.
 *
 * @param {ReturnType<typeof createLobby>} lobby
 * @returns {import('../../../shared/index.js').LobbyPayload}
 */
export function lobbyPayload(lobby) {
  return {
    players: lobby.players.map((player) => ({ ...player })),
    minPlayers: GAME_SETTINGS.MIN_PLAYERS,
    maxPlayers: GAME_SETTINGS.MAX_PLAYERS,
    canStart: canStart(lobby),
  };
}
