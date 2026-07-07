import { useRef, useSyncExternalStore } from 'react';

/**
 * Minimal external store (zero dependencies). Visual/interaction state lives
 * here instead of React context state so that high-frequency updates during
 * drag/pan re-render only the components whose *selected* slice changed —
 * never the whole tree.
 */
export interface Store<T> {
  getState(): T;
  setState(partial: Partial<T> | ((previous: T) => Partial<T>)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (partial) => {
      const patch = typeof partial === 'function' ? partial(state) : partial;
      let changed = false;
      for (const key of Object.keys(patch) as (keyof T)[]) {
        if (!Object.is(state[key], patch[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...patch };
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Subscribes a component to a slice of the store. The component re-renders
 * only when the selected value changes (`Object.is`).
 */
export function useStore<T extends object, S>(store: Store<T>, selector: (state: T) => S): S {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<{ state: T; selected: S } | null>(null);

  return useSyncExternalStore(
    store.subscribe,
    () => {
      const state = store.getState();
      if (cache.current && Object.is(cache.current.state, state)) {
        return cache.current.selected;
      }
      const selected = selectorRef.current(state);
      if (cache.current && shallowEqual(cache.current.selected, selected)) {
        cache.current = { state, selected: cache.current.selected };
        return cache.current.selected;
      }
      cache.current = { state, selected };
      return selected;
    },
    () => selectorRef.current(store.getState()),
  );
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
