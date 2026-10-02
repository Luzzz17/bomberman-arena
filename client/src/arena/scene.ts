import { Container, Graphics, Sprite } from 'pixi.js';
import { CELL } from '../../../shared/index.js';
import type { ArenaTextures } from './textures';
import type { ArenaSnapshot } from '../game/arena-events';
import { createBomb, createPlayer, createTile, TILE_SIZE } from './artwork';
import type { PlayerArtwork } from './artwork';

export interface ArenaScene {
  root: Container;
  setSnapshot(snapshot: ArenaSnapshot): void;
  resize(width: number, height: number): void;
  clear(): void;
  destroy(): void;
}

/** Scène passive : les observations sont la seule source des positions affichées. */
export function createArenaScene(playerId: string, textures: ArenaTextures): ArenaScene {
  const root = new Container({ label: 'arena' });
  const frame = new Graphics();
  const floor = new Sprite({ texture: textures.floor, label: 'floor' });
  floor.visible = false;
  const tiles = new Container({ label: 'tiles' });
  const entities = new Container({ label: 'entities', sortableChildren: true });
  root.addChild(frame, floor, tiles, entities);
  root.eventMode = 'none';
  const cells = new Map<string, { kind: number; graphic: Sprite }>();
  const players = new Map<string, PlayerArtwork>();
  const bombs = new Map<string, Sprite>();
  let columns = 0; let rows = 0;
  let viewportWidth = 1; let viewportHeight = 1;
  let destroyed = false;

  function resize(width: number, height: number): void {
    if (destroyed) return;
    viewportWidth = Math.max(0, width); viewportHeight = Math.max(0, height);
    if (!columns || !rows) return;
    const w = columns * TILE_SIZE; const h = rows * TILE_SIZE;
    const scale = Math.max(0, Math.min(viewportWidth / (w + 40), viewportHeight / (h + 40)));
    root.scale.set(scale);
    root.position.set((viewportWidth - w * scale) / 2, (viewportHeight - h * scale) / 2);
  }

  function setSnapshot(snapshot: ArenaSnapshot): void {
    if (destroyed) return;
    const nextRows = snapshot.grid.length; const nextColumns = snapshot.grid[0]?.length ?? 0;
    if (columns !== nextColumns || rows !== nextRows) {
      columns = nextColumns; rows = nextRows;
      floor.width = columns * TILE_SIZE; floor.height = rows * TILE_SIZE;
      frame.clear().roundRect(-12, -10, columns * TILE_SIZE + 24, rows * TILE_SIZE + 28, 20).fill(0x6b9691);
      frame.roundRect(-12, -16, columns * TILE_SIZE + 24, rows * TILE_SIZE + 28, 20).fill(0xfff9e7).stroke({ color: 0x253b49, width: 3 });
      resize(viewportWidth, viewportHeight);
    }
    floor.visible = columns > 0 && rows > 0;
    const liveCells = new Set<string>();
    snapshot.grid.forEach((row, y) => row.forEach((kind, x) => {
      if (kind !== CELL.WALL && kind !== CELL.BRICK) return;
      const key = `${x}:${y}`; liveCells.add(key);
      const previous = cells.get(key);
      if (previous?.kind === kind) return;
      previous?.graphic.destroy();
      const graphic = createTile(kind, textures);
      graphic.label = `cell:${key}`; graphic.position.set(x * TILE_SIZE, y * TILE_SIZE);
      tiles.addChild(graphic); cells.set(key, { kind, graphic });
    }));
    for (const [key, cell] of cells) if (!liveCells.has(key)) { cell.graphic.destroy(); cells.delete(key); }

    const livePlayers = new Set<string>();
    for (const player of snapshot.players) {
      if (!player.alive) continue;
      livePlayers.add(player.id);
      let art = players.get(player.id);
      if (art && art.slot !== player.slot) { art.container.destroy({ children: true }); players.delete(player.id); art = undefined; }
      if (!art) {
        art = createPlayer(player.slot, player.pseudo, player.id === playerId, textures);
        art.container.label = `player:${player.id}`;
        players.set(player.id, art); entities.addChild(art.container);
      }
      art.name.text = player.pseudo;
      art.container.position.set((player.x + 0.5) * TILE_SIZE, (player.y + 0.5) * TILE_SIZE);
      art.container.zIndex = player.y * 2 + 1;
    }
    for (const [id, art] of players) if (!livePlayers.has(id)) { art.container.destroy({ children: true }); players.delete(id); }
    const liveBombs = new Set<string>();
    for (const bomb of snapshot.bombs) {
      liveBombs.add(bomb.id);
      let graphic = bombs.get(bomb.id);
      if (!graphic) { graphic = createBomb(textures); graphic.label = `bomb:${bomb.id}`; bombs.set(bomb.id, graphic); entities.addChild(graphic); }
      graphic.position.set((bomb.x + 0.5) * TILE_SIZE, (bomb.y + 0.5) * TILE_SIZE);
      graphic.zIndex = bomb.y * 2;
    }
    for (const [id, graphic] of bombs) if (!liveBombs.has(id)) { graphic.destroy(); bombs.delete(id); }
  }

  function clear(): void {
    if (destroyed) return;
    for (const child of tiles.removeChildren()) child.destroy({ children: true });
    for (const child of entities.removeChildren()) child.destroy({ children: true });
    cells.clear(); players.clear(); bombs.clear(); frame.clear(); floor.visible = false; columns = 0; rows = 0;
  }
  return { root, setSnapshot, resize, clear, destroy() {
    if (destroyed) return;
    clear(); destroyed = true; root.destroy({ children: true });
  } };
}
