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
import {
  bpmnDiagramAdapter,
  connectorAdapter,
  createRecipeAdapter,
  dmnDecisionAdapter,
  personaAdapter,
  policyAdapter,
  promptAdapter,
} from '@bpmn-react/adapters-bpmn';
import type { ArtifactAction, ArtifactAdapter, ArtifactRef, LibraryQuery, LifecycleStatus, LibrarySort } from '@bpmn-react/library';
import { StudioShell } from '@bpmn-react/studio';
import '@bpmn-react/library-react/styles.css';
import '@bpmn-react/studio/styles.css';

/**
 * `?studio=1` — the full BuildToValue Studio (Handoff 6 S-4/S-5/S-6):
 * Biblioteca (todos os adapters, incl. DMN e o fake "recipe"), Revisão e
 * Auditoria sobre um mundo demo compartilhado. O papel do usuário é
 * alternável (Bruna/Carla) e os filtros+seleção da Biblioteca vivem na URL
 * (§10.7). Aprovar registra a decisão mas NUNCA ativa (§11).
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
  /** `?tamper=1`: a forged copy for the broken-chain demo/e2e (§10.5). */
  auditLedger: AuditLedger | { entries: ReturnType<AuditLedger['export']>['entries'] };
}

/** Single-type definition diagram (persona/prompt/connector/política). */
async function registerDefinition(
  registry: VersionRegistry,
  options: { id: string; name: string; versionId: string; semver: string; nodeType: string; status?: 'active' | 'candidate' | 'draft' },
): Promise<void> {
  const diagram = createDiagram({ name: options.name, id: options.id });
  diagram.version = {
    id: options.versionId,
    semanticVersion: options.semver,
    status: options.status ?? 'active',
    approvedBy: [],
    changeSummary: `Definição de ${options.name}.`,
    createdBy: 'ana',
    createdAt: '2026-05-10T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.nodes['n0'] = demoNode('n0', options.nodeType, 40, options.name);
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  await registry.register(diagram);
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
  // a DMN decision lives inside the registered flow → the dmn-decision
  // adapter surfaces it in the Biblioteca as "mais um adapter" (§1)
  baseline.nodes['dec-limite'] = {
    ...demoNode('dec-limite', 'dmn:decision', 180, 'Limite de crédito'),
    y: 140,
    properties: {
      decisionTable: {
        hitPolicy: 'F',
        inputs: [{ id: 'i1', label: 'Score', expression: 'score', typeRef: 'number' }],
        outputs: [{ id: 'o1', label: 'Aprovado', expression: 'ok', typeRef: 'boolean' }],
        rules: [
          { id: 'r1', inputEntries: ['>= 700'], outputEntries: ['true'] },
          { id: 'r2', inputEntries: ['< 700'], outputEntries: ['false'] },
        ],
      },
    },
  };
  baseline.version.snapshotHash = await computeDiagramHash(baseline);
  await registry.register(baseline);

  await registerDefinition(registry, { id: 'persona-analista', name: 'Analista de crédito', versionId: 'pa-v1', semver: '1.1.0', nodeType: 'btv:persona', status: 'candidate' });
  await registerDefinition(registry, { id: 'prompt-resumo', name: 'Prompt de resumo', versionId: 'pr-v1', semver: '1.0.0', nodeType: 'btv:prompt' });
  await registerDefinition(registry, { id: 'conector-crm', name: 'Conector CRM', versionId: 'cc-v1', semver: '2.3.0', nodeType: 'btv:connector' });
  await registerDefinition(registry, { id: 'politica-credito', name: 'Política de crédito', versionId: 'pc-v1', semver: '1.0.0', nodeType: 'btv:gate' });

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
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'onb-v2', details: { nodeId: 'auto', artifactId: 'onboarding' } });
  await ledger.append({ type: 'NODE_UPDATED', userId: 'ana', versionId: 'onb-v2', details: { nodeId: 'work', artifactId: 'onboarding' } });
  await ledger.append({
    type: 'APPROVAL_RECORDED',
    userId: 'carla',
    versionId: 'onb-v2',
    details: { role: 'compliance', artifactId: 'onboarding' },
  });
  await ledger.append({
    type: 'VERSION_ATTESTED',
    userId: 'ana',
    versionId: 'onb-v1',
    details: {
      artifactId: 'onboarding',
      xmlHash: baseline.version.snapshotHash,
      ledgerHeadHash: ledger.getEntries()[2]?.hash ?? '',
      effectiveFrom: '2026-03-01T00:00:00.000Z',
      approvers: [{ userId: 'bruna' }, { userId: 'carla' }],
    },
  });

  // `?tamper=1` flips one byte of an entry — the Explorer must point at the
  // exact break and distrust everything after it (§10.5).
  const tampered = new URLSearchParams(window.location.search).get('tamper') !== null;
  let auditLedger: StudioWorld['auditLedger'] = ledger;
  if (tampered) {
    const forged = ledger.export();
    forged.entries[1].details = { ...forged.entries[1].details, nodeId: 'work!' };
    auditLedger = forged;
  }

  return {
    adapters: [
      bpmnDiagramAdapter(registry),
      personaAdapter(registry),
      promptAdapter(registry),
      connectorAdapter(registry),
      policyAdapter(registry),
      dmnDecisionAdapter(registry),
      createRecipeAdapter(),
    ],
    candidates: [candidate],
    baseline,
    registry,
    ledger,
    auditLedger,
  };
}

/** Papel do usuário (S-6): the queue and the approve button follow it. */
const USERS: UserContext[] = [
  { id: 'bruna', role: 'process-owner', name: 'Bruna' },
  { id: 'carla', role: 'compliance', name: 'Carla' },
];

function libraryQueryFromUrl(): LibraryQuery {
  const params = new URLSearchParams(window.location.search);
  const query: LibraryQuery = {};
  const text = params.get('q');
  if (text) query.text = text;
  const statuses = params.get('status');
  if (statuses) query.statuses = statuses.split(',') as LifecycleStatus[];
  const types = params.get('type');
  if (types) query.adapterIds = types.split(',');
  const sort = params.get('sort');
  if (sort === 'updated' || sort === 'status') query.sort = sort as LibrarySort;
  return query;
}

function selectionFromUrl(): ArtifactRef | undefined {
  const raw = new URLSearchParams(window.location.search).get('sel');
  if (!raw) return undefined;
  const separator = raw.indexOf(':');
  if (separator < 1) return undefined;
  return { adapterId: raw.slice(0, separator), artifactId: raw.slice(separator + 1) };
}

function syncUrl(mutate: (params: URLSearchParams) => void): void {
  const params = new URLSearchParams(window.location.search);
  mutate(params);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

export function StudioSurface() {
  const [world, setWorld] = useState<StudioWorld>();
  const [user, setUser] = useState<UserContext>(USERS[0]);
  const [lastAction, setLastAction] = useState('');
  const initialQuery = useMemo(libraryQueryFromUrl, []);
  const initialSelection = useMemo(selectionFromUrl, []);

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

  const onLibraryAction = (ref: ArtifactRef, action: ArtifactAction) => {
    setLastAction(`${action.id} → ${ref.adapterId}:${ref.artifactId}`);
    if (action.id === 'open-designer') {
      // Studio nunca edita (§11): abre o Designer; voltar restaura filtros e
      // seleção da Biblioteca a partir da URL (§10.7).
      window.location.href = '/';
    }
  };

  if (!world || !review) return <p className="demo-muted">Carregando o Studio…</p>;
  return (
    <>
      <div style={{ position: 'fixed', bottom: 34, right: 12, display: 'flex', gap: 10, alignItems: 'center', zIndex: 10 }}>
        <span data-testid="last-action" style={{ fontSize: 10, opacity: 0.6 }}>
          {lastAction}
        </span>
        <label style={{ fontSize: 10, opacity: 0.8 }}>
          papel:{' '}
          <select
            aria-label="Trocar usuário"
            value={user.id}
            onChange={(e) => setUser(USERS.find((u) => u.id === e.target.value) ?? USERS[0])}
          >
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </label>
      </div>
      <StudioShell
        key={user.id}
        user={user}
        library={{
          adapters: world.adapters,
          onAction: onLibraryAction,
          initialQuery,
          initialSelection,
          onQueryChange: (query) =>
            syncUrl((params) => {
              const sync = (key: string, value: string | undefined) => {
                if (value) params.set(key, value);
                else params.delete(key);
              };
              sync('q', query.text || undefined);
              sync('status', query.statuses?.length ? query.statuses.join(',') : undefined);
              sync('type', query.adapterIds?.length ? query.adapterIds.join(',') : undefined);
              sync('sort', query.sort && query.sort !== 'name' ? query.sort : undefined);
            }),
          onSelectionChange: (ref) =>
            syncUrl((params) => {
              if (ref) params.set('sel', `${ref.adapterId}:${ref.artifactId}`);
              else params.delete('sel');
            }),
        }}
        review={review}
        audit={{
          ledger: world.auditLedger,
          registry: world.registry,
          onAction: (action) => setLastAction(`${action.id} → seq ${action.entry.seq}`),
        }}
      />
    </>
  );
}
