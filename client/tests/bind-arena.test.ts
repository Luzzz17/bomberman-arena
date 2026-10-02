import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../src/core/event-bus';
import type { ArenaEvents } from '../src/game/arena-events';
import { bindArena } from '../src/game/bind-arena';
import { arenaSnapshot } from './fixtures/arena';

function setup() {
  const bus = createEventBus<ArenaEvents>();
  const view = { setSnapshot: vi.fn(), clear: vi.fn(), focus: vi.fn(), destroy: vi.fn() };
  const controls = { setEnabled: vi.fn(), destroy: vi.fn() };
  const dispose = bindArena(bus, view, controls, 'jay');
  const state = { ...arenaSnapshot(), tick: 1, explosions: [], bonuses: [] };
  return { bus, view, controls, dispose, state };
}

describe('Liaison des observations au rendu', () => {
  it('attend le démarrage et ne transforme pas les intentions en positions', () => {
    const { bus, view, controls, dispose, state } = setup();
    expect(controls.setEnabled).toHaveBeenLastCalledWith(false);
    bus.emit('arena:updated', state); expect(view.setSnapshot).not.toHaveBeenCalled();
    bus.emit('arena:started', state);
    expect(view.setSnapshot).toHaveBeenLastCalledWith({ grid: state.grid, players: state.players, bombs: [] });
    expect(controls.setEnabled).toHaveBeenLastCalledWith(true);
    expect(view.focus).toHaveBeenCalledTimes(1);
    bus.emit('player:move-requested', { direction: 'right' }); bus.emit('player:bomb-requested', {});
    expect(view.setSnapshot).toHaveBeenCalledTimes(1);
    bus.emit('arena:updated', state); expect(view.setSnapshot).toHaveBeenLastCalledWith(state);
    dispose();
  });
  it('ignore les états anciens et coupe les inputs si le joueur meurt ou disparaît', () => {
    const { bus, view, controls, dispose, state } = setup();
    bus.emit('arena:started', state); bus.emit('arena:updated', { ...state, tick: 10 });
    bus.emit('arena:updated', { ...state, tick: 9 }); bus.emit('arena:updated', { ...state, tick: 10 });
    expect(view.setSnapshot).toHaveBeenCalledTimes(2);
    bus.emit('arena:updated', { ...state, tick: 11, players: [{ ...state.players[0], alive: false }] });
    expect(controls.setEnabled).toHaveBeenLastCalledWith(false);
    bus.emit('arena:started', { ...state, players: [] });
    expect(controls.setEnabled).toHaveBeenLastCalledWith(false);
    dispose();
  });
  it('respecte le verrou du coordinateur et nettoie le rendu et les abonnements', () => {
    const { bus, view, controls, dispose, state } = setup();
    bus.emit('arena:started', state); bus.emit('controls:enabled', false); bus.emit('arena:updated', state);
    expect(controls.setEnabled).toHaveBeenLastCalledWith(false);
    bus.emit('controls:enabled', true); expect(controls.setEnabled).toHaveBeenLastCalledWith(true);
    bus.emit('arena:stopped', undefined);
    expect(controls.setEnabled).toHaveBeenLastCalledWith(false); expect(view.clear).toHaveBeenCalledTimes(1);
    bus.emit('arena:updated', { ...state, tick: 2 });
    expect(view.setSnapshot).toHaveBeenCalledTimes(2);
    dispose(); dispose();
    bus.emit('arena:started', state); bus.emit('controls:enabled', true);
    expect(view.setSnapshot).toHaveBeenCalledTimes(2);
    expect(controls.destroy).toHaveBeenCalledTimes(1); expect(view.destroy).toHaveBeenCalledTimes(1);
  });
});
