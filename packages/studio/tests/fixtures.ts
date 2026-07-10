import {
  createDiagram,
  type ApprovalRecord,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type VersionStatus,
} from '@buildtovalue/core';

const AUDIT = { createdBy: 'ana', createdAt: '2026-06-01T00:00:00.000Z', history: [] };

function node(id: string, type: string, x: number, properties: Record<string, unknown> = {}): BpmnNode {
  return { id, type, label: id, x, y: 40, width: 120, height: 60, properties, createdInVersion: 'v0', audit: AUDIT };
}

function edge(id: string, sourceId: string, targetId: string): BpmnEdge {
  return { id, type: 'sequenceFlow', sourceId, targetId, properties: {}, createdInVersion: 'v0', audit: AUDIT };
}

/**
 * A well-formed candidate flow (start → task → end) carrying an explicit
 * version identity — sound, exportable and certifiable, so the verification
 * cards go green unless a test breaks something on purpose.
 */
export function candidateDiagram(options: {
  id?: string;
  name?: string;
  versionId?: string;
  semver?: string;
  status?: VersionStatus;
  approvedBy?: ApprovalRecord[];
  changeSummary?: string;
  effectiveFrom?: string;
  extraNodes?: BpmnNode[];
} = {}): BpmnDiagram {
  const diagram = createDiagram({ name: options.name ?? 'Onboarding', id: options.id ?? 'onboarding' });
  diagram.version = {
    id: options.versionId ?? 'v2',
    semanticVersion: options.semver ?? '2.0.0',
    status: options.status ?? 'candidate',
    approvedBy: options.approvedBy ?? [],
    changeSummary: options.changeSummary ?? 'Automatiza a checagem de documentos do onboarding.',
    createdBy: 'ana',
    createdAt: '2026-06-20T00:00:00.000Z',
    snapshotHash: '',
    ...(options.effectiveFrom ? { effectiveFrom: options.effectiveFrom } : {}),
  };
  for (const n of [node('start', 'startEvent', 10), node('work', 'task', 180), node('end', 'endEvent', 350)]) {
    diagram.nodes[n.id] = n;
  }
  for (const e of [edge('e1', 'start', 'work'), edge('e2', 'work', 'end')]) {
    diagram.edges[e.id] = e;
  }
  for (const extra of options.extraNodes ?? []) {
    diagram.nodes[extra.id] = extra;
  }
  return diagram;
}

export function extraNode(id: string, type: string, properties: Record<string, unknown> = {}): BpmnNode {
  return node(id, type, 500, properties);
}
