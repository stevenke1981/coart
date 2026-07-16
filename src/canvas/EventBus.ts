export class EventBus<EventMap extends object> {
  private readonly listeners = new Map<keyof EventMap, Set<(event: EventMap[keyof EventMap]) => void>>()

  on<K extends keyof EventMap>(type: K, listener: (event: EventMap[K]) => void): () => void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener as (event: EventMap[keyof EventMap]) => void)
    this.listeners.set(type, listeners)
    return () => listeners.delete(listener as (event: EventMap[keyof EventMap]) => void)
  }

  emit<K extends keyof EventMap>(type: K, event: EventMap[K]): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}
