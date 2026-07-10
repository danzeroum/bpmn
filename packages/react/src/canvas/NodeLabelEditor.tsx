import { useEffect, useRef, useState } from 'react';
import { updateNodeCommand, type BpmnNode } from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Inline label editor rendered over a node via an SVG `<foreignObject>`, so
 * it scales and pans with the `viewBox` like the rest of the canvas. Commits
 * on Enter or blur, cancels on Escape. Only mounted for the node currently
 * being edited, so the input hooks carry no per-node cost.
 */
export function NodeLabelEditor({ node }: { node: BpmnNode }) {
  const { execute } = useDiagram();
  const store = useCanvasStore();
  const t = useT();
  const [value, setValue] = useState(node.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const close = () => store.setState({ editingNodeId: null });

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const next = value.trim();
    if (next && next !== node.label) execute(updateNodeCommand(node.id, { label: next }));
    close();
  };

  const cancel = () => {
    committedRef.current = true;
    close();
  };

  return (
    <foreignObject x={4} y={node.height / 2 - 14} width={Math.max(node.width - 8, 40)} height={28}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={t('nodeLabel.aria')}
        data-node-label-editor={node.id}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          font: 'inherit',
          fontSize: 12,
          textAlign: 'center',
          border: '1.5px solid var(--bpmnr-selected, #1a6a54)',
          borderRadius: 4,
          padding: '2px 4px',
          background: 'var(--bpmnr-fill, #ffffff)',
          color: 'var(--bpmnr-text, #262220)',
          outline: 'none',
        }}
      />
    </foreignObject>
  );
}
