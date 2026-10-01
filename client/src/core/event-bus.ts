export interface EventBus<Events extends object> {
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
}

/** Relie intentions et observations sans coupler leurs producteurs aux vues. */
export function createEventBus<Events extends object>(): EventBus<Events> {
  const listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};
  return {
    on(event, listener) {
      const subscribers = (listeners[event] ??= new Set());
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    emit(event, payload) {
      // Copier les abonnés permet de modifier les inscriptions pendant l'envoi.
      for (const listener of [...(listeners[event] ?? [])]) listener(payload);
    },
  };
}
