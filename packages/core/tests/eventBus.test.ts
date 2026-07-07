import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/index.js';

describe('EventBus', () => {
  it('fires handlers in descending priority order', () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.on('e', () => void calls.push('low'), -10);
    bus.on('e', () => void calls.push('default'));
    bus.on('e', () => void calls.push('high'), 10);
    bus.fire('e', {});
    expect(calls).toEqual(['high', 'default', 'low']);
  });

  it('cancels when a handler returns false', () => {
    const bus = new EventBus();
    const later = vi.fn();
    bus.on('e', () => false, 10);
    bus.on('e', later, 0);
    const result = bus.fire('e', { a: 1 });
    expect(result.cancelled).toBe(true);
    expect(later).not.toHaveBeenCalled();
  });

  it('transforms the payload for subsequent handlers', () => {
    const bus = new EventBus();
    bus.on<{ n: number }>('e', (p) => ({ n: p.n + 1 }), 10);
    let seen = 0;
    bus.on<{ n: number }>('e', (p) => void (seen = p.n), 0);
    const result = bus.fire('e', { n: 1 });
    expect(seen).toBe(2);
    expect(result.payload).toEqual({ n: 2 });
  });

  it('supports once and unsubscribe', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('e', handler);
    bus.fire('e', {});
    bus.fire('e', {});
    expect(handler).toHaveBeenCalledTimes(1);

    const other = vi.fn();
    const off = bus.on('e', other);
    off();
    bus.fire('e', {});
    expect(other).not.toHaveBeenCalled();
  });

  it('keeps registration order within the same priority', () => {
    const bus = new EventBus();
    const calls: number[] = [];
    bus.on('e', () => void calls.push(1));
    bus.on('e', () => void calls.push(2));
    bus.fire('e', {});
    expect(calls).toEqual([1, 2]);
  });
});
