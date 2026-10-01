import type { EventBus } from '../core/event-bus';
import type { ConnectionState, ConnectionTransport, SessionEvents } from './types';

/** Coordonne les intentions de la vue et conserve la dernière observation. */
export function createSession(bus: EventBus<SessionEvents>, transport: ConnectionTransport) {
  let state: ConnectionState = Object.freeze({ status: 'disconnected' });
  let stop: (() => void) | undefined;
  let generation = 0;

  function publish(next: ConnectionState) {
    state = Object.freeze(next);
    bus.emit('session:changed', state);
  }

  function close() {
    generation++;
    stop?.();
    stop = undefined;
    publish({ status: 'disconnected' });
  }

  const offConnect = bus.on('connection:requested', (address) => {
    const current = ++generation;
    stop?.();
    stop = transport.connect(address, (next) => {
      if (current === generation) publish(next);
    });
  });
  const offClose = bus.on('connection:closed', close);

  return {
    getState: (): ConnectionState => state,
    dispose() {
      offConnect();
      offClose();
      close();
    },
  };
}
