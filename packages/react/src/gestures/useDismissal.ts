import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../contexts/CanvasContext.js';

/**
 * Registers an open overlay on the editor's SINGLE Esc dismissal stack
 * (Handoff 5 §11.1): while `open`, the overlay sits on top of the stack and
 * the next Esc calls `close` — popovers stack above peeks, peeks above the
 * selection, and only with nothing open does Esc climb the breadcrumb.
 * Never wire an independent Esc listener in an overlay component.
 */
export function useDismissal(id: string, open: boolean, close: () => void): void {
  const store = useCanvasStore();
  // The latest close lives in a ref so re-renders (inline closures change
  // identity every time) never re-register the entry — stack position is
  // OPENING order, and popping must always call the current closure.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    store.setState({
      dismissals: [
        ...store.getState().dismissals.filter((d) => d.id !== id),
        { id, close: () => closeRef.current() },
      ],
    });
    return () => {
      store.setState({
        dismissals: store.getState().dismissals.filter((d) => d.id !== id),
      });
    };
  }, [store, id, open]);
}
