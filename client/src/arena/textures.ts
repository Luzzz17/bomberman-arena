import { ImageSource, Rectangle, Texture } from 'pixi.js';
export type ArenaTextures = Record<'floor' | 'player1' | 'player2' | 'player3' | 'player4' | 'wall' | 'crate' | 'bomb' | 'marker', Texture>;
export const ATLAS_FRAMES = {
  player1: { x: 0, y: 125, width: 315, height: 520 },
  player2: { x: 326, y: 125, width: 309, height: 520 },
  player3: { x: 638, y: 125, width: 304, height: 520 },
  player4: { x: 950, y: 125, width: 304, height: 520 },
  wall: { x: 8, y: 792, width: 312, height: 330 },
  crate: { x: 340, y: 792, width: 297, height: 333 },
  bomb: { x: 644, y: 753, width: 276, height: 373 },
  marker: { x: 920, y: 895, width: 334, height: 182 },
};


export interface ArenaTextureResources { textures: ArenaTextures; destroy(): void }

/** HTML Image respecte img-src 'self' et fonctionne aussi depuis un fichier Electron. */
function loadImage(document: Document, filename: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    const cleanup = () => {
      image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
      signal?.removeEventListener('abort', aborted);
    };
    const loaded = () => { cleanup(); resolve(image); };
    const failed = () => { cleanup(); image.removeAttribute('src'); reject(new Error(`Image de l'arène indisponible : ${filename}`)); };
    const aborted = () => { cleanup(); image.removeAttribute('src'); reject(signal?.reason); };
    image.addEventListener('load', loaded); image.addEventListener('error', failed);
    signal?.addEventListener('abort', aborted, { once: true });
    image.src = new URL(`assets/${filename}`, document.baseURI).href;
  });
}

/** Chaque montage possède ses sources ; aucun cache global ne relie deux arènes. */
export async function loadArenaTextures(document: Document, signal?: AbortSignal): Promise<ArenaTextureResources> {
  const floorImage = await loadImage(document, 'arena-floor.png', signal);
  const atlasImage = await loadImage(document, 'arena-atlas.png', signal);
  signal?.throwIfAborted();
  for (const frame of Object.values(ATLAS_FRAMES)) {
    if (frame.x + frame.width > atlasImage.naturalWidth || frame.y + frame.height > atlasImage.naturalHeight) {
      throw new Error("Dimensions de l'atlas de l'arène invalides");
    }
  }
  const floorSource = new ImageSource({ resource: floorImage, width: floorImage.naturalWidth, height: floorImage.naturalHeight });
  const atlasSource = new ImageSource({ resource: atlasImage, width: atlasImage.naturalWidth, height: atlasImage.naturalHeight });
  const textures = { floor: new Texture({ source: floorSource }) } as ArenaTextures;
  for (const [name, frame] of Object.entries(ATLAS_FRAMES)) {
    textures[name as keyof typeof ATLAS_FRAMES] = new Texture({ source: atlasSource, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) });
  }
  let destroyed = false;
  return { textures, destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const texture of Object.values(textures)) texture.destroy();
    floorSource.destroy(); atlasSource.destroy();
  } };
}
