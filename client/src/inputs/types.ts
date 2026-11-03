import type { Direction } from '../../../shared/index.js';

export interface GameControls {
  enable?(): void;
  disable?(): void;
  setEnabled?(enabled: boolean): void;
  destroy(): void;
}

export type MoveHandler = (direction: Direction) => void;
export type BombHandler = () => void;
