import { createArenaView } from '../src/arena/view';
import { previewState } from './scenarios';

async function main(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#arena')!;
  const status = document.querySelector<HTMLElement>('#status')!;
  const controller = new AbortController();
  window.addEventListener('beforeunload', () => controller.abort(), { once: true });
  try {
    const view = await createArenaView(host, 'player-1', controller.signal);
    const labels = ['Positions de départ', 'Positions actualisées', 'Deux bombes affichées', 'Bombes retirées'];
    document.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach((button) => {
      button.disabled = false;
      button.addEventListener('click', () => {
        const frame = Number(button.dataset.frame);
        const state = previewState(frame);
        view.setSnapshot(state);
        document.querySelectorAll('[data-frame]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        status.textContent = labels[frame];
      }, { signal: controller.signal });
    });
    document.querySelector<HTMLButtonElement>('#stop')!.disabled = false;
    document.querySelector<HTMLButtonElement>('#stop')!.addEventListener('click', () => {
      view.clear(); status.textContent = 'Affichage vidé.';
      document.querySelectorAll('[data-frame]').forEach((item) => item.setAttribute('aria-pressed', 'false'));
    }, { signal: controller.signal });
    view.setSnapshot(previewState(0)); status.textContent = labels[0];
  } catch (error) {
    status.textContent = controller.signal.aborted ? 'Aperçu fermé.' : 'Impossible d’initialiser le rendu WebGL.';
    console.error(error);
  }
}
void main();
