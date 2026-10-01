import { createEventBus } from './core/event-bus';
import { createSocketTransport } from './network/socket-client';
import { createSession } from './session/session';
import type { SessionEvents } from './session/types';
import { mountConnectionView } from './ui/connection-view';

/** Assemble le réseau, la session et la vue dans le processus navigateur. */
const bus = createEventBus<SessionEvents>();
const session = createSession(bus, createSocketTransport());
const unmount = mountConnectionView(document, bus, session.getState());

window.addEventListener('beforeunload', () => {
  unmount();
  session.dispose();
}, { once: true });
