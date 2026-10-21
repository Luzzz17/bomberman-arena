import type { Direction } from '../../../shared/index.js';

export interface KeyboardCallbacks {
  onMove(direction: Direction): void;
  onBomb(): void;
}

export interface KeyboardControls {
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

const directions = new Map<string, Direction>([
  ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
  // Les positions physiques WASD correspondent à ZQSD sur un clavier AZERTY.
  ['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'],
]);

/** Produit une intention par appui, sans connaître le réseau ni les règles du jeu. */
export function createKeyboardControls(
  canvas: HTMLCanvasElement,
  callbacks: KeyboardCallbacks,
): KeyboardControls {
  const document = canvas.ownerDocument;
  const window = document.defaultView;
  const pressed = new Set<string>();
  let enabled = false;
  let destroyed = false;
  const clear = () => { pressed.clear(); };

  function keydown(event: KeyboardEvent): void {
    if (!enabled || destroyed || document.hidden || document.activeElement !== canvas) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    const target = event.target as Element | null;
    if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    const direction = directions.get(event.code);
    if (!direction && event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat || pressed.has(event.code)) return;
    pressed.add(event.code);
    if (direction) callbacks.onMove(direction);
    else callbacks.onBomb();
  }

  function keyup(event: KeyboardEvent): void { pressed.delete(event.code); }

  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('blur', clear);
  document.addEventListener('keyup', keyup);
  document.addEventListener('visibilitychange', clear);
  window?.addEventListener('blur', clear);

  return {
    setEnabled(value) {
      enabled = value && !destroyed;
      if (!enabled) clear();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      enabled = false;
      clear();
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('blur', clear);
      document.removeEventListener('keyup', keyup);
      document.removeEventListener('visibilitychange', clear);
      window?.removeEventListener('blur', clear);
    },
  };
}
