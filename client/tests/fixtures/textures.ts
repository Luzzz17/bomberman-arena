import { Rectangle, Texture } from 'pixi.js';
import type { ArenaTextures } from '../../src/arena/textures';

/** Textures sans GPU pour tester la scène réelle et la propriété des ressources. */
const texture = () => new Texture({ source: Texture.EMPTY.source, frame: new Rectangle(0, 0, 1, 1) });
export const testTextures: ArenaTextures = {
  floor: texture(), player1: texture(), player2: texture(),
  player3: texture(), player4: texture(), wall: texture(),
  crate: texture(), bomb: texture(), marker: texture(),
};
