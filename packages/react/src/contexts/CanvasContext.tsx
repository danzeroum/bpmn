import { createContext, useContext, useRef, type ReactNode } from 'react';
import { createCanvasStore, type CanvasState, type CanvasStore } from '../state/canvasStore.js';
import { useStore } from '../state/createStore.js';

const CanvasStoreContext = createContext<CanvasStore | null>(null);

export function CanvasProvider({
  initial,
  children,
}: {
  initial?: Partial<CanvasState>;
  children: ReactNode;
}) {
  const storeRef = useRef<CanvasStore | null>(null);
  if (storeRef.current === null) storeRef.current = createCanvasStore(initial);
  return (
    <CanvasStoreContext.Provider value={storeRef.current}>{children}</CanvasStoreContext.Provider>
  );
}

export function useCanvasStore(): CanvasStore {
  const store = useContext(CanvasStoreContext);
  if (!store) throw new Error('useCanvasStore must be used inside <BpmnDesigner>/<BpmnViewer>');
  return store;
}

/** Granular subscription — re-renders only when the selected slice changes. */
export function useCanvasState<S>(selector: (state: CanvasState) => S): S {
  return useStore(useCanvasStore(), selector);
}
