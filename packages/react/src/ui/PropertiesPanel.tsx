import { useEffect, useState } from 'react';
import {
  updateEdgeCommand,
  updateNodeCommand,
  type BpmnEdge,
  type BpmnNode,
} from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';

/**
 * Inspector for the selected element: label, purpose (edges) and free-form
 * properties. Property values are JSON — strings can be typed directly.
 */
export function PropertiesPanel() {
  const { diagram } = useDiagram();
  const { inspectorSections } = useEditorConfig();
  const selectedIds = useCanvasState((s) => s.selectedIds);
  const readOnly = useCanvasState((s) => s.readOnly);

  if (selectedIds.length !== 1) {
    return (
      <aside className="bpmnr-inspector" aria-label="Properties">
        <p className="bpmnr-inspector-empty">
          {selectedIds.length === 0 ? 'Nothing selected' : `${selectedIds.length} elements selected`}
        </p>
      </aside>
    );
  }

  const id = selectedIds[0];
  const node = diagram.nodes[id];
  const edge = diagram.edges[id];
  return (
    <aside className="bpmnr-inspector" aria-label="Properties">
      {node && <NodeInspector node={node} readOnly={readOnly} />}
      {/* Plugin sections (Handoff 5, wireframe 2d) — e.g. DMN "Decisão". */}
      {node &&
        inspectorSections
          .filter((section) => section.appliesTo(node))
          .map((section) => <section.component key={section.id} node={node} />)}
      {edge && <EdgeInspector edge={edge} readOnly={readOnly} />}
      {!node && !edge && <p className="bpmnr-inspector-empty">Element not found</p>}
    </aside>
  );
}

function NodeInspector({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { execute } = useDiagram();
  return (
    <div data-inspector-node={node.id}>
      <h3 className="bpmnr-inspector-title">{node.type}</h3>
      <Field
        label="Label"
        value={node.label}
        readOnly={readOnly}
        onCommit={(label) => execute(updateNodeCommand(node.id, { label }))}
      />
      <PropertiesEditor
        properties={node.properties}
        readOnly={readOnly}
        onCommit={(properties) => execute(updateNodeCommand(node.id, { properties }))}
      />
      <dl className="bpmnr-inspector-meta">
        <dt>Created in version</dt>
        <dd>{node.createdInVersion}</dd>
        {node.removedInVersion && (
          <>
            <dt>Closed in version</dt>
            <dd>{node.removedInVersion}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function EdgeInspector({ edge, readOnly }: { edge: BpmnEdge; readOnly: boolean }) {
  const { execute } = useDiagram();
  return (
    <div data-inspector-edge={edge.id}>
      <h3 className="bpmnr-inspector-title">{edge.type}</h3>
      <Field
        label="Label"
        value={edge.label ?? ''}
        readOnly={readOnly}
        onCommit={(label) => execute(updateEdgeCommand(edge.id, { label }))}
      />
      <Field
        label="Purpose"
        value={edge.purpose ?? ''}
        readOnly={readOnly}
        placeholder="Why does this handoff exist?"
        onCommit={(purpose) => execute(updateEdgeCommand(edge.id, { purpose }))}
      />
      <dl className="bpmnr-inspector-meta">
        <dt>Created in version</dt>
        <dd>{edge.createdInVersion}</dd>
        {edge.removedInVersion && (
          <>
            <dt>Closed in version</dt>
            <dd>{edge.removedInVersion}</dd>
          </>
        )}
        {edge.supersedesEdgeId && (
          <>
            <dt>Supersedes</dt>
            <dd>{edge.supersedesEdgeId}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  onCommit,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  readOnly: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="bpmnr-field">
      <span>{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(value);
        }}
      />
    </label>
  );
}

function PropertiesEditor({
  properties,
  onCommit,
  readOnly,
}: {
  properties: Record<string, unknown>;
  onCommit: (properties: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const [newKey, setNewKey] = useState('');
  const entries = Object.entries(properties);
  return (
    <div className="bpmnr-props">
      <h4>Properties</h4>
      {entries.length === 0 && <p className="bpmnr-inspector-empty">No properties</p>}
      {entries.map(([key, value]) => (
        <Field
          key={key}
          label={key}
          value={typeof value === 'string' ? value : JSON.stringify(value)}
          readOnly={readOnly}
          onCommit={(raw) => onCommit({ [key]: parseValue(raw) })}
        />
      ))}
      {!readOnly && (
        <form
          className="bpmnr-props-add"
          onSubmit={(e) => {
            e.preventDefault();
            const key = newKey.trim();
            if (!key) return;
            onCommit({ [key]: '' });
            setNewKey('');
          }}
        >
          <input
            type="text"
            value={newKey}
            placeholder="Add property…"
            aria-label="New property name"
            onChange={(e) => setNewKey(e.target.value)}
          />
          <button type="submit">+</button>
        </form>
      )}
    </div>
  );
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
