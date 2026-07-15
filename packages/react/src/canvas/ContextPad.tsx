import { isContainerType, type Command } from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useT } from '../i18n/I18nContext.js';
import type { ContextPadItem, MenuTarget } from '../plugins/types.js';
import { buildQuickAddCommand } from './quickAdd.js';
import type { Interactions } from './useInteractions.js';

/**
 * Context pad (Handoff 14 §1a): an action pad beside the single selected
 * node — the bpmn-js-style interaction that halves modelling steps. Spec
 * composition: append task / XOR gateway / end event, connect-to-existing,
 * a 5th PLUGIN slot (contract mirrors the N-5 context menu), and ⋯ opening
 * the full context menu for everything else (including delete).
 *
 * Passive affordance of the selection (like ports/resize handles): it is NOT
 * on the Esc dismissal stack — Esc clears the selection and the pad follows
 * (decision recorded in DECISIONS.md).
 */

/** Spec 1a: the pad column floats 8px outside the selection halo. */
const PAD_OFFSET = 8;
/** The selection halo extends 3px beyond the node bounds (NodeRenderer). */
const HALO = 3;
const BUTTON = 26;
const GAP = 4;
/** Touch target floor (cerca §1.2): invisible hit pad on coarse pointers. */
const TOUCH_TARGET = 44;

interface PadEntry {
  id: string;
  label: string;
  glyph: React.ReactNode;
  run: () => void;
  /** Drag-driven entries hook pointerdown instead of click. */
  onPointerDown?: (event: React.PointerEvent) => void;
}

const STROKE_GLYPHS = {
  task: <rect x={5} y={7} width={16} height={12} rx={3} fill="none" strokeWidth={1.5} />,
  gateway: (
    <path d="M 13 5 L 21 13 L 13 21 L 5 13 Z" fill="none" strokeWidth={1.5} />
  ),
  end: <circle cx={13} cy={13} r={7} fill="none" strokeWidth={2.4} />,
  connect: (
    <path d="M 7 19 L 17 9 M 12 7 H 19 V 14" strokeWidth={1.6} fill="none" />
  ),
  more: (
    <path
      d="M 8 13 h 0.01 M 13 13 h 0.01 M 18 13 h 0.01"
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
    />
  ),
};

function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
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
    viewportRight: s.viewport.x + s.viewport.width,
  }));

  if (view.readOnly || view.busy || !view.nodeId) return null;
  const node = diagram.nodes[view.nodeId];
  // Containers (pool/lane) and closed elements don't take quick-append.
  if (!node || node.removedInVersion || isContainerType(node.type)) return null;

  const quickAdd = (type: string) => {
    const { command, nodeId } = buildQuickAddCommand(
      diagram,
      config.registry,
      node,
      type,
      view.drillId,
    );
    const verdict = execute(command);
    if (verdict.allowed) {
      store.setState({ selectedIds: [nodeId], lastCreatedNodeId: nodeId });
    }
  };

  const entries: PadEntry[] = [
    { id: 'task', label: t('contextPad.appendTask'), glyph: STROKE_GLYPHS.task, run: () => quickAdd('task') },
    {
      id: 'gateway',
      label: t('contextPad.appendGateway'),
      glyph: STROKE_GLYPHS.gateway,
      run: () => quickAdd('exclusiveGateway'),
    },
    { id: 'end', label: t('contextPad.appendEnd'), glyph: STROKE_GLYPHS.end, run: () => quickAdd('endEvent') },
    {
      id: 'connect',
      label: t('contextPad.connect'),
      glyph: STROKE_GLYPHS.connect,
      run: () => {},
      onPointerDown: (event) => interactions.onPortPointerDown(event, node.id),
    },
  ];

  // 5th slot: first plugin-provided pad item (N-5-style contract, Handoff 14).
  const target: MenuTarget = {
    kind: 'node',
    id: node.id,
    point: { x: node.x + node.width / 2, y: node.y + node.height / 2 },
    diagram,
    selectedIds: [node.id],
  };
  const pluginItems: ContextPadItem[] = config.plugins
    .flatMap((plugin) => plugin.contextPadItems?.(target) ?? [])
    .filter((item) => !item.when || item.when(target));
  const fifth = pluginItems[0];
  if (fifth) {
    entries.push({
      id: `plugin/${fifth.id}`,
      label: fifth.label,
      glyph: (
        <text x={13} y={18} textAnchor="middle" fontSize={12} stroke="none" fill="currentColor">
          {fifth.glyph}
        </text>
      ),
      run: () => fifth.run(target, { execute: execute as (command: Command) => unknown }),
    });
  }

  // ⋯ always last: everything else (incl. delete) lives in the context menu.
  entries.push({
    id: 'more',
    label: t('contextPad.more'),
    glyph: STROKE_GLYPHS.more,
    run: () => interactions.openContextMenuForSelection(),
  });

  const touch = coarsePointer();
  const hit = touch ? TOUCH_TARGET : BUTTON;
  const step = hit + GAP;
  const totalHeight = entries.length * step - GAP;
  const top = node.y + node.height / 2 - totalHeight / 2;
  // Spec 1a: 8px outside the selection halo; viewport collision flips the
  // column to the node's left instead of clipping.
  const rightX = node.x + node.width + HALO + PAD_OFFSET;
  const flip = rightX + hit > view.viewportRight;
  const x = flip ? node.x - HALO - PAD_OFFSET - hit : rightX;
  const inset = (hit - BUTTON) / 2;

  return (
    <g data-context-pad data-context-pad-flipped={flip || undefined} role="toolbar" aria-label={t('contextPad.aria')}>
      {entries.map((entry, index) => {
        const y = top + index * step;
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
              entry.onPointerDown?.(event);
            }}
            onClick={(event) => {
              event.stopPropagation();
              entry.run();
            }}
          >
            <title>{entry.label}</title>
            {/* ≥44px hit area on coarse pointers (cerca §1.2). */}
            <rect x={x} y={y} width={hit} height={hit} fill="transparent" />
            <rect className="bpmnr-context-pad-face" x={x + inset} y={y + inset} width={BUTTON} height={BUTTON} rx={6} />
            <g transform={`translate(${x + inset}, ${y + inset})`} className="bpmnr-context-pad-glyph">
              {entry.glyph}
            </g>
          </g>
        );
      })}
    </g>
  );
}
