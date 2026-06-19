export class EventEmitter<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: Array<(payload: T[K]) => void> } = {};

  public on<K extends keyof T>(
    event: K,
    listener: (payload: T[K]) => void,
  ): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(listener);
  }

  public off<K extends keyof T>(
    event: K,
    listener: (payload: T[K]) => void,
  ): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event]!.filter(
      (l) => l !== listener,
    );
  }

  protected emit<K extends keyof T>(event: K, payload: T[K]): void {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach((listener) => listener(payload));
  }
}
