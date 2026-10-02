import { createArenaView } from '../src/arena/view';
import { createKeyboardControls } from '../src/inputs/keyboard';
import { createEventBus } from '../src/core/event-bus';
import { bindArena } from '../src/game/bind-arena';
import type { ArenaEvents } from '../src/game/arena-events';
import { previewState } from './scenarios';

async function main(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#arena')!;
  const status = document.querySelector<HTMLElement>('#status')!;
  const log = document.querySelector<HTMLElement>('#intent')!;
  const bus = createEventBus<ArenaEvents>();
  const controller = new AbortController();
  window.addEventListener('beforeunload', () => controller.abort(), { once: true });
  try {
    const view = await createArenaView(host, 'player-1', controller.signal);
    const controls = createKeyboardControls(view.element, bus);
    const dispose = bindArena(bus, view, controls, 'player-1');
    controller.signal.addEventListener('abort', dispose, { once: true });
    let count = 0;
    const subscriptions = [
      bus.on('player:move-requested', ({ direction }) => {
        log.textContent = `Intention ${++count} : déplacement ${direction}. En attente d’un état serveur.`;
      }),
      bus.on('player:bomb-requested', () => {
        log.textContent = `Intention ${++count} : poser une bombe. En attente d’un état serveur.`;
      }),
    ];
    controller.signal.addEventListener('abort', () => subscriptions.forEach((off) => off()), { once: true });
    const labels = ['Positions de départ', 'Positions actualisées', 'Deux bombes affichées', 'Bombes retirées, Nino absent'];
    document.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach((button) => {
      button.disabled = false;
      button.addEventListener('click', () => {
        const frame = Number(button.dataset.frame);
        const state = previewState(frame);
        bus.emit('arena:started', state); bus.emit('arena:updated', state);
        document.querySelectorAll('[data-frame]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        document.querySelector('#player-4')?.classList.toggle('absent', frame === 3);
        status.textContent = labels[frame];
      }, { signal: controller.signal });
    });
    document.querySelector<HTMLButtonElement>('#stop')!.disabled = false;
    document.querySelector<HTMLButtonElement>('#stop')!.addEventListener('click', () => {
      bus.emit('arena:stopped', undefined); status.textContent = 'Session arrêtée. Contrôles désactivés.';
      document.querySelectorAll('[data-frame]').forEach((item) => item.setAttribute('aria-pressed', 'false'));
    }, { signal: controller.signal });
    bus.emit('arena:started', previewState(0)); status.textContent = labels[0];
  } catch (error) {
    status.textContent = controller.signal.aborted ? 'Aperçu fermé.' : 'Impossible d’initialiser le rendu WebGL.';
    console.error(error);
  }
}
void main();
