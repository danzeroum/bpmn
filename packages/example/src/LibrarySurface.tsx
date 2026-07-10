import { useEffect, useMemo, useState } from 'react';
import { computeDiagramHash, createDiagram, type BpmnNode } from '@buildtovalue/core';
import { VersionRegistry } from '@buildtovalue/registry';
import {
  bpmnDiagramAdapter,
  createRecipeAdapter,
  personaAdapter,
} from '@buildtovalue/adapters-bpmn';
import type {
  ArtifactAction,
  ArtifactAdapter,
  ArtifactRef,
  LibraryQuery,
  LifecycleStatus,
  LibrarySort,
} from '@buildtovalue/library';
import { LibraryView } from '@buildtovalue/library-react';
import '@buildtovalue/library-react/styles.css';

/**
 * `?library=1` — the Biblioteca surface (Handoff 6 S-3): LibraryView over a
 * demo registry (concrete BPMN/persona adapters) PLUS the recipe fixture —
 * the §10.1 acid test running live in the host. Query state round-trips to
 * the URL (§10.7 groundwork; the Studio shell owns full navigation in S-4).
 */

function demoNode(id: string, type: string, x: number, label?: string): BpmnNode {
  return {
    id,
    type,
    label: label ?? id,
    x,
    y: 40,
    width: 120,
    height: 60,
    properties: {},
    createdInVersion: 'v1',
    audit: { createdBy: 'ana', createdAt: '2026-06-01T00:00:00.000Z', history: [] },
  };
}

async function seedRegistry(): Promise<VersionRegistry> {
  const registry = new VersionRegistry();
  const onboarding = createDiagram({ name: 'Onboarding de clientes', id: 'onboarding' });
  onboarding.description = 'Fluxo canônico de onboarding';
  onboarding.version = {
    id: 'onb-v2',
    semanticVersion: '2.0.0',
    status: 'active',
    approvedBy: [
      { userId: 'bruna', role: 'process-owner', approvedAt: '2026-05-20T00:00:00.000Z', reason: 'ok' },
      { userId: 'carla', role: 'compliance', approvedAt: '2026-05-21T00:00:00.000Z', reason: 'ok' },
    ],
    changeSummary: 'Automatiza a checagem de documentos.',
    createdBy: 'ana',
    createdAt: '2026-06-01T00:00:00.000Z',
    snapshotHash: '',
    effectiveFrom: '2026-06-02T00:00:00.000Z',
  };
  for (const node of [
    demoNode('start', 'startEvent', 10, 'Início'),
    demoNode('check', 'task', 160, 'Checar documentos'),
    demoNode('done', 'endEvent', 320, 'Concluído'),
  ]) {
    onboarding.nodes[node.id] = node;
  }
  onboarding.version.snapshotHash = await computeDiagramHash(onboarding);
  await registry.register(onboarding);

  const persona = createDiagram({ name: 'Analista de crédito', id: 'persona-analista' });
  persona.version = {
    id: 'pa-v1',
    semanticVersion: '1.1.0',
    status: 'candidate',
    approvedBy: [],
    changeSummary: 'Persona revisada com novos limites de alçada.',
    createdBy: 'ana',
    createdAt: '2026-06-15T00:00:00.000Z',
    snapshotHash: '',
  };
  persona.nodes['p0'] = demoNode('p0', 'btv:persona', 40, 'Analista');
  persona.version.snapshotHash = await computeDiagramHash(persona);
  await registry.register(persona);

  return registry;
}

function queryFromUrl(): LibraryQuery {
  const params = new URLSearchParams(window.location.search);
  const query: LibraryQuery = {};
  const text = params.get('q');
  if (text) query.text = text;
  const statuses = params.get('status');
  if (statuses) query.statuses = statuses.split(',') as LifecycleStatus[];
  const types = params.get('type');
  if (types) query.adapterIds = types.split(',');
  const sort = params.get('sort');
  if (sort === 'name' || sort === 'updated' || sort === 'status') query.sort = sort as LibrarySort;
  return query;
}

function queryToUrl(query: LibraryQuery): void {
  const params = new URLSearchParams(window.location.search);
  const sync = (key: string, value: string | undefined) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  sync('q', query.text || undefined);
  sync('status', query.statuses?.length ? query.statuses.join(',') : undefined);
  sync('type', query.adapterIds?.length ? query.adapterIds.join(',') : undefined);
  sync('sort', query.sort && query.sort !== 'name' ? query.sort : undefined);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function LibrarySurface() {
  const [adapters, setAdapters] = useState<ArtifactAdapter[]>();
  const [lastAction, setLastAction] = useState('');
  const initialQuery = useMemo(queryFromUrl, []);

  useEffect(() => {
    void seedRegistry().then((registry) => {
      setAdapters([
        bpmnDiagramAdapter(registry),
        personaAdapter(registry),
        createRecipeAdapter(), // §10.1 acid test, live
      ]);
    });
  }, []);

  const onAction = (ref: ArtifactRef, action: ArtifactAction) => {
    // The host resolves descriptors; the demo records them (e2e observes).
    setLastAction(`${action.id} → ${ref.adapterId}:${ref.artifactId}`);
  };

  if (!adapters) return <p className="demo-muted">Carregando biblioteca…</p>;
  return (
    <div className="demo-library" style={{ padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Biblioteca</h1>
        <span className="demo-muted">catálogo genérico — BuildToValue Studio (S-3)</span>
        <span data-testid="last-action" style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>
          {lastAction}
        </span>
      </header>
      <LibraryView
        adapters={adapters}
        onAction={onAction}
        initialQuery={initialQuery}
        onQueryChange={queryToUrl}
      />
    </div>
  );
}
