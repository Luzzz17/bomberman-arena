// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadArenaTextures } from '../src/arena/textures';

/** La frontière du décodage PNG est remplacée ; sources et textures PixiJS sont réelles. */
function imageBoundary(automatic = true) {
  const images: HTMLImageElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const node = create(tag);
    if (tag === 'img') {
      const image = node as HTMLImageElement;
      Object.defineProperties(image, { naturalWidth: { value: 1400 }, naturalHeight: { value: 1400 } });
      images.push(image);
      if (automatic) queueMicrotask(() => image.dispatchEvent(new Event('load')));
    }
    return node;
  }) as typeof document.createElement);
  return images;
}
afterEach(() => vi.restoreAllMocks());

describe('Chargement des images de l’arène', () => {
  it('résout les URLs locales et possède ses textures et leurs deux sources', async () => {
    const images = imageBoundary();
    const first = await loadArenaTextures(document); const second = await loadArenaTextures(document);
    expect(images[0].src).toBe(new URL('assets/arena-floor.png', document.baseURI).href);
    expect(images[1].src).toBe(new URL('assets/arena-atlas.png', document.baseURI).href);
    expect(first.textures.player1.source).toBe(first.textures.bomb.source);
    expect(first.textures.floor.source).not.toBe(first.textures.bomb.source);
    expect(first.textures.bomb.source).not.toBe(second.textures.bomb.source);
    const source = first.textures.bomb.source;
    first.destroy(); first.destroy();
    expect(first.textures.bomb.destroyed).toBe(true); expect(source.destroyed).toBe(true);
    expect(second.textures.bomb.destroyed).toBe(false); second.destroy();
  });
  it('propage une erreur image après le chargement du fond', async () => {
    const images = imageBoundary(false); const pending = loadArenaTextures(document);
    const assertion = expect(pending).rejects.toThrow('arena-atlas.png');
    images[0].dispatchEvent(new Event('load')); await Promise.resolve();
    images[1].dispatchEvent(new Event('error')); await assertion;
    expect(images[1].getAttribute('src')).toBeNull();
  });
  it('annule le chargement sans attendre le décodage et ignore un événement tardif', async () => {
    const images = imageBoundary(false); const controller = new AbortController();
    const pending = loadArenaTextures(document, controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await assertion;
    expect(images).toHaveLength(1); expect(images[0].getAttribute('src')).toBeNull();
    images[0].dispatchEvent(new Event('load')); expect(images).toHaveLength(1);
  });
  it('ne crée aucune image si le montage est déjà annulé', async () => {
    const images = imageBoundary(); const controller = new AbortController(); controller.abort();
    await expect(loadArenaTextures(document, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(images).toHaveLength(0);
  });
});
