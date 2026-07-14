/**
 * Minimal synchronous event bus with priorities, cancellation and payload
 * transformation.
 *
 * Semantics:
 * - Handlers run in descending priority order (default priority 0).
 * - A handler returning `false` cancels the event: remaining handlers are
 *   skipped and `fire()` reports `cancelled: true`.
 * - A handler returning any other non-undefined value replaces the payload
 *   for subsequent handlers (payload transformation).
 * - Audit listeners should subscribe with a low (negative) priority so they
 *   observe the final payload.
 */

export type EventHandler<T = unknown> = (payload: T) => unknown;

export interface FireResult<T> {
  cancelled: boolean;
  payload: T;
}

interface Registration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry seam: payload types vary per event/tag and are narrowed at the call site
  handler: EventHandler<any>;
  priority: number;
  /** Monotonic sequence to keep registration order stable within a priority. */
  seq: number;
}

export class EventBus {
  private readonly listeners = new Map<string, Registration[]>();
  private seq = 0;

  /** Subscribes to an event. Returns an unsubscribe function. */
  on<T = unknown>(event: string, handler: EventHandler<T>, priority = 0): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push({ handler, priority, seq: this.seq++ });
    list.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    this.listeners.set(event, list);
    return () => this.off(event, handler);
  }

  once<T = unknown>(event: string, handler: EventHandler<T>, priority = 0): () => void {
    const wrapper: EventHandler<T> = (payload) => {
      this.off(event, wrapper);
      return handler(payload);
    };
    return this.on(event, wrapper, priority);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry seam: payload types vary per event/tag and are narrowed at the call site
  off(event: string, handler: EventHandler<any>): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const index = list.findIndex((r) => r.handler === handler);
    if (index >= 0) list.splice(index, 1);
    if (list.length === 0) this.listeners.delete(event);
  }

  fire<T = unknown>(event: string, payload: T): FireResult<T> {
    const list = this.listeners.get(event);
    if (!list) return { cancelled: false, payload };
    let current = payload;
    // Copy so handlers can unsubscribe themselves safely mid-fire.
    for (const registration of [...list]) {
      const result = registration.handler(current);
      if (result === false) return { cancelled: true, payload: current };
      if (result !== undefined) current = result as T;
    }
    return { cancelled: false, payload: current };
  }

  clear(): void {
    this.listeners.clear();
  }
}
