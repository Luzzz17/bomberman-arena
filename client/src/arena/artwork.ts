import { Container, Sprite, Text } from 'pixi.js';
import { CELL } from '../../../shared/index.js';
import type { ArenaTextures } from './textures';

export const TILE_SIZE = 64;
const ink = 0x253b49;

/** Seuls les obstacles reçus occupent une case au-dessus du fond. */
export function createTile(kind: number, textures: ArenaTextures): Sprite {
  const sprite = new Sprite(kind === CELL.WALL ? textures.wall : textures.crate);
  sprite.width = TILE_SIZE; sprite.height = TILE_SIZE;
  return sprite;
}

export interface PlayerArtwork { container: Container; name: Text; slot: number }

/** Personnage centré sur la case reçue, avec repère pour le joueur local. */
export function createPlayer(slot: number, pseudo: string, local: boolean, textures: ArenaTextures): PlayerArtwork {
  const container = new Container();
  if (local) {
    const marker = new Sprite({ texture: textures.marker, label: 'marker' });
    marker.anchor.set(0.5); marker.width = 60; marker.height = 30; marker.y = 23;
    container.addChild(marker);
  }
  const texture = [textures.player1, textures.player2, textures.player3, textures.player4][slot - 1] ?? textures.player1;
  const character = new Sprite({ texture, label: 'character' });
  character.anchor.set(0.5); character.height = 62;
  character.width = 62 * texture.width / texture.height; character.y = -4;
  const name = new Text({ text: pseudo, label: 'name', style: {
    fontFamily: 'Arial, sans-serif', fontSize: 10, fontWeight: 'bold', fill: ink,
    stroke: { color: 0xfffdf0, width: 3 },
  } });
  name.anchor.set(0.5, 0); name.y = 31;
  container.addChild(character, name);
  return { container, name, slot };
}

/** Aucun décompte local : la bombe existe aussi longtemps que l'observation la contient. */
export function createBomb(textures: ArenaTextures): Sprite {
  const bomb = new Sprite(textures.bomb);
  bomb.anchor.set(0.5); bomb.height = 58;
  bomb.width = 58 * textures.bomb.width / textures.bomb.height;
  return bomb;
}
