import { getBoundingBox } from '@buildtovalue/core';
import { activeNodesCached } from '../canvas/activeCache.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useT } from '../i18n/I18nContext.js';
import { theme } from '../shapes/common.js';

const WIDTH = 180;
const HEIGHT = 120;
const PADDING = 40;

/**
 * Overview map: every node as a small rect plus the current viewport
 * rectangle. Clicking recenters the viewport on the clicked world point.
 */
export function MiniMap() {
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const viewport = useCanvasState((s) => s.viewport);
  const t = useT();

  const nodes = activeNodesCached(diagram);
  const world = getBoundingBox(
    nodes.length > 0 ? nodes : [{ x: 0, y: 0, width: 1200, height: 800 }],
  );
  const bounds = {
    x: world.x - PADDING,
    y: world.y - PADDING,
    width: world.width + PADDING * 2,
    height: world.height + PADDING * 2,
  };
  // Include the viewport in the mapped area so the indicator never clips away.
  const minX = Math.min(bounds.x, viewport.x);
  const minY = Math.min(bounds.y, viewport.y);
  const maxX = Math.max(bounds.x + bounds.width, viewport.x + viewport.width);
  const maxY = Math.max(bounds.y + bounds.height, viewport.y + viewport.height);
  const mapped = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const recenter = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const wx = mapped.x + ((event.clientX - rect.left) / rect.width) * mapped.width;
    const wy = mapped.y + ((event.clientY - rect.top) / rect.height) * mapped.height;
    store.setState({
      viewport: {
        ...viewport,
        x: wx - viewport.width / 2,
        y: wy - viewport.height / 2,
      },
    });
  };

  return (
    <svg
      className="bpmnr-minimap"
      role="img"
      aria-label={t('minimap.aria')}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`${mapped.x} ${mapped.y} ${mapped.width} ${mapped.height}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={recenter}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={mapped.x}
        y={mapped.y}
        width={mapped.width}
        height={mapped.height}
        fill="var(--bpmnr-minimap-bg, rgba(250, 249, 246, 0.92))"
      />
      {nodes.map((node) => (
        <rect
          key={node.id}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          fill={theme.textMuted}
          opacity={0.5}
          rx={2}
        />
      ))}
      <rect
        data-minimap-viewport
        x={viewport.x}
        y={viewport.y}
        width={viewport.width}
        height={viewport.height}
        fill="none"
        stroke={theme.strokeSelected}
        strokeWidth={Math.max(mapped.width, mapped.height) / 100}
      />
    </svg>
  );
}
