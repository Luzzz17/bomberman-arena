import type { Direction } from '../../../shared/index.js';
import type { EventBus } from '../core/event-bus';
import type { ArenaEvents } from '../game/arena-events';

export interface KeyboardControls {
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

const directions: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  // Les positions physiques WASD correspondent à ZQSD sur un clavier AZERTY.
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

/** Une intention par pression, sans répétition native ni simulation de mouvement. */
export function createKeyboardControls(host: HTMLElement, bus: EventBus<ArenaEvents>): KeyboardControls {
  const document = host.ownerDocument;
  const window = document.defaultView;
  const pressed = new Set<string>();
  let enabled = false;
  let destroyed = false;
  const clear = () => { pressed.clear(); };

  function keydown(event: KeyboardEvent): void {
    if (!enabled || destroyed || document.hidden || !host.contains(document.activeElement)) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    const target = event.target as Element | null;
    if (target?.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    const direction = directions[event.code];
    if (!direction && event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat || pressed.has(event.code)) return;
    pressed.add(event.code);
    if (direction) bus.emit('player:move-requested', { direction });
    else bus.emit('player:bomb-requested', {});
  }
  function keyup(event: KeyboardEvent): void { pressed.delete(event.code); }

  host.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  host.addEventListener('focusout', clear);
  window?.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  return {
    setEnabled(value) { enabled = value && !destroyed; if (!enabled) clear(); },
    destroy() {
      if (destroyed) return;
      destroyed = true; enabled = false; clear();
      host.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      host.removeEventListener('focusout', clear);
      window?.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    },
  };
}
