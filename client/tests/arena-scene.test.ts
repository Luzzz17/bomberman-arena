import { describe, expect, it } from 'vitest';
import { CELL } from '../../shared/index.js';
import { createArenaScene } from '../src/arena/scene';
import { arenaSnapshot } from './fixtures/arena';
import { testTextures } from './fixtures/textures';

describe('Scène PixiJS depuis des observations', () => {
  it('affiche la grille rectangulaire dans le bon sens et centre les entités dans les cases', () => {
    const scene = createArenaScene('jay', testTextures); const state = arenaSnapshot();
    state.grid[2][5] = CELL.BRICK;
    scene.setSnapshot(state);
    const brick = scene.root.getChildByLabel('cell:5:2', true)!;
    const player = scene.root.getChildByLabel('player:jay', true)!;
    const bomb = scene.root.getChildByLabel('bomb:b1', true)!;
    expect(brick).toBeDefined();
    expect(brick.x).toBeGreaterThan(brick.y);
    expect(player.x).toBe(player.y);
    expect(bomb.y).toBe(player.y);
    expect(bomb.x - player.x).toBe(128);
    scene.destroy();
  });
  it('réutilise les objets par ID et retire les absents sans muter les données reçues', () => {
    const scene = createArenaScene('jay', testTextures); const state = arenaSnapshot();
    const original = JSON.stringify(state); scene.setSnapshot(state);
    const player = scene.root.getChildByLabel('player:jay', true)!;
    const tile = scene.root.getChildByLabel('cell:0:0', true)!;
    const bomb = scene.root.getChildByLabel('bomb:b1', true)!;
    scene.setSnapshot({ ...state, players: [{ ...state.players[0], x: 2 }], bombs: [] });
    expect(scene.root.getChildByLabel('player:jay', true)).toBe(player);
    expect(scene.root.getChildByLabel('cell:0:0', true)).toBe(tile);
    expect(player.x).toBe(160);
    expect(bomb.destroyed).toBe(true);
    expect(JSON.stringify(state)).toBe(original);
    scene.setSnapshot({ ...state, players: [], bombs: [] });
    expect(player.destroyed).toBe(true);
    scene.destroy();
  });
  it('retire les joueurs morts et remplace les cases modifiées', () => {
    const scene = createArenaScene('jay', testTextures); const state = arenaSnapshot();
    state.grid[2][5] = CELL.BRICK; scene.setSnapshot(state);
    const brick = scene.root.getChildByLabel('cell:5:2', true)!;
    const player = scene.root.getChildByLabel('player:jay', true)!;
    state.grid[2][5] = CELL.EMPTY;
    scene.setSnapshot({ ...state, players: [{ ...state.players[0], alive: false }] });
    expect(brick.destroyed).toBe(true); expect(player.destroyed).toBe(true);
    scene.destroy();
  });
  it('garde toute la grille visible et centrée en paysage et en portrait', () => {
    const scene = createArenaScene('jay', testTextures); scene.setSnapshot(arenaSnapshot());
    for (const [width, height] of [[1200, 600], [400, 800]]) {
      scene.resize(width, height);
      const { x, y, scale } = scene.root;
      expect(scale.x).toBe(scale.y); expect(scale.x).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + 832 * scale.x).toBeLessThanOrEqual(width);
      expect(y + 704 * scale.y).toBeLessThanOrEqual(height);
      expect(x + 416 * scale.x).toBeCloseTo(width / 2);
      expect(y + 352 * scale.y).toBeCloseTo(height / 2);
    }
    scene.resize(0, 0); expect(Number.isFinite(scene.root.scale.x)).toBe(true);
    scene.destroy(); scene.destroy(); expect(scene.root.destroyed).toBe(true);
  });
});
