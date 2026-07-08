import {
  computeDiagramHash,
  createDiagram,
  type ApprovalRecord,
  type BpmnDiagram,
  type BpmnNode,
  type VersionStatus,
} from '@bpmn-react/core';
import { VersionRegistry } from '@bpmn-react/registry';

export interface FixtureNode {
  id: string;
  type: string;
  label?: string;
  x?: number;
  y?: number;
  properties?: Record<string, unknown>;
  removedInVersion?: string;
}

/**
 * Same pattern as registry/tests/versionRegistry.test.ts's diagramAt: a
 * diagram carrying an explicit version identity so registry queries have
 * real data. `id` is the logical-artifact identity shared across versions.
 */
export async function diagramAt(options: {
  id?: string;
  name?: string;
  description?: string;
  versionId: string;
  semver: string;
  status?: VersionStatus;
  createdAt?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  approvedBy?: ApprovalRecord[];
  changeSummary?: string;
  metadata?: Record<string, unknown>;
  nodes?: FixtureNode[];
}): Promise<BpmnDiagram> {
  const diagram = createDiagram({ name: options.name ?? 'Flow', id: options.id ?? 'flow-1' });
  if (options.description) diagram.description = options.description;
  if (options.metadata) diagram.metadata = { ...options.metadata };
  diagram.version = {
    id: options.versionId,
    semanticVersion: options.semver,
    status: options.status ?? 'active',
    approvedBy: options.approvedBy ?? [],
    changeSummary: options.changeSummary ?? `Version ${options.semver}`,
    createdBy: 'alice',
    createdAt: options.createdAt ?? '2026-01-01T00:00:00.000Z',
    snapshotHash: '',
    ...(options.effectiveFrom ? { effectiveFrom: options.effectiveFrom } : {}),
    ...(options.effectiveUntil ? { effectiveUntil: options.effectiveUntil } : {}),
  };
  for (const spec of options.nodes ?? [{ id: 'n0', type: 'task', label: 'Task 0' }]) {
    // Plain literals instead of createNode: domain types (btv:*, dmn:*) are
    // registered by plugins at app level, which these headless tests bypass.
    const node: BpmnNode = {
      id: spec.id,
      type: spec.type,
      label: spec.label ?? spec.id,
      x: spec.x ?? 40,
      y: spec.y ?? 40,
      width: 120,
      height: 60,
      properties: spec.properties ?? {},
      createdInVersion: options.versionId,
      audit: {
        createdBy: 'alice',
        createdAt: options.createdAt ?? '2026-01-01T00:00:00.000Z',
        history: [],
      },
    };
    if (spec.removedInVersion) node.removedInVersion = spec.removedInVersion;
    diagram.nodes[node.id] = node;
  }
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  return diagram;
}

/** Registry with two versions of a flow plus one persona-definition diagram. */
export async function seededRegistry(): Promise<VersionRegistry> {
  const registry = new VersionRegistry();
  await registry.register(
    await diagramAt({
      id: 'onboarding',
      name: 'Onboarding de clientes',
      versionId: 'onb-v1',
      semver: '1.0.0',
      status: 'deprecated',
      createdAt: '2026-01-01T00:00:00.000Z',
      changeSummary: 'Primeira versão do fluxo.',
    }),
  );
  await registry.register(
    await diagramAt({
      id: 'onboarding',
      name: 'Onboarding de clientes',
      description: 'Fluxo canônico de onboarding',
      versionId: 'onb-v2',
      semver: '2.0.0',
      status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
      effectiveFrom: '2026-03-02T00:00:00.000Z',
      approvedBy: [
        { userId: 'bruna', role: 'process-owner', approvedAt: '2026-02-20T00:00:00.000Z', reason: 'ok' },
        { userId: 'carla', role: 'compliance', approvedAt: '2026-02-21T00:00:00.000Z', reason: 'ok' },
      ],
      changeSummary: 'Automatiza a checagem de documentos.',
      nodes: [
        { id: 'start', type: 'startEvent', x: 10, y: 40 },
        { id: 'check', type: 'task', x: 120, y: 30 },
        { id: 'gw', type: 'exclusiveGateway', x: 260, y: 35 },
        { id: 'done', type: 'btv:deliverable', x: 380, y: 40 },
      ],
    }),
  );
  await registry.register(
    await diagramAt({
      id: 'persona-analista',
      name: 'Analista de crédito',
      versionId: 'pa-v1',
      semver: '1.1.0',
      status: 'candidate',
      createdAt: '2026-05-01T00:00:00.000Z',
      changeSummary: 'Persona revisada com novos limites.',
      nodes: [{ id: 'p0', type: 'btv:persona', label: 'Analista' }],
    }),
  );
  return registry;
}
