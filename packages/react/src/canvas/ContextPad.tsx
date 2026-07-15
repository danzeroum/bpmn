import {
  addEdgeCommand,
  addNodeCommand,
  compositeCommand,
  createEdge,
  createNode,
  isContainerType,
  removeNodeCommand,
  type BpmnDiagram,
  type BpmnNode,
} from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useT } from '../i18n/I18nContext.js';
import { findNodeAtPoint } from './hitTest.js';
import type { Interactions } from './useInteractions.js';

/**
 * Context pad (melhorias-referência item 1): a small action pad beside the
 * single selected node — create the next element ALREADY CONNECTED with one
 * click (the bpmn-js-style interaction that halves modelling steps), start a
 * connection, or delete. Creation is one composite command: node + edge undo
 * atomically. Rendered on the SVG overlay layer in world units, consistent
 * with ports/resize handles.
 */

/** Horizontal gap between the source node and a quick-added element. */
export const QUICK_ADD_GAP = 72;
const BUTTON = 26;
const PAD_OFFSET = 14;

interface QuickType {
  id: string;
  type: string;
  labelKey: string;
  glyph: (x: number, y: number) => React.ReactElement;
}

const QUICK_TYPES: QuickType[] = [
  {
    id: 'task',
    type: 'task',
    labelKey: 'contextPad.appendTask',
    glyph: (x, y) => (
      <rect x={x + 5} y={y + 7} width={16} height={12} rx={3} fill="none" strokeWidth={1.5} />
    ),
  },
  {
    id: 'gateway',
    type: 'exclusiveGateway',
    labelKey: 'contextPad.appendGateway',
    glyph: (x, y) => (
      <path
        d={`M ${x + 13} ${y + 5} L ${x + 21} ${y + 13} L ${x + 13} ${y + 21} L ${x + 5} ${y + 13} Z`}
        fill="none"
        strokeWidth={1.5}
      />
    ),
  },
  {
    id: 'end',
    type: 'endEvent',
    labelKey: 'contextPad.appendEnd',
    glyph: (x, y) => <circle cx={x + 13} cy={y + 13} r={7} fill="none" strokeWidth={2.4} />,
  },
];

/** Finds a free spot to the right of `source`, stepping down when occupied. */
export function quickAddPosition(
  diagram: BpmnDiagram,
  source: BpmnNode,
  size: { width: number; height: number },
  drillId: string | null,
): { x: number; y: number } {
  const x = source.x + source.width + QUICK_ADD_GAP;
  let y = source.y + source.height / 2 - size.height / 2;
  for (let attempt = 0; attempt < 10; attempt++) {
    const center = { x: x + size.width / 2, y: y + size.height / 2 };
    const hit = findNodeAtPoint(diagram, drillId, center);
    if (!hit || hit.id === source.id) return { x, y };
    y = hit.y + hit.height + 24;
  }
  return { x, y };
}

export function ContextPad({ interactions }: { interactions: Interactions }) {
  const { diagram, execute } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const t = useT();
  const view = useCanvasState((s) => ({
    nodeId: s.selectedIds.length === 1 ? s.selectedIds[0] : null,
    readOnly: s.readOnly,
    busy: Boolean(s.dragState?.active || s.connectState || s.resizeState || s.editingNodeId),
    drillId: s.drillId,
  }));

  if (view.readOnly || view.busy || !view.nodeId) return null;
  const node = diagram.nodes[view.nodeId];
  // Containers (pool/lane) and closed elements don't take quick-append.
  if (!node || node.removedInVersion || isContainerType(node.type)) return null;

  const quickAdd = (type: string) => {
    const def = config.registry.has(type) ? config.registry.get(type) : undefined;
    const size = def?.defaultSize ?? { width: 120, height: 60 };
    const position = quickAddPosition(diagram, node, size, view.drillId);
    const created = createNode(
      {
        type,
        x: position.x,
        y: position.y,
        versionId: diagram.version.id,
        // Quick-added elements inherit the source's sub-process scope.
        ...(typeof node.properties.parentId === 'string'
          ? { properties: { parentId: node.properties.parentId } }
          : {}),
      },
      config.registry,
    );
    const edge = createEdge({
      sourceId: node.id,
      targetId: created.id,
      versionId: diagram.version.id,
    });
    const verdict = execute(
      compositeCommand(`Append ${type}`, [addNodeCommand(created), addEdgeCommand(edge)]),
    );
    if (verdict.allowed) {
      store.setState({ selectedIds: [created.id], lastCreatedNodeId: created.id });
    }
  };

  const remove = () => {
    execute(removeNodeCommand(node.id));
    store.setState({ selectedIds: [] });
  };

  const x = node.x + node.width + PAD_OFFSET;
  const entries: Array<{ id: string; label: string; run: () => void; glyph: QuickType['glyph'] }> =
    QUICK_TYPES.map((q) => ({
      id: q.id,
      label: t(q.labelKey),
      run: () => quickAdd(q.type),
      glyph: q.glyph,
    }));
  entries.push({
    id: 'connect',
    label: t('contextPad.connect'),
    run: () => {},
    glyph: (gx, gy) => (
      <path
        d={`M ${gx + 7} ${gy + 19} L ${gx + 17} ${gy + 9} M ${gx + 12} ${gy + 7} H ${gx + 19} V ${gy + 14}`}
        strokeWidth={1.6}
        fill="none"
      />
    ),
  });
  entries.push({
    id: 'delete',
    label: t('contextPad.delete'),
    run: remove,
    glyph: (gx, gy) => (
      <path
        d={`M ${gx + 8} ${gy + 8} L ${gx + 18} ${gy + 18} M ${gx + 18} ${gy + 8} L ${gx + 8} ${gy + 18}`}
        strokeWidth={1.8}
        fill="none"
      />
    ),
  });

  const totalHeight = entries.length * (BUTTON + 4) - 4;
  const top = node.y + node.height / 2 - totalHeight / 2;

  return (
    <g data-context-pad role="toolbar" aria-label={t('contextPad.aria')}>
      {entries.map((entry, index) => {
        const y = top + index * (BUTTON + 4);
        return (
          <g
            key={entry.id}
            data-context-pad-action={entry.id}
            role="button"
            aria-label={entry.label}
            className="bpmnr-context-pad-button"
            style={{ cursor: 'pointer' }}
            onPointerDown={(event) => {
              // Never start a canvas gesture (pan/lasso/drag) from the pad.
              event.stopPropagation();
              // "Connect" is drag-driven: pressing the button begins the same
              // connection gesture the ports use (drop on a target to link).
              if (entry.id === 'connect') interactions.onPortPointerDown(event, node.id);
            }}
            onClick={(event) => {
              event.stopPropagation();
              entry.run();
            }}
          >
            <title>{entry.label}</title>
            <rect x={x} y={y} width={BUTTON} height={BUTTON} rx={6} />
            <g transform={`translate(${x}, ${y})`} className="bpmnr-context-pad-glyph">
              {entry.glyph(0, 0)}
            </g>
          </g>
        );
      })}
    </g>
  );
}
