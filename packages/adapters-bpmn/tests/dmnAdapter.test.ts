import { describe, expect, it } from 'vitest';
import { VersionRegistry } from '@bpmn-react/registry';
import { dmnDecisionAdapter } from '../src/index.js';
import { diagramAt } from './fixtures.js';

const NOW = () => '2026-07-08T12:00:00.000Z';

const TABLE = {
  hitPolicy: 'F',
  inputs: [{ id: 'i1', label: 'Score', expression: 'score', typeRef: 'number' }],
  outputs: [{ id: 'o1', label: 'Aprovado', expression: 'aprovado', typeRef: 'boolean' }],
  rules: [
    { id: 'r1', inputEntries: ['>= 700'], outputEntries: ['true'] },
    { id: 'r2', inputEntries: ['< 700'], outputEntries: ['false'] },
  ],
};

async function seededDmnRegistry(): Promise<VersionRegistry> {
  const registry = new VersionRegistry();
  await registry.register(
    await diagramAt({
      id: 'credito',
      name: 'Concessão de crédito',
      versionId: 'cr-v1',
      semver: '1.0.0',
      status: 'active',
      createdAt: '2026-02-01T00:00:00.000Z',
      changeSummary: 'Primeira versão com decisão de limite.',
      nodes: [
        { id: 'start', type: 'startEvent' },
        { id: 'dec-limite', type: 'dmn:decision', label: 'Limite de crédito', properties: { decisionTable: TABLE } },
      ],
    }),
  );
  await registry.register(
    await diagramAt({
      id: 'credito',
      name: 'Concessão de crédito',
      versionId: 'cr-v2',
      semver: '1.1.0',
      status: 'candidate',
      createdAt: '2026-06-01T00:00:00.000Z',
      changeSummary: 'Ajusta o corte de score.',
      nodes: [
        { id: 'start', type: 'startEvent' },
        { id: 'dec-limite', type: 'dmn:decision', label: 'Limite de crédito', properties: { decisionTable: TABLE } },
        { id: 'dec-taxa', type: 'dmn:decision', label: 'Taxa de juros', properties: {} },
      ],
    }),
  );
  return registry;
}

describe('dmnDecisionAdapter — DMN como mais um adapter', () => {
  it('lists each active dmn:decision node of the relevant version as an artifact', async () => {
    const registry = await seededDmnRegistry();
    const adapter = dmnDecisionAdapter(registry, { now: NOW });
    const items = await adapter.list({});
    expect(items.map((i) => i.ref.artifactId).sort()).toEqual([
      'credito::dec-limite',
      'credito::dec-taxa',
    ]);
    const limite = items.find((i) => i.ref.artifactId === 'credito::dec-limite')!;
    expect(limite).toMatchObject({
      name: 'Limite de crédito',
      typeLabel: 'DECISÃO',
      version: '1.1.0',
      status: 'candidate',
      meta: 'hit policy F · 2 regras',
    });
    expect(limite.thumbnail?.kind).toBe('svg');
    const taxa = items.find((i) => i.ref.artifactId === 'credito::dec-taxa')!;
    expect(taxa.meta).toBe('sem tabela de decisão');
  });

  it('get() versions timeline only spans diagram versions where the node exists', async () => {
    const registry = await seededDmnRegistry();
    const adapter = dmnDecisionAdapter(registry, { now: NOW });
    const limite = await adapter.get('credito::dec-limite');
    expect(limite.versions.map((v) => v.version)).toEqual(['1.1.0', '1.0.0']);
    const taxa = await adapter.get('credito::dec-taxa');
    expect(taxa.versions.map((v) => v.version)).toEqual(['1.1.0']);
    expect(taxa.actions[0]).toMatchObject({
      id: 'open-designer',
      kind: 'navigate',
      payload: { artifactId: 'credito', nodeId: 'dec-taxa' },
    });
  });

  it('rejects unknown or non-decision ids', async () => {
    const registry = await seededDmnRegistry();
    const adapter = dmnDecisionAdapter(registry, { now: NOW });
    await expect(adapter.get('credito::start')).rejects.toThrow(/unknown decision/);
    await expect(adapter.get('nope::x')).rejects.toThrow(/unknown decision/);
    await expect(adapter.get('sem-separador')).rejects.toThrow(/unknown decision/);
  });

  it('subscribe/notifyChanged wire invalidation (and the default clock lists)', async () => {
    const registry = await seededDmnRegistry();
    const adapter = dmnDecisionAdapter(registry);
    const items = await adapter.list({});
    expect(items.length).toBe(2);
    let fired = 0;
    const unsubscribe = adapter.subscribe!(() => fired++);
    adapter.notifyChanged();
    unsubscribe();
    adapter.notifyChanged();
    expect(fired).toBe(1);
  });
});
