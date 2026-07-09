import type { AggregatedLog } from '@bpmn-react/replay';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { edgeGeometryFor, nodeCenter } from '../simulation/edgePath.js';
import { formatDuration, heatWidth } from './format.js';

export interface ReplayOverlaySvgProps {
  log: AggregatedLog;
  selectedDeviation: number | null;
  onSelectDeviation: (index: number) => void;
  variantTokenNodeId: string | null;
}

const INK = 'var(--btv-edge-handoff, #44403a)';
const RED = 'var(--btv-error, #b3372f)';
const VIOLET = 'var(--btv-replay, #7a4f9a)';

const count = (value: number) => value.toLocaleString('pt-BR');

/**
 * World-coordinate replay heatmap, mounted through the canvas `overlay` seam:
 * edge thickness = frequency (never colour alone — a11y) with a count label,
 * per-node ⌀ time chips (bottleneck in red), dashed-red deviation paths that
 * are clickable, and the violet sampled-variant token. Geometry, not CSS
 * filters, so it survives PNG/SVG export (§9).
 */
export function ReplayOverlaySvg({
  log,
  selectedDeviation,
  onSelectDeviation,
  variantTokenNodeId,
}: ReplayOverlaySvgProps) {
  const { diagram } = useDiagram();
  const config = useEditorConfig();
  const maxCount = log.edges.reduce((max, edge) => Math.max(max, edge.count), 0);

  const geom = (edgeId: string) => {
    const edge = diagram.edges[edgeId];
    if (!edge) return null;
    return edgeGeometryFor(edge, diagram.nodes[edge.sourceId], diagram.nodes[edge.targetId], config.edgeRouter);
  };

  return (
    <g data-replay-overlay>
      {/* Heatmap: edge thickness ∝ frequency + a count label with a halo. */}
      <g pointerEvents="none">
        {log.edges.map((edge) => {
          const geometry = geom(edge.edgeId);
          if (!geometry) return null;
          return (
            <g key={`hm-${edge.edgeId}`}>
              <path
                data-replay-edge={edge.edgeId}
                d={geometry.path}
                fill="none"
                stroke={INK}
                strokeWidth={heatWidth(edge.count, maxCount)}
                strokeOpacity={0.85}
                strokeLinecap="round"
              />
              <text
                data-replay-edge-count={edge.edgeId}
                x={geometry.midpoint.x}
                y={geometry.midpoint.y - 8}
                textAnchor="middle"
                fontSize={9.5}
                fontFamily="'IBM Plex Mono', ui-monospace, monospace"
                fill={INK}
                style={{ paintOrder: 'stroke', stroke: 'var(--bpmnr-canvas-bg, #faf9f6)', strokeWidth: 3 }}
              >
                {count(edge.count)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Deviations: dashed red between node centres, clickable. */}
      {log.deviations.map((deviation, index) => {
        const from = diagram.nodes[deviation.from];
        const to = diagram.nodes[deviation.to];
        if (!from || !to) return null; // unmapped endpoint — listed in the panel only
        const a = nodeCenter(from);
        const b = nodeCenter(to);
        const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 34 };
        const selected = selectedDeviation === index;
        return (
          <g
            key={`dev-${index}`}
            data-replay-deviation={index}
            data-selected={selected || undefined}
            onClick={() => onSelectDeviation(index)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={`M ${a.x} ${a.y} Q ${mid.x} ${mid.y} ${b.x} ${b.y}`}
              fill="none"
              stroke={RED}
              strokeWidth={selected ? 3 : 2}
              strokeDasharray="3,5"
              strokeOpacity={0.95}
            />
            <g transform={`translate(${mid.x},${mid.y})`}>
              <rect x={-58} y={-11} width={116} height={17} rx={8.5} fill="var(--btv-error-soft, #fdf3f1)" stroke={RED} strokeWidth={1} />
              <text textAnchor="middle" y={2} fontSize={9} fontFamily="'IBM Plex Mono', ui-monospace, monospace" fill={RED}>
                ▲ DESVIO · {count(deviation.cases)} casos
              </text>
            </g>
          </g>
        );
      })}

      {/* Per-node ⌀ time chips; the bottleneck turns red with GARGALO. */}
      <g pointerEvents="none">
        {log.nodes.map((stat) => {
          const node = diagram.nodes[stat.nodeId];
          if (!node || stat.avgMs === undefined) return null;
          const isBottleneck = stat.nodeId === log.bottleneckNodeId;
          const label = `⌀ ${formatDuration(stat.avgMs)}${isBottleneck ? ' · GARGALO' : ''}`;
          const cx = node.x + node.width / 2;
          const cy = node.y + node.height + 2;
          const width = Math.max(52, label.length * 5.4);
          return (
            <g key={`chip-${stat.nodeId}`} data-replay-chip={stat.nodeId} transform={`translate(${cx},${cy})`}>
              <rect
                x={-width / 2}
                y={0}
                width={width}
                height={15}
                rx={7.5}
                fill={isBottleneck ? 'var(--btv-error-soft, #fdf3f1)' : 'var(--btv-palette-item-bg, #fdfaf1)'}
                stroke={isBottleneck ? 'var(--btv-error, #d9a8a2)' : 'var(--btv-gold-soft-stroke, #e8d9ae)'}
                strokeWidth={1}
              />
              <text
                textAnchor="middle"
                y={11}
                fontSize={8.5}
                fontFamily="'IBM Plex Mono', ui-monospace, monospace"
                fill={isBottleneck ? RED : 'var(--btv-gold-strong, #7a611e)'}
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>

      {/* Sampled-variant token (violet). One token over a top variant, never
          one per event; CSS transition glides it (0ms under reduced-motion). */}
      {variantTokenNodeId &&
        (() => {
          const node = diagram.nodes[variantTokenNodeId];
          if (!node) return null;
          const c = nodeCenter(node);
          return (
            <g
              data-replay-token
              className="bpmnr-replay-token"
              transform={`translate(${c.x},${c.y})`}
              pointerEvents="none"
            >
              <circle r={11} fill="rgba(122, 79, 154, 0.35)" />
              <circle r={8} fill={VIOLET} />
              <circle r={8} fill="none" stroke="#ffffff" strokeWidth={2.5} />
            </g>
          );
        })()}
    </g>
  );
}
