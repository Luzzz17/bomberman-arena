// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CELL, MAP_HEIGHT, MAP_WIDTH } from '../../shared/index.js';
import type { StartPayload, StatePayload } from '../../shared/index.js';
import type { ArenaSnapshot } from '../src/arena/types';
import type { ArenaView } from '../src/arena/view';
import { createGameCoordinator } from '../src/game/coordinator';
import type { GameControls } from '../src/inputs/types';
import type { GameTransport, GameTransportObserver } from '../src/session/types';

function makeValidGrid(): number[][] {
  return Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(CELL.EMPTY));
}

function makeStartPayload(): StartPayload {
  return {
    grid: makeValidGrid(),
    players: [
      { id: 'p1', pseudo: 'Alice', slot: 1, x: 0, y: 0, alive: true, maxBombs: 1, range: 2, speed: 1 },
    ],
  };
}

function makeStatePayload(tick: number): StatePayload {
  return {
    tick,
    grid: makeValidGrid(),
    players: [
      { id: 'p1', pseudo: 'Alice', slot: 1, x: 1, y: 1, alive: true, maxBombs: 1, range: 2, speed: 1 },
    ],
    bombs: [{ id: `b-${tick}`, x: 1, y: 1, ownerId: 'p1', range: 2, explodesIn: 3000 }],
    explosions: [],
    bonuses: [],
  };
}

function createMockTransport() {
  const holder = { observer: null as GameTransportObserver | null };
  let active = false;

  const transport: GameTransport = {
    connect: vi.fn(),
    isConnected: vi.fn(() => true),
    isGameActive: vi.fn(() => active),
    setGameActive: vi.fn((val) => {
      active = val;
    }),
    sendJoin: vi.fn(() => true),
    sendReady: vi.fn(() => true),
    sendMove: vi.fn(() => true),
    sendBomb: vi.fn(() => true),
    setObserver: (obs) => {
      holder.observer = obs;
    },
  };

  return { transport, holder };
}

function createMockView(): ArenaView & { snapshots: ArenaSnapshot[] } {
  const snapshots: ArenaSnapshot[] = [];
  return {
    element: document.createElement('canvas'),
    snapshots,
    setSnapshot: vi.fn((snap) => snapshots.push(snap)),
    clear: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('Coordinateur de jeu et synchronisation de l’arène', () => {
  it('monte la vue, transmet le snapshot initial avec bombes vides et active les contrôles', async () => {
    const host = document.createElement('div');
    const { transport, holder } = createMockTransport();
    const mockView = createMockView();

    let controlsEnabled = false;
    const mockControls: GameControls = {
      enable: vi.fn(() => { controlsEnabled = true; }),
      disable: vi.fn(() => { controlsEnabled = false; }),
      destroy: vi.fn(),
    };

    createGameCoordinator({
      host,
      transport,
      playerId: () => 'p1',
      viewFactory: vi.fn().mockResolvedValue(mockView),
      controlsFactory: () => mockControls,
    });

    const start = makeStartPayload();
    holder.observer!.onStart!(start);

    await expect.poll(() => mockView.snapshots.length).toBe(1);
    expect(mockView.snapshots[0]).toEqual({
      grid: start.grid,
      players: start.players,
      bombs: [],
    });
    expect(controlsEnabled).toBe(true);
    expect(transport.setGameActive).toHaveBeenCalledWith(true);
    expect(mockView.focus).toHaveBeenCalled();
  });

  it('applique le dernier état arrivé pendant le montage différé et ignore les anciens ticks', async () => {
    const host = document.createElement('div');
    const { transport, holder } = createMockTransport();
    const mockView = createMockView();

    let resolveView!: (view: ArenaView) => void;
    const viewPromise = new Promise<ArenaView>((res) => {
      resolveView = res;
    });

    createGameCoordinator({
      host,
      transport,
      playerId: () => 'p1',
      viewFactory: () => viewPromise,
    });

    holder.observer!.onStart!(makeStartPayload());

    holder.observer!.onState!(makeStatePayload(10));
    holder.observer!.onState!(makeStatePayload(15));
    holder.observer!.onState!(makeStatePayload(12));

    resolveView(mockView);

    await expect.poll(() => mockView.snapshots.length).toBe(2);
    expect(mockView.snapshots[0].bombs).toEqual([]);
    expect((mockView.snapshots[1] as StatePayload).tick).toBe(15);

    holder.observer!.onState!(makeStatePayload(20));
    expect(mockView.snapshots.length).toBe(3);
    expect((mockView.snapshots[2] as StatePayload).tick).toBe(20);

    holder.observer!.onState!(makeStatePayload(18));
    expect(mockView.snapshots.length).toBe(3);
  });

  it('annule le montage et nettoie la vue lors de la déconnexion ou fermeture', async () => {
    const host = document.createElement('div');
    const { transport, holder } = createMockTransport();
    const mockView = createMockView();

    const coordinator = createGameCoordinator({
      host,
      transport,
      playerId: () => 'p1',
      viewFactory: vi.fn().mockResolvedValue(mockView),
    });

    holder.observer!.onStart!(makeStartPayload());
    await expect.poll(() => mockView.snapshots.length).toBe(1);

    coordinator.dispose();
    expect(mockView.destroy).toHaveBeenCalled();
    expect(transport.setGameActive).toHaveBeenCalledWith(false);
  });
});
