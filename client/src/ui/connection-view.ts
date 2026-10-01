import type { EventBus } from '../core/event-bus';
import type { ConnectionState, SessionEvents } from '../session/types';

/** Affiche la session et publie les intentions, sans accès au transport réseau. */
export function mountConnectionView(root: ParentNode, bus: EventBus<SessionEvents>, initial: ConnectionState): () => void {
  const form = root.querySelector<HTMLFormElement>('#connection-form');
  const address = root.querySelector<HTMLInputElement>('#server-address');
  const connect = root.querySelector<HTMLButtonElement>('#connect-button');
  const disconnect = root.querySelector<HTMLButtonElement>('#disconnect-button');
  const status = root.querySelector<HTMLElement>('#connection-status');
  if (!form || !address || !connect || !disconnect || !status) {
    throw new Error('Le formulaire de connexion est incomplet.');
  }

  function render(state: ConnectionState) {
    if (!form || !address || !connect || !disconnect || !status) return;
    const active = state.status === 'connecting' || state.status === 'connected';
    form.dataset.state = state.status;
    connect.disabled = active;
    address.disabled = active;
    disconnect.hidden = !active;
    disconnect.textContent = state.status === 'connecting' ? 'Annuler' : 'Se déconnecter';
    connect.textContent = state.status === 'connecting' ? 'Connexion…' : state.status === 'error' ? 'Réessayer' : 'Se connecter';
    switch (state.status) {
      case 'disconnected': status.textContent = 'Prêt à se connecter.'; break;
      case 'connecting': status.textContent = 'Connexion en cours…'; break;
      case 'connected': status.textContent = 'Connecté au serveur !'; break;
      case 'error': status.textContent = state.message; break;
    }
  }

  function submit(event: Event) {
    event.preventDefault();
    if (connect && address && !connect.disabled) bus.emit('connection:requested', address.value);
  }
  function close() { bus.emit('connection:closed', undefined); }

  form.addEventListener('submit', submit);
  disconnect.addEventListener('click', close);
  const unsubscribe = bus.on('session:changed', render);
  render(initial);
  return () => {
    unsubscribe();
    form.removeEventListener('submit', submit);
    disconnect.removeEventListener('click', close);
  };
}
