import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../../shared/index.js';
import type { GamePlayer, StartPayload, StatePayload } from '../../../shared/index.js';

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isValidGrid(grid: unknown): boolean {
  if (!Array.isArray(grid) || grid.length !== MAP_HEIGHT) return false;
  const validCells = new Set<number>([CELL.EMPTY, CELL.WALL, CELL.BRICK]);
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== MAP_WIDTH) return false;
    for (const cell of row) {
      if (!isInteger(cell) || !validCells.has(cell)) return false;
    }
  }
  return true;
}

function isValidPlayer(p: unknown): p is GamePlayer {
  if (typeof p !== 'object' || p === null) return false;
  const player = p as Record<string, unknown>;
  return (
    typeof player.id === 'string' &&
    player.id.trim().length > 0 &&
    typeof player.pseudo === 'string' &&
    isInteger(player.slot) &&
    player.slot >= 1 &&
    player.slot <= 4 &&
    isInteger(player.x) &&
    player.x >= 0 &&
    player.x < MAP_WIDTH &&
    isInteger(player.y) &&
    player.y >= 0 &&
    player.y < MAP_HEIGHT &&
    typeof player.alive === 'boolean'
  );
}

function hasUniquePlayerIds(players: GamePlayer[]): boolean {
  const ids = new Set<string>();
  for (const p of players) {
    if (ids.has(p.id)) return false;
    ids.add(p.id);
  }
  return true;
}

export function validateStartPayload(payload: unknown): StartPayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  if (!isValidGrid(obj.grid)) return null;
  if (!Array.isArray(obj.players)) return null;
  for (const p of obj.players) {
    if (!isValidPlayer(p)) return null;
  }
  const players = obj.players as GamePlayer[];
  if (!hasUniquePlayerIds(players)) return null;
  return payload as StartPayload;
}

export function validateStatePayload(payload: unknown): StatePayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  if (!isInteger(obj.tick) || obj.tick < 0) return null;
  if (!isValidGrid(obj.grid)) return null;
  if (!Array.isArray(obj.players) || !Array.isArray(obj.bombs)) return null;

  for (const p of obj.players) {
    if (!isValidPlayer(p)) return null;
  }
  const players = obj.players as GamePlayer[];
  if (!hasUniquePlayerIds(players)) return null;

  const bombIds = new Set<string>();
  for (const b of obj.bombs) {
    if (typeof b !== 'object' || b === null) return null;
    const bomb = b as Record<string, unknown>;
    if (
      typeof bomb.id !== 'string' ||
      !bomb.id.trim() ||
      !isInteger(bomb.x) ||
      bomb.x < 0 ||
      bomb.x >= MAP_WIDTH ||
      !isInteger(bomb.y) ||
      bomb.y < 0 ||
      bomb.y >= MAP_HEIGHT
    ) {
      return null;
    }
    if (bombIds.has(bomb.id)) return null;
    bombIds.add(bomb.id);
  }

  if (obj.explosions !== undefined && !Array.isArray(obj.explosions)) return null;
  if (obj.bonuses !== undefined && !Array.isArray(obj.bonuses)) return null;

  return payload as StatePayload;
}
