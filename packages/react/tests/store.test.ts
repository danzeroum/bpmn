import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createStore, useStore } from '../src/state/createStore.js';
import { createCanvasStore } from '../src/state/canvasStore.js';

describe('createStore', () => {
  it('gets, sets and notifies', () => {
    const store = createStore({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ a: 2 });
    expect(store.getState()).toEqual({ a: 2, b: 'x' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports functional updates and skips no-op patches', () => {
    const store = createStore({ n: 1 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState((prev) => ({ n: prev.n + 1 }));
    expect(store.getState().n).toBe(2);
    store.setState({ n: 2 }); // same value → no notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes', () => {
    const store = createStore({ n: 1 });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.setState({ n: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useStore selector', () => {
  it('re-renders only when the selected slice changes', () => {
    const store = createCanvasStore();
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useStore(store, (s) => s.selectedIds);
    });
    expect(result.current).toEqual([]);
    const initialRenders = renders;

    // Unrelated update: viewport pan should not re-render this hook
    act(() => store.setState({ viewport: { x: 10, y: 10, width: 1200, height: 800 } }));
    expect(renders).toBe(initialRenders);

    act(() => store.setState({ selectedIds: ['n1'] }));
    expect(result.current).toEqual(['n1']);
    expect(renders).toBeGreaterThan(initialRenders);
  });

  it('caches shallow-equal selections to avoid render loops', () => {
    const store = createCanvasStore();
    const { result } = renderHook(() =>
      useStore(store, (s) => ({ ids: s.selectedIds, grid: s.gridSize })),
    );
    const first = result.current;
    act(() => store.setState({ hoveredId: 'x' })); // unrelated
    expect(result.current).toBe(first);
  });
});
