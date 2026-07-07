import { readFile } from 'node:fs/promises';
import {
  BpmnXmlConverter,
  isEmptyDiff,
  JsonSerializer,
  type BpmnDiagram,
  type BpmnDiff,
  type ValidationResult,
} from '@bpmn-react/core';

export interface LoadResult {
  diagram: BpmnDiagram;
  warnings: string[];
}

/** Loads a diagram from a `.json` or `.xml`/`.bpmn` file. */
export async function loadDiagram(path: string): Promise<LoadResult> {
  const content = await readFile(path, 'utf8');
  if (path.endsWith('.json')) {
    return { diagram: new JsonSerializer().deserialize(content), warnings: [] };
  }
  const { diagram, warnings } = new BpmnXmlConverter().fromXml(content);
  return { diagram, warnings };
}

export function formatValidation(result: ValidationResult): string {
  if (result.issues.length === 0) return '✓ No issues found';
  const lines = result.issues.map(
    (issue) =>
      `${issue.severity === 'error' ? '✗' : '⚠'} [${issue.code}] ${issue.message}` +
      (issue.nodeId ? ` (node ${issue.nodeId})` : issue.edgeId ? ` (edge ${issue.edgeId})` : ''),
  );
  return lines.join('\n');
}

export function formatDiff(diff: BpmnDiff): string {
  if (isEmptyDiff(diff)) return 'No changes.';
  const lines: string[] = [];
  for (const op of diff.nodes) {
    if (op.op === 'add') lines.push(`+ node ${op.node.id} (${op.node.type} "${op.node.label}")`);
    else if (op.op === 'remove') lines.push(`- node ${op.nodeId}`);
    else lines.push(`~ node ${op.nodeId}: ${Object.keys(op.changes).join(', ')}`);
  }
  for (const op of diff.edges) {
    if (op.op === 'add') lines.push(`+ edge ${op.edge.id} (${op.edge.sourceId} → ${op.edge.targetId})`);
    else if (op.op === 'remove') lines.push(`- edge ${op.edgeId}`);
    else if (op.op === 'supersede') lines.push(`⇄ edge ${op.edgeId} superseded by ${op.newEdgeId}`);
    else lines.push(`~ edge ${op.edgeId}: ${Object.keys(op.changes).join(', ')}`);
  }
  for (const [key, change] of Object.entries(diff.metadata)) {
    lines.push(`~ metadata ${key}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`);
  }
  return lines.join('\n');
}
