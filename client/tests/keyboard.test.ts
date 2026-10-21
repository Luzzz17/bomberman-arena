// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Direction } from '../../shared/index.js';
import { createKeyboardControls } from '../src/inputs/keyboard';

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((destroy) => destroy());
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup() {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  document.body.append(canvas);
  const onMove = vi.fn<(direction: Direction) => void>();
  const onBomb = vi.fn<() => void>();
  const controls = createKeyboardControls(canvas, { onMove, onBomb });
  cleanups.push(controls.destroy);
  canvas.focus();
  const key = (code: string, type = 'keydown', options: KeyboardEventInit = {}, target: EventTarget = canvas) => {
    const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);
    return event;
  };
  return { canvas, controls, onMove, onBomb, key };
}

describe('Commandes clavier', () => {
  it('commence désactivé et ne bloque pas les touches avant activation', () => {
    const { controls, onMove, onBomb, key } = setup();
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(key('Space').defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    expect(onBomb).not.toHaveBeenCalled();
    controls.setEnabled(true);
    key('ArrowUp');
    expect(onMove).toHaveBeenCalledExactlyOnceWith('up');
  });

  it.each<[string, Direction]>([
    ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
    ['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'],
  ])('traduit %s en intention %s', (code, direction) => {
    const { controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    expect(key(code).defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenCalledExactlyOnceWith(direction);
    expect(onBomb).not.toHaveBeenCalled();
  });

  it('utilise les positions physiques sur AZERTY', () => {
    const { controls, onMove, key } = setup();
    controls.setEnabled(true);
    key('KeyW', 'keydown', { key: 'z' });
    key('KeyA', 'keydown', { key: 'q' });
    expect(onMove.mock.calls).toEqual([['up'], ['left']]);
  });

  it('produit une intention de bombe sans argument avec espace', () => {
    const { controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    expect(key('Space').defaultPrevented).toBe(true);
    expect(onBomb).toHaveBeenCalledExactlyOnceWith();
    expect(onMove).not.toHaveBeenCalled();
  });

  it.each(['ArrowRight', 'Space'])('ignore les doublons et répétitions de %s jusqu’au relâchement', (code) => {
    const { controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    const callback = code === 'Space' ? onBomb : onMove;
    expect(key(code, 'keydown', { repeat: true }).defaultPrevented).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    key(code);
    expect(key(code).defaultPrevented).toBe(true);
    expect(key(code, 'keydown', { repeat: true }).defaultPrevented).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    key(code, 'keyup', {}, document);
    key(code);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('garde les touches simultanées indépendantes et conserve leur ordre', () => {
    const { canvas, controls, key } = setup();
    controls.destroy();
    const intentions: string[] = [];
    const ordered = createKeyboardControls(canvas, {
      onMove: (direction) => intentions.push(direction),
      onBomb: () => intentions.push('bomb'),
    });
    cleanups.push(ordered.destroy);
    ordered.setEnabled(true);
    key('KeyW'); key('ArrowUp'); key('KeyD'); key('Space');
    key('KeyW'); key('KeyW', 'keyup'); key('KeyW');
    expect(intentions).toEqual(['up', 'up', 'right', 'bomb', 'up']);
  });

  it('conserve les appuis lorsque l’activation est répétée', () => {
    const { controls, onMove, key } = setup();
    controls.setEnabled(true);
    key('ArrowUp');
    controls.setEnabled(true);
    key('ArrowUp');
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('désactive les commandes et efface les appuis pour la prochaine activation', () => {
    const { controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    key('ArrowUp'); key('Space');
    controls.setEnabled(false);
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(key('Space').defaultPrevented).toBe(false);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onBomb).toHaveBeenCalledTimes(1);
    controls.setEnabled(true);
    key('ArrowUp', 'keydown', { repeat: true });
    key('Space', 'keydown', { repeat: true });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onBomb).toHaveBeenCalledTimes(1);
    key('ArrowUp'); key('Space');
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onBomb).toHaveBeenCalledTimes(2);
  });

  it('n’accepte que le focus exact du canvas', () => {
    const { canvas, controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    const child = document.createElement('input');
    canvas.append(child);
    child.focus();
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(key('Space', 'keydown', {}, child).defaultPrevented).toBe(false);
    const outside = document.createElement('button');
    document.body.append(outside); outside.focus();
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    expect(onBomb).not.toHaveBeenCalled();
    canvas.focus(); key('ArrowUp');
    expect(onMove).toHaveBeenCalledExactlyOnceWith('up');
  });

  it.each(['input', 'textarea', 'select', '[contenteditable]', '[role="textbox"]'])('préserve le champ éditable %s', (selector) => {
    const { canvas, controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    const field = document.createElement(selector.startsWith('[') ? 'div' : selector);
    if (selector === '[contenteditable]') field.setAttribute('contenteditable', 'true');
    if (selector === '[role="textbox"]') field.setAttribute('role', 'textbox');
    canvas.append(field);
    expect(key('KeyW', 'keydown', {}, field).defaultPrevented).toBe(false);
    expect(key('Space', 'keydown', {}, field).defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    expect(onBomb).not.toHaveBeenCalled();
  });

  it('ignore un canvas placé dans une zone éditable', () => {
    const { canvas, controls, onMove, key } = setup();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(editable); editable.append(canvas); canvas.focus();
    controls.setEnabled(true);
    expect(key('KeyW').defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
  });

  it.each<KeyboardEventInit>([
    { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true },
  ])('ignore les raccourcis et compositions %j', (options) => {
    const { controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    expect(key('KeyW', 'keydown', options).defaultPrevented).toBe(false);
    expect(key('Space', 'keydown', options).defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    expect(onBomb).not.toHaveBeenCalled();
    key('KeyW');
    expect(onMove).toHaveBeenCalledExactlyOnceWith('up');
  });

  it.each(['Enter', 'Tab', 'KeyZ', 'toString', '__proto__'])('ne détourne pas la touche inconnue %s', (code) => {
    const { controls, onMove, onBomb, key } = setup();
    controls.setEnabled(true);
    expect(key(code).defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    expect(onBomb).not.toHaveBeenCalled();
  });

  it('efface les appuis après la perte réelle du focus du canvas', () => {
    const { canvas, controls, onMove, key } = setup();
    controls.setEnabled(true); key('ArrowLeft');
    const input = document.createElement('input'); document.body.append(input); input.focus();
    canvas.focus(); key('ArrowLeft', 'keydown', { repeat: true });
    expect(onMove).toHaveBeenCalledTimes(1);
    key('ArrowLeft');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('efface les appuis lorsque la fenêtre perd le focus', () => {
    const { controls, onMove, key } = setup();
    controls.setEnabled(true); key('ArrowLeft');
    window.dispatchEvent(new Event('blur'));
    key('ArrowLeft');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('ignore un document masqué et réinitialise les appuis au changement de visibilité', () => {
    const { controls, onMove, onBomb, key } = setup();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    controls.setEnabled(true); key('ArrowLeft');
    hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    expect(key('ArrowLeft').defaultPrevented).toBe(false);
    expect(key('Space').defaultPrevented).toBe(false);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onBomb).not.toHaveBeenCalled();
    hidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
    key('ArrowLeft');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('retire tous les écouteurs à la destruction et ne peut pas être réactivé', () => {
    const { canvas, controls, onMove, onBomb, key } = setup();
    const canvasOff = vi.spyOn(canvas, 'removeEventListener');
    const documentOff = vi.spyOn(document, 'removeEventListener');
    const windowOff = vi.spyOn(window, 'removeEventListener');
    controls.setEnabled(true); key('ArrowUp');
    controls.destroy(); controls.destroy(); controls.setEnabled(true);
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(key('Space').defaultPrevented).toBe(false);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onBomb).not.toHaveBeenCalled();
    expect(canvasOff.mock.calls.map(([type]) => type)).toEqual(['keydown', 'blur']);
    expect(documentOff.mock.calls.map(([type]) => type)).toEqual(['keyup', 'visibilitychange']);
    expect(windowOff.mock.calls.map(([type]) => type)).toEqual(['blur']);
  });
});
