import type { BpmnDiagram, BpmnDiff } from '@buildtovalue/core';
import { isEmptyDiff } from '@buildtovalue/core';

export interface DiffViewProps {
  diff: BpmnDiff;
  /** Used to resolve element labels; falls back to raw ids. */
  diagram?: BpmnDiagram;
}

/** Human-readable, structured rendering of a diagram diff. */
export function DiffView({ diff, diagram }: DiffViewProps) {
  if (isEmptyDiff(diff)) {
    return <p className="bpmnr-diff-empty">No changes.</p>;
  }
  const nodeLabel = (id: string) => diagram?.nodes[id]?.label ?? id;

  return (
    <div className="bpmnr-diff" aria-label="Diagram changes">
      {diff.nodes.length > 0 && (
        <section>
          <h4>Nodes</h4>
          <ul>
            {diff.nodes.map((op, index) => (
              <li key={index} data-op={op.op}>
                {op.op === 'add' && (
                  <>
                    <OpTag op="add" /> {op.node.type} “{op.node.label}”
                  </>
                )}
                {op.op === 'remove' && (
                  <>
                    <OpTag op="remove" /> {nodeLabel(op.nodeId)}
                  </>
                )}
                {op.op === 'update' && (
                  <>
                    <OpTag op="update" /> {nodeLabel(op.nodeId)}: {describeChanges(op.changes)}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {diff.edges.length > 0 && (
        <section>
          <h4>Connections</h4>
          <ul>
            {diff.edges.map((op, index) => (
              <li key={index} data-op={op.op}>
                {op.op === 'add' && (
                  <>
                    <OpTag op="add" /> {nodeLabel(op.edge.sourceId)} → {nodeLabel(op.edge.targetId)}
                  </>
                )}
                {op.op === 'remove' && (
                  <>
                    <OpTag op="remove" /> {op.edgeId}
                  </>
                )}
                {op.op === 'update' && (
                  <>
                    <OpTag op="update" /> {op.edgeId}: {describeChanges(op.changes)}
                  </>
                )}
                {op.op === 'supersede' && (
                  <>
                    <OpTag op="supersede" /> {op.edgeId} superseded by {op.newEdgeId}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {Object.keys(diff.metadata).length > 0 && (
        <section>
          <h4>Metadata</h4>
          <ul>
            {Object.entries(diff.metadata).map(([key, change]) => (
              <li key={key}>
                <OpTag op="update" /> {key}: {JSON.stringify(change.from)} →{' '}
                {JSON.stringify(change.to)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OpTag({ op }: { op: 'add' | 'remove' | 'update' | 'supersede' }) {
  const labels = { add: '+', remove: '−', update: '~', supersede: '⇄' };
  return (
    <span className={`bpmnr-diff-tag bpmnr-diff-${op}`} aria-label={op}>
      {labels[op]}
    </span>
  );
}

function describeChanges(changes: Record<string, { from: unknown; to: unknown }>): string {
  return Object.entries(changes)
    .map(([field, { from, to }]) => `${field}: ${short(from)} → ${short(to)}`)
    .join(', ');
}

function short(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return '∅';
  return text.length > 24 ? text.slice(0, 21) + '…' : text;
}
