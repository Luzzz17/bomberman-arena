import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../src/core/event-bus';

describe('Bus typé', () => {
  it('transmet uniquement aux abonnés concernés et permet de se désabonner', () => {
    const bus = createEventBus<{ connect: string; disconnect: undefined }>();
    const receive = vi.fn();
    const other = vi.fn();
    const unsubscribe = bus.on('connect', receive);
    bus.on('disconnect', other);
    bus.emit('connect', 'http://localhost:3000');
    expect(receive).toHaveBeenCalledExactlyOnceWith('http://localhost:3000');
    expect(other).not.toHaveBeenCalled();
    unsubscribe();
    unsubscribe();
    bus.emit('connect', 'http://localhost:3001');
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('isole deux instances et accepte un désabonnement pendant une publication', () => {
    const bus = createEventBus<{ update: number }>();
    const other = createEventBus<{ update: number }>();
    const receive = vi.fn();
    other.on('update', receive);
    const unsubscribe = bus.on('update', () => unsubscribe());
    bus.emit('update', 1);
    bus.emit('update', 2);
    expect(receive).not.toHaveBeenCalled();
  });
});
