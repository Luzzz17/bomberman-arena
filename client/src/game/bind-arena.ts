import type { EventBus } from '../core/event-bus';
import type { KeyboardControls } from '../inputs/keyboard';
import type { ArenaEvents, ArenaSnapshot } from './arena-events';

export interface ArenaPresentation {
  setSnapshot(snapshot: ArenaSnapshot): void;
  clear(): void;
  focus(): void;
  destroy(): void;
}

/** Relie les observations validées au rendu. Le coordinateur publie stopped à la déconnexion. */
export function bindArena(bus: EventBus<ArenaEvents>, view: ArenaPresentation, controls: KeyboardControls, playerId: string): () => void {
  let active = false; let allowed = true; let alive = false; let destroyed = false;
  let lastTick = -1;
  const refreshControls = () => controls.setEnabled(active && allowed && alive);
  const observe = (snapshot: ArenaSnapshot) => {
    alive = snapshot.players.some((player) => player.id === playerId && player.alive);
    view.setSnapshot(snapshot); refreshControls();
  };
  controls.setEnabled(false);
  const unsubscribe = [
    bus.on('arena:started', (state) => {
      active = true; allowed = true; lastTick = -1;
      observe({ grid: state.grid, players: state.players, bombs: [] });
      view.focus();
    }),
    bus.on('arena:updated', (state) => {
      if (!active || state.tick <= lastTick) return;
      lastTick = state.tick; observe(state);
    }),
    bus.on('controls:enabled', (enabled) => { allowed = enabled; refreshControls(); }),
    bus.on('arena:stopped', () => { active = false; alive = false; refreshControls(); view.clear(); }),
  ];
  return () => {
    if (destroyed) return;
    destroyed = true; unsubscribe.forEach((off) => off());
    controls.destroy(); view.destroy();
  };
}
