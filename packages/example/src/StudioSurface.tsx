import { useEffect, useMemo, useState } from 'react';
import {
  AuditLedger,
  LifecycleEngine,
  computeDiagramHash,
  createDiagram,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type UserContext,
} from '@bpmn-react/core';
import { VersionRegistry } from '@bpmn-react/registry';
import { bpmnDiagramAdapter, createRecipeAdapter, personaAdapter } from '@bpmn-react/adapters-bpmn';
import type { ArtifactAdapter } from '@bpmn-react/library';
import { StudioShell } from '@bpmn-react/studio';
import '@bpmn-react/library-react/styles.css';
import '@bpmn-react/studio/styles.css';

/**
 * `?studio=1` — the BuildToValue Studio shell (Handoff 6 S-4): Biblioteca +
 * Revisão do Aprovador over a demo world (registry, ledger, one pending
 * promotion with 1/2 approvals). The approver is Bruna (process-owner);
 * approving records the decision but NEVER activates (§11).
 */

const AUDIT = { createdBy: 'ana', createdAt: '2026-06-01T00:00:00.000Z', history: [] };

function demoNode(id: string, type: string, x: number, label?: string): BpmnNode {
  return { id, type, label: label ?? id, x, y: 40, width: 120, height: 60, properties: {}, createdInVersion: 'v0', audit: AUDIT };
}

function demoEdge(id: string, sourceId: string, targetId: string): BpmnEdge {
  return { id, type: 'sequenceFlow', sourceId, targetId, properties: {}, createdInVersion: 'v0', audit: AUDIT };
}

function buildFlow(options: {
  id: string;
  name: string;
  versionId: string;
  semver: string;
  status: 'active' | 'candidate';
  changeSummary: string;
  approvedBy?: BpmnDiagram['version']['approvedBy'];
  effectiveFrom?: string;
}): BpmnDiagram {
  const diagram = createDiagram({ name: options.name, id: options.id });
  diagram.version = {
    id: options.versionId,
    semanticVersion: options.semver,
    status: options.status,
    approvedBy: options.approvedBy ?? [],
    changeSummary: options.changeSummary,
    createdBy: 'ana',
    createdAt: '2026-06-20T00:00:00.000Z',
    snapshotHash: '',
    ...(options.effectiveFrom ? { effectiveFrom: options.effectiveFrom } : {}),
  };
  for (const n of [demoNode('start', 'startEvent', 10, 'Início'), demoNode('work', 'task', 180, 'Checar documentos'), demoNode('end', 'endEvent', 350, 'Concluído')]) {
    diagram.nodes[n.id] = n;
  }
  for (const e of [demoEdge('e1', 'start', 'work'), demoEdge('e2', 'work', 'end')]) {
    diagram.edges[e.id] = e;
  }
  return diagram;
}

interface StudioWorld {
  adapters: ArtifactAdapter[];
  candidates: BpmnDiagram[];
  baseline: BpmnDiagram;
  registry: VersionRegistry;
  ledger: AuditLedger;
}

async function buildWorld(): Promise<StudioWorld> {
  const registry = new VersionRegistry();
  const baseline = buildFlow({
    id: 'onboarding',
    name: 'Onboarding de clientes',
    versionId: 'onb-v1',
    semver: '1.0.0',
    status: 'active',
    changeSummary: 'Primeira versão ativa do fluxo de onboarding.',
    effectiveFrom: '2026-03-01T00:00:00.000Z',
  });
  baseline.version.snapshotHash = await computeDiagramHash(baseline);
  await registry.register(baseline);

  const candidate = buildFlow({
    id: 'onboarding',
    name: 'Onboarding de clientes',
    versionId: 'onb-v2',
    semver: '2.0.0',
    status: 'candidate',
    changeSummary: 'Automatiza a checagem de documentos e remove o passo manual.',
    approvedBy: [
      { userId: 'carla', role: 'compliance', approvedAt: '2026-07-01T00:00:00.000Z', reason: 'Conformidade ok.' },
    ],
    effectiveFrom: '2026-07-10T00:00:00.000Z',
  });
  // v2 inserts the automated check between the manual step and the end —
  // the diff shows the added node/edges and the superseded direct edge.
  candidate.nodes['auto'] = demoNode('auto', 'task', 350, 'Checagem automática');
  delete candidate.edges['e2'];
  candidate.edges['e3'] = demoEdge('e3', 'work', 'auto');
  candidate.edges['e4'] = demoEdge('e4', 'auto', 'end');
  candidate.nodes['end'].x = 520;

  const ledger = new AuditLedger();
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'onb-v2', details: { nodeId: 'auto' } });
  await ledger.append({ type: 'NODE_UPDATED', userId: 'ana', versionId: 'onb-v2', details: { nodeId: 'work' } });

  return {
    adapters: [bpmnDiagramAdapter(registry), personaAdapter(registry), createRecipeAdapter()],
    candidates: [candidate],
    baseline,
    registry,
    ledger,
  };
}

const BRUNA: UserContext = { id: 'bruna', role: 'process-owner', name: 'Bruna' };

export function StudioSurface() {
  const [world, setWorld] = useState<StudioWorld>();
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    void buildWorld().then(setWorld);
  }, []);

  const review = useMemo(() => {
    if (!world) return undefined;
    return {
      candidates: world.candidates,
      engine: new LifecycleEngine(),
      ledger: world.ledger,
      registry: world.registry,
      baselineOf: () => world.baseline,
    };
  }, [world]);

  if (!world || !review) return <p className="demo-muted">Carregando o Studio…</p>;
  return (
    <>
      <span data-testid="last-action" style={{ position: 'fixed', bottom: 34, right: 12, fontSize: 10, opacity: 0.6 }}>
        {lastAction}
      </span>
      <StudioShell
        user={BRUNA}
        library={{
          adapters: world.adapters,
          onAction: (ref, action) => setLastAction(`${action.id} → ${ref.adapterId}:${ref.artifactId}`),
        }}
        review={review}
      />
    </>
  );
}
