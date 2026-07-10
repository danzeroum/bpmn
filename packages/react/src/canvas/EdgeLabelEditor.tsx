import { useEffect, useRef, useState } from 'react';
import { updateEdgeCommand } from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { computeRoutedWaypoints } from './routeEdge.js';
import { longestSegmentMidpoint } from './EdgeRenderer.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Inline edge-label editor (Handoff 11 N-5, "Editar rótulo"): a foreignObject
 * input at the label anchor (longest free segment midpoint, R-4 rule).
 * Commits via updateEdgeCommand on Enter/blur, cancels on Escape — the same
 * contract as the node label editor; the commit is always a command.
 */
export function EdgeLabelEditor() {
  const store = useCanvasStore();
  const editingEdgeId = useCanvasState((s) => s.editingEdgeId);
  const { diagram, execute } = useDiagram();
  const config = useEditorConfig();
  const t = useT();
  const edge = editingEdgeId ? diagram.edges[editingEdgeId] : undefined;

  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (!edge) return;
    committedRef.current = false;
    setValue(edge.label ?? '');
    const input = inputRef.current;
    input?.focus();
    input?.select();
    // Re-run only when a NEW edit session starts.
  }, [editingEdgeId]);

  if (!edge) return null;
  const route =
    edge.waypoints ?? computeRoutedWaypoints(diagram, edge, config.edgeRouter)?.waypoints;
  if (!route || route.length < 2) return null;
  const anchor = longestSegmentMidpoint(route);

  const close = () => store.setState({ editingEdgeId: null });
  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const next = value.trim();
    if (next !== (edge.label ?? '')) execute(updateEdgeCommand(edge.id, { label: next }));
    close();
  };
  const cancel = () => {
    committedRef.current = true;
    close();
  };

  return (
    <foreignObject x={anchor.x - 70} y={anchor.y - 14} width={140} height={28}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={t('edgeLabel.aria')}
        data-edge-label-editor={edge.id}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') commit();
          else if (event.key === 'Escape') cancel();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          font: 'inherit',
          fontSize: 12,
          padding: '3px 6px',
          borderRadius: 6,
          border: '1px solid var(--bpmnr-selected, #1a6a54)',
          background: 'var(--bpmnr-canvas-bg, #faf9f6)',
          color: 'inherit',
        }}
      />
    </foreignObject>
  );
}
