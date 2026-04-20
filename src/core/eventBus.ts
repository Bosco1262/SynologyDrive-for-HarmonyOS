type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<T>(event: string, listener: Listener<T>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<T>(event: string, listener: Listener<T>): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    set.delete(listener as Listener<unknown>);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<T>(event: string, payload: T): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(payload);
    }
  }
}
