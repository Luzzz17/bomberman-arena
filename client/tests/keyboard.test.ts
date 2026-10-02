// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../src/core/event-bus';
import type { ArenaEvents } from '../src/game/arena-events';
import { createKeyboardControls } from '../src/inputs/keyboard';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((dispose) => dispose()); document.body.replaceChildren(); });
function setup() {
  const host = document.createElement('div');
  host.tabIndex = 0;
  document.body.append(host);
  const bus = createEventBus<ArenaEvents>();
  const move = vi.fn(); const bomb = vi.fn();
  bus.on('player:move-requested', move); bus.on('player:bomb-requested', bomb);
  const controls = createKeyboardControls(host, bus);
  cleanups.push(controls.destroy);
  host.focus();
  const key = (code: string, type = 'keydown', options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...options });
    host.dispatchEvent(event); return event;
  };
  return { host, controls, move, bomb, key };
}

describe('Contrôles de l’arène', () => {
  it('reste désactivé au départ puis traduit flèches, touches physiques et espace', () => {
    const { controls, move, bomb, key } = setup();
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(move).not.toHaveBeenCalled();
    controls.setEnabled(true);
    for (const [code, direction] of [['ArrowUp', 'up'], ['KeyW', 'up'], ['KeyA', 'left'], ['KeyS', 'down'], ['KeyD', 'right']]) {
      expect(key(code).defaultPrevented).toBe(true);
      expect(move).toHaveBeenLastCalledWith({ direction }); key(code, 'keyup');
    }
    key('Space'); expect(bomb).toHaveBeenCalledExactlyOnceWith({});
  });
  it('ignore les répétitions et accepte une nouvelle pression après relâchement', () => {
    const { controls, move, bomb, key } = setup(); controls.setEnabled(true);
    key('ArrowRight'); key('ArrowRight'); key('ArrowRight', 'keydown', { repeat: true });
    key('Space'); key('Space', 'keydown', { repeat: true });
    expect(move).toHaveBeenCalledTimes(1); expect(bomb).toHaveBeenCalledTimes(1);
    key('ArrowRight', 'keyup'); key('ArrowRight'); expect(move).toHaveBeenCalledTimes(2);
  });
  it('ne détourne ni les formulaires, ni les raccourcis, ni les touches hors de l’arène', () => {
    const { host, controls, move, key } = setup(); controls.setEnabled(true);
    expect(key('KeyW', 'keydown', { ctrlKey: true }).defaultPrevented).toBe(false);
    const input = document.createElement('input'); host.append(input); input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    const other = document.createElement('button'); document.body.append(other); other.focus(); key('ArrowUp');
    expect(move).not.toHaveBeenCalled();
  });
  it('efface les touches au blur, à la désactivation et détache les écouteurs', () => {
    const { host, controls, move, key } = setup(); controls.setEnabled(true);
    key('ArrowLeft'); window.dispatchEvent(new Event('blur')); host.focus();
    key('ArrowLeft'); expect(move).toHaveBeenCalledTimes(2);
    controls.setEnabled(false); key('ArrowUp'); controls.setEnabled(true); key('ArrowLeft');
    expect(move).toHaveBeenCalledTimes(3);
    controls.destroy(); controls.destroy(); controls.setEnabled(true); key('ArrowDown');
    expect(move).toHaveBeenCalledTimes(3);
  });
});
