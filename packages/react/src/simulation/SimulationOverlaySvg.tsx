import { useEffect } from 'react';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { edgeGeometryFor, nodeCenter } from './edgePath.js';
import type { TokenTravel } from './useSimulation.js';

export interface SimulationOverlaySvgProps {
  /** Node ids currently holding a resting token. */
  tokenNodeIds: string[];
  /** Edge ids exercised this session (green stroke). */
  traversedEdges: string[];
  travels: TokenTravel[];
  clearTravel: (key: number) => void;
}

const GREEN = 'var(--btv-green, #1a6a54)';

/**
 * World-coordinate simulation layer, mounted through `BpmnCanvas`'s `overlay`
 * seam: exercised edges in green, a heated highlight on the node(s) holding a
 * token, and the animated token disc(s). The token rides the *real* edge
 * geometry via SVG `<animateMotion>` (PR 0 keeps that route off the nodes).
 */
export function SimulationOverlaySvg({
  tokenNodeIds,
  traversedEdges,
  travels,
  clearTravel,
}: SimulationOverlaySvgProps) {
  const { diagram } = useDiagram();
  const config = useEditorConfig();

  const pathFor = (edgeId: string): string | null => {
    const edge = diagram.edges[edgeId];
    if (!edge) return null;
    const geometry = edgeGeometryFor(
      edge,
      diagram.nodes[edge.sourceId],
      diagram.nodes[edge.targetId],
      config.edgeRouter,
    );
    return geometry?.path ?? null;
  };

  // While a token is mid-flight to a node, suppress that node's resting disc so
  // only one token shows.
  const travelingTargets = new Set(travels.map((t) => t.targetNodeId));

  return (
    <g data-simulation-overlay pointerEvents="none">
      {/* Exercised edges — persistent green stroke over the resting ink. */}
      {traversedEdges.map((edgeId) => {
        const path = pathFor(edgeId);
        return path ? (
          <path
            key={`ex-${edgeId}`}
            data-sim-exercised-edge={edgeId}
            d={path}
            fill="none"
            stroke={GREEN}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ) : null;
      })}

      {/* Current node highlight — heated fill + gold ring, shape-agnostic. */}
      {tokenNodeIds.map((nodeId) => {
        const node = diagram.nodes[nodeId];
        if (!node) return null;
        return (
          <rect
            key={`hl-${nodeId}`}
            data-sim-active-node={nodeId}
            x={node.x - 4}
            y={node.y - 4}
            width={node.width + 8}
            height={node.height + 8}
            rx={11}
            fill="var(--btv-gold-soft, #f6edd4)"
            fillOpacity={0.45}
            stroke="var(--btv-gold, #9a7b1e)"
            strokeWidth={2.5}
          />
        );
      })}

      {/* Resting tokens. */}
      {tokenNodeIds.map((nodeId) => {
        if (travelingTargets.has(nodeId)) return null;
        const node = diagram.nodes[nodeId];
        if (!node) return null;
        const c = nodeCenter(node);
        return (
          <g key={`tok-${nodeId}`} transform={`translate(${c.x},${c.y})`} data-sim-token={nodeId}>
            <TokenDisc />
          </g>
        );
      })}

      {/* Traveling tokens — one per fresh edge move, animated over its path. */}
      {travels.map((travel) => (
        <TravelingToken key={travel.key} travel={travel} onDone={() => clearTravel(travel.key)} />
      ))}
    </g>
  );
}

/** The gold disc: translucent halo, gold body, white ring (18px, prototype). */
function TokenDisc() {
  return (
    <>
      <circle r={12} fill="rgba(154, 123, 30, 0.35)" />
      <circle r={9} fill="var(--btv-gold, #9a7b1e)" />
      <circle r={9} fill="none" stroke="#ffffff" strokeWidth={2.5} />
    </>
  );
}

function TravelingToken({ travel, onDone }: { travel: TokenTravel; onDone: () => void }) {
  const { diagram } = useDiagram();
  const config = useEditorConfig();
  const edge = diagram.edges[travel.edgeId];
  const geometry = edge
    ? edgeGeometryFor(edge, diagram.nodes[edge.sourceId], diagram.nodes[edge.targetId], config.edgeRouter)
    : null;

  // Clear this travel once its animation has played (re-armed per travel key).
  useEffect(() => {
    const timer = setTimeout(onDone, travel.durationMs);
    return () => clearTimeout(timer);
  }, [travel.key, travel.durationMs, onDone]);

  if (!geometry) return null;
  return (
    <g data-sim-token-travel={travel.edgeId}>
      {/* animateMotion moves the group along the absolute edge path once. */}
      <animateMotion dur={`${travel.durationMs}ms`} path={geometry.path} fill="freeze" repeatCount="1" />
      <TokenDisc />
    </g>
  );
}
