import { useEffect, useState } from 'react';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { theme } from '../shapes/common.js';

/** Crossfade duration for the settle preview (Handoff 10 R-2b). */
export const SETTLE_MS = 160;

/**
 * Settle crossfade (Handoff 10 R-2b). On drop, the moved nodes' A* edges snap
 * to freshly cached waypoints. To avoid a jarring jump from the mid-drag
 * orthogonal preview, that preview path is painted ON TOP at the final
 * positions and faded to transparent over {@link SETTLE_MS}ms — revealing the
 * opaque, already-settled A* route underneath. This is a pure opacity
 * crossfade of two overlapping paths; waypoints are never interpolated.
 *
 * `prefers-reduced-motion` suppresses the crossfade upstream (the drop handler
 * never sets `settling`), so this overlay simply renders nothing then.
 */
export function SettlingOverlay() {
  const settling = useCanvasState((s) => s.settling);
  const store = useCanvasStore();
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!settling) return;
    setOpacity(1);
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => setOpacity(0))
        : (setTimeout(() => setOpacity(0), 0) as unknown as number);
    // Authoritative clear — independent of `transitionend`, which never fires
    // under jsdom or if the layer is unmounted mid-fade.
    const done = setTimeout(() => store.setState({ settling: null }), SETTLE_MS + 40);
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [settling, store]);

  if (!settling) return null;
  return (
    <g
      data-layer="settling"
      pointerEvents="none"
      aria-hidden="true"
      opacity={opacity}
      style={{ transition: `opacity ${SETTLE_MS}ms ease-out` }}
    >
      {settling.map((entry) => (
        <path
          key={entry.edgeId}
          d={entry.path}
          fill="none"
          stroke={theme.stroke}
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}
