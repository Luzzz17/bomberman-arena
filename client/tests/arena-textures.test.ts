import { CELL } from '../../shared/index.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { ATLAS_FRAMES } from '../src/arena/textures';
import { createArenaScene } from '../src/arena/scene';
import { arenaSnapshot } from './fixtures/arena';
import { testTextures } from './fixtures/textures';

describe('Images de l’arène', () => {
  it('affiche les quatre personnages, les obstacles, la bombe et le marqueur local avec les textures fournies', () => {
    const scene = createArenaScene('jay', testTextures); const state = arenaSnapshot();
    state.grid[2][5] = CELL.BRICK;
    state.players = [1, 2, 3, 4].map((slot) => ({ ...state.players[0], id: slot === 1 ? 'jay' : `p${slot}`, slot, x: slot }));
    scene.setSnapshot(state);
    for (const slot of [1, 2, 3, 4]) {
      const id = slot === 1 ? 'jay' : `p${slot}`;
      const player = scene.root.getChildByLabel(`player:${id}`, true)!;
      const sprite = player.getChildByLabel('character') as Sprite;
      expect(sprite).toBeInstanceOf(Sprite);
      expect(sprite.texture).toBe(testTextures[`player${slot}` as 'player1']);
      if (slot === 1) expect(player.getChildByLabel('marker')).toBeInstanceOf(Sprite);
      else expect(player.getChildByLabel('marker')).toBeNull();
    }
    expect((scene.root.getChildByLabel('cell:0:0', true) as Sprite).texture).toBe(testTextures.wall);
    expect((scene.root.getChildByLabel('cell:5:2', true) as Sprite).texture).toBe(testTextures.crate);
    expect((scene.root.getChildByLabel('bomb:b1', true) as Sprite).texture).toBe(testTextures.bomb);
    const name = scene.root.getChildByLabel('name', true) as Text;
    scene.setSnapshot({ ...state, players: [{ ...state.players[0], pseudo: 'Jay2' }] });
    expect(scene.root.getChildByLabel('name', true)).toBe(name); expect(name.text).toBe('Jay2');
    scene.destroy();
  });

  it('découpe les huit sprites dans les limites du PNG livré', () => {
    const png = readFileSync('src/assets/arena-atlas.png');
    const width = png.readUInt32BE(16); const height = png.readUInt32BE(20);
    expect(Object.keys(ATLAS_FRAMES)).toHaveLength(8);
    for (const frame of Object.values(ATLAS_FRAMES)) {
      expect(frame.x).toBeGreaterThanOrEqual(0); expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.width).toBeGreaterThan(0); expect(frame.height).toBeGreaterThan(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(height);
    }
  });
  it('étire un seul fond sous la grille et conserve les textures après suppression des objets', () => {
    const texture = new Texture({ source: Texture.EMPTY.source, frame: new Rectangle(0, 0, 1, 1) });
    const textures = { ...testTextures, floor: texture, wall: texture, player1: texture, bomb: texture };
    const scene = createArenaScene('jay', textures); const state = arenaSnapshot();
    scene.setSnapshot(state);
    const floor = scene.root.getChildByLabel('floor', true)!;
    expect(floor).not.toBeNull(); expect(floor.width).toBe(832); expect(floor.height).toBe(704);
    expect(scene.root.getChildByLabel('cell:1:1', true)).toBeNull();
    scene.setSnapshot({ ...state, players: [], bombs: [] });
    expect(scene.root.getChildByLabel('floor', true)).toBe(floor);
    scene.clear(); expect(floor.visible).toBe(false);
    scene.destroy(); expect(texture.destroyed).toBe(false); texture.destroy();
  });
});
