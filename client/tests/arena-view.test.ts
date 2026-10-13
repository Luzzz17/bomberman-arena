// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageSource } from 'pixi.js';
import { createArenaView } from '../src/arena/view';
import { arenaSnapshot } from './fixtures/arena';

// Seule la frontière GPU est remplacée ; la scène utilise les vrais objets PixiJS.
const gpu = vi.hoisted(() => ({
  init: vi.fn(), render: vi.fn(), resize: vi.fn(), destroy: vi.fn(),
  observe: vi.fn(), disconnect: vi.fn(), resized: () => {},
  withoutRenderer: false, stages: [] as import('pixi.js').Container[],
}));
vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>();
  return { ...actual, Application: class {
    stage = new actual.Container();
    get renderer() { return gpu.withoutRenderer ? undefined : { resize: gpu.resize }; }
    constructor() { gpu.stages.push(this.stage); }
    canvas?: HTMLCanvasElement;
    async init(options: { canvas: HTMLCanvasElement }) { this.canvas = options.canvas; await gpu.init(); }
    render = gpu.render;
    destroy() { gpu.destroy(); this.canvas?.remove(); this.stage.destroy({ children: true }); }
  } };
});
let images: HTMLImageElement[] = [];
let automaticImages = true;
beforeEach(() => {
  images = []; automaticImages = true; gpu.withoutRenderer = false; gpu.stages = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const node = create(tag);
    if (tag === 'img') {
      const image = node as HTMLImageElement;
      Object.defineProperties(image, { naturalWidth: { value: 1400 }, naturalHeight: { value: 1400 } });
      images.push(image);
      if (automaticImages) queueMicrotask(() => image.dispatchEvent(new Event('load')));
    }
    return node;
  }) as typeof document.createElement);
  vi.clearAllMocks(); gpu.init.mockResolvedValue(undefined);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { gpu.resized = callback; }
    observe = gpu.observe; disconnect = gpu.disconnect;
  });
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function host() {
  const node = document.createElement('div'); document.body.append(node);
  Object.defineProperty(node, 'clientWidth', { value: 900 });
  Object.defineProperty(node, 'clientHeight', { value: 700 });
  return node;
}

describe('Cycle de vie du canvas', () => {
  it('libère les sources et le canvas après un échec du premier rendu', async () => {
    const parent = host(); const released = vi.spyOn(ImageSource.prototype, 'destroy');
    gpu.render.mockImplementationOnce(() => { throw new Error('Rendu impossible'); });
    await expect(createArenaView(parent, 'jay')).rejects.toThrow('Rendu impossible');
    expect(parent.childElementCount).toBe(0); expect(released).toHaveBeenCalledTimes(2);
    expect(gpu.disconnect).toHaveBeenCalledTimes(1); expect(gpu.destroy).toHaveBeenCalledTimes(1);
  });
  it('détruit la scène sans renderer lorsque le contexte GPU ne peut pas être créé', async () => {
    gpu.withoutRenderer = true; gpu.init.mockRejectedValueOnce(new Error('Contexte absent'));
    await expect(createArenaView(host(), 'jay')).rejects.toThrow('Contexte absent');
    expect(gpu.destroy).not.toHaveBeenCalled(); expect(gpu.stages[0].destroyed).toBe(true);
  });

  it('possède les images et libère leurs sources après la suppression du canvas', async () => {
    const released = vi.spyOn(ImageSource.prototype, 'destroy');
    const view = await createArenaView(host(), 'jay');
    expect(images).toHaveLength(2); view.setSnapshot(arenaSnapshot());
    view.clear(); expect(released).not.toHaveBeenCalled();
    view.destroy(); view.destroy(); expect(released).toHaveBeenCalledTimes(2);
  });
  it('nettoie le GPU si une image manque', async () => {
    automaticImages = false; const parent = host();
    const pending = createArenaView(parent, 'jay');
    const assertion = expect(pending).rejects.toThrow('arena-floor.png');
    await vi.waitFor(() => expect(images).toHaveLength(1));
    images[0].dispatchEvent(new Event('error')); await assertion;
    expect(parent.childElementCount).toBe(0); expect(gpu.destroy).toHaveBeenCalledTimes(1);
    expect(gpu.observe).not.toHaveBeenCalled();
  });
  it('nettoie le GPU si le montage est annulé pendant le chargement des images', async () => {
    automaticImages = false; const parent = host(); const controller = new AbortController();
    const pending = createArenaView(parent, 'jay', controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(images).toHaveLength(1));
    controller.abort(); await assertion;
    expect(parent.childElementCount).toBe(0); expect(gpu.destroy).toHaveBeenCalledTimes(1);
    expect(images[0].getAttribute('src')).toBeNull();
  });

  it('monte un canvas focalisable, décrit l’état et rend après redimensionnement', async () => {
    const parent = host(); const view = await createArenaView(parent, 'jay');
    expect(parent.querySelector('canvas')).toBe(view.element);
    expect(view.element.tabIndex).toBe(0);
    expect(gpu.resize).toHaveBeenLastCalledWith(900, 700);
    view.setSnapshot(arenaSnapshot()); expect(view.element.getAttribute('aria-label')).toContain('Jay (1, 1)');
    view.focus(); expect(document.activeElement).toBe(view.element);
    const count = gpu.render.mock.calls.length; gpu.resized(); expect(gpu.render).toHaveBeenCalledTimes(count + 1);
    view.clear(); expect(view.element.getAttribute('aria-label')).toContain('attente');
    view.destroy(); view.destroy();
    expect(parent.querySelector('canvas')).toBeNull();
    expect(gpu.destroy).toHaveBeenCalledTimes(1); expect(gpu.disconnect).toHaveBeenCalledTimes(1);
    gpu.render.mockClear(); gpu.resized(); view.setSnapshot(arenaSnapshot()); view.clear();
    expect(gpu.render).not.toHaveBeenCalled();
  });
  it('libère le GPU si le montage est annulé pendant son initialisation', async () => {
    const parent = host(); const controller = new AbortController();
    let ready!: () => void;
    gpu.init.mockImplementation(() => new Promise<void>((resolve) => { ready = resolve; }));
    const promise = createArenaView(parent, 'jay', controller.signal);
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); ready(); await assertion;
    expect(parent.childElementCount).toBe(0); expect(gpu.destroy).toHaveBeenCalledTimes(1);
    expect(gpu.observe).not.toHaveBeenCalled();
  });
  it('nettoie le montage après un abort et propage un échec GPU', async () => {
    const parent = host(); const controller = new AbortController();
    await createArenaView(parent, 'jay', controller.signal); controller.abort();
    expect(parent.childElementCount).toBe(0); expect(gpu.disconnect).toHaveBeenCalledTimes(1);
    gpu.init.mockRejectedValueOnce(new Error('GPU indisponible'));
    await expect(createArenaView(parent, 'jay')).rejects.toThrow('GPU indisponible');
    expect(parent.childElementCount).toBe(0); expect(gpu.destroy).toHaveBeenCalledTimes(2);
  });
});
