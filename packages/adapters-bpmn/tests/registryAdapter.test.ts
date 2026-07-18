import { describe, expect, it, vi } from 'vitest';
import { VersionRegistry } from '@buildtovalue/registry';
import {
  bpmnDiagramAdapter,
  connectorAdapter,
  createRegistryAdapter,
  logicalArtifacts,
  personaAdapter,
  policyAdapter,
  promptAdapter,
  relevantEntry,
} from '../src/index.js';
import { diagramAt, seededRegistry } from './fixtures.js';

const NOW = () => '2026-07-08T12:00:00.000Z';

describe('logicalArtifacts / relevantEntry', () => {
  it('groups registry entries by snapshot.id, ascending by createdAt', async () => {
    const registry = await seededRegistry();
    const artifacts = logicalArtifacts(registry);
    expect(artifacts.map((a) => a.id).sort()).toEqual(['onboarding', 'persona-analista']);
    const onboarding = artifacts.find((a) => a.id === 'onboarding')!;
    expect(onboarding.entries.map((e) => e.version.semanticVersion)).toEqual(['1.0.0', '2.0.0']);
  });

  it('without a target the newest version is relevant', async () => {
    const registry = await seededRegistry();
    const onboarding = logicalArtifacts(registry).find((a) => a.id === 'onboarding')!;
    expect(relevantEntry(onboarding, undefined, NOW()).entry.version.semanticVersion).toBe('2.0.0');
  });

  it('with a target the open publication on that lane wins', async () => {
    const registry = await seededRegistry();
    await registry.publish('onb-v1', {
      channel: 'piloto',
      status: 'test',
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      publishedBy: 'bruna',
    });
    const onboarding = logicalArtifacts(registry).find((a) => a.id === 'onboarding')!;
    const { entry, publication } = relevantEntry(onboarding, { channel: 'piloto' }, NOW());
    expect(entry.version.semanticVersion).toBe('1.0.0');
    expect(publication?.status).toBe('test');
  });

  it('falls back to the newest version when the lane has no open publication', async () => {
    const registry = await seededRegistry();
    const onboarding = logicalArtifacts(registry).find((a) => a.id === 'onboarding')!;
    const { entry, publication } = relevantEntry(onboarding, { channel: 'produção' }, NOW());
    expect(entry.version.semanticVersion).toBe('2.0.0');
    expect(publication).toBeUndefined();
  });
});

describe('EM REVISÃO ⟲ na Biblioteca (Handoff 15 §2e, V-0 decisão 2)', () => {
  it('mapeia in-review → candidate (perda documentada) e o selo ⟲ sobrevive no meta', async () => {
    const registry = new VersionRegistry();
    await registry.register(
      await diagramAt({
        id: 'onboarding',
        name: 'Onboarding de clientes',
        versionId: 'onb-v3',
        semver: '2.1.0',
        status: 'in-review',
        createdAt: '2026-07-01T00:00:00.000Z',
        changeSummary: 'Aguardando re-submissão após pedido de mudanças.',
      }),
    );
    const adapter = bpmnDiagramAdapter(registry, { now: NOW });
    const [summary] = await adapter.list({});
    // The library keeps its fixed six states — never a seventh.
    expect(summary.status).toBe('candidate');
    // …but the gallery still shows the request-changes seal.
    expect(summary.meta).toContain('⟲ EM REVISÃO');
    const detail = await adapter.get('onboarding');
    expect(detail.versions[0].status).toBe('candidate');
  });
});

describe('createRegistryAdapter — list()', () => {
  it('lists one summary per logical artifact with registry-backed fields', async () => {
    const registry = await seededRegistry();
    const adapter = bpmnDiagramAdapter(registry, { now: NOW });
    const items = await adapter.list({});
    expect(items).toHaveLength(1); // persona diagram is claimed by the persona adapter
    const [onboarding] = items;
    expect(onboarding).toMatchObject({
      ref: { adapterId: 'bpmn-diagram', artifactId: 'onboarding' },
      name: 'Onboarding de clientes',
      typeLabel: 'FLUXO',
      version: '2.0.0',
      status: 'active',
      meta: 'Fluxo canônico de onboarding',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    expect(onboarding.thumbnail?.kind).toBe('svg');
  });

  it('exposes channel and per-lane status when observing a channel', async () => {
    const registry = await seededRegistry();
    await registry.publish('onb-v2', {
      channel: 'produção',
      status: 'active',
      effectiveFrom: '2026-03-02T00:00:00.000Z',
      publishedBy: 'bruna',
    });
    const adapter = bpmnDiagramAdapter(registry, { now: NOW, target: { channel: 'produção' } });
    const [item] = await adapter.list({});
    expect(item.channel).toBe('produção');
    expect(item.status).toBe('active');
  });

  it('reports host-provided boundRuns', async () => {
    const registry = await seededRegistry();
    const adapter = bpmnDiagramAdapter(registry, { now: NOW, boundRuns: () => 7 });
    const [item] = await adapter.list({});
    expect(item.boundRuns).toBe(7);
  });

  it('promptAdapter and connectorAdapter claim their kinds', async () => {
    const registry = new VersionRegistry();
    await registry.register(
      await diagramAt({
        id: 'prompt-resumo',
        name: 'Prompt de resumo',
        versionId: 'pr-v1',
        semver: '1.0.0',
        nodes: [{ id: 'p0', type: 'btv:prompt' }],
      }),
    );
    await registry.register(
      await diagramAt({
        id: 'conector-crm',
        name: 'Conector CRM',
        versionId: 'cc-v1',
        semver: '1.0.0',
        nodes: [{ id: 'c0', type: 'btv:connector' }],
      }),
    );
    const prompts = await promptAdapter(registry, { now: NOW }).list({});
    expect(prompts.map((p) => `${p.typeLabel}:${p.ref.artifactId}`)).toEqual([
      'PROMPT:prompt-resumo',
    ]);
    const connectors = await connectorAdapter(registry, { now: NOW }).list({});
    expect(connectors.map((c) => `${c.typeLabel}:${c.ref.artifactId}`)).toEqual([
      'CONNECTOR:conector-crm',
    ]);
  });

  it('personaAdapter and policyAdapter claim their kinds', async () => {
    const registry = await seededRegistry();
    await registry.register(
      await diagramAt({
        id: 'politica-credito',
        name: 'Política de crédito',
        versionId: 'pc-v1',
        semver: '1.0.0',
        nodes: [{ id: 'g0', type: 'btv:gate', label: 'Gate' }],
      }),
    );
    const personas = await personaAdapter(registry, { now: NOW }).list({});
    expect(personas.map((p) => p.ref.artifactId)).toEqual(['persona-analista']);
    expect(personas[0].typeLabel).toBe('PERSONA');
    const policies = await policyAdapter(registry, { now: NOW }).list({});
    expect(policies.map((p) => p.ref.artifactId)).toEqual(['politica-credito']);
    expect(policies[0].typeLabel).toBe('POLÍTICA');
  });
});

describe('createRegistryAdapter — get()', () => {
  it('builds the full detail: approvers, provenance, vigência and timeline newest-first', async () => {
    const registry = await seededRegistry();
    const adapter = bpmnDiagramAdapter(registry, { now: NOW });
    const detail = await adapter.get('onboarding');
    expect(detail.approvers).toEqual(['bruna', 'carla']);
    expect(detail.changeSummary).toBe('Automatiza a checagem de documentos.');
    expect(detail.effectiveFrom).toBe('2026-03-02T00:00:00.000Z');
    expect(detail.provenance).toMatchObject({ author: 'alice' });
    expect(detail.provenance?.ledgerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(detail.versions.map((v) => v.version)).toEqual(['2.0.0', '1.0.0']);
    expect(detail.versions[0].note).toBe('Automatiza a checagem de documentos.');
    expect(detail.actions.map((a) => a.id)).toEqual(['open-designer', 'diff-active']);
    expect(detail.actions.every((a) => a.kind === 'navigate')).toBe(true);
  });

  it('rejects unknown artifacts with a helpful error', async () => {
    const registry = await seededRegistry();
    const adapter = bpmnDiagramAdapter(registry, { now: NOW });
    await expect(adapter.get('nope')).rejects.toThrow(/unknown artifact "nope"/);
  });

  it('omits optional sections the registry cannot provide (no "N/A")', async () => {
    const registry = new VersionRegistry();
    await registry.register(
      await diagramAt({ id: 'plain', name: 'Plain', versionId: 'p-v1', semver: '0.1.0', status: 'draft' }),
    );
    const detail = await bpmnDiagramAdapter(registry, { now: NOW }).get('plain');
    expect(detail.effectiveFrom).toBeUndefined();
    expect(detail.effectiveUntil).toBeUndefined();
    expect(detail.channel).toBeUndefined();
    expect(detail.boundRuns).toBeUndefined();
    expect(detail.approvers).toEqual([]);
  });
});

describe('createRegistryAdapter — subscribe/notifyChanged', () => {
  it('notifies subscribers and stops after unsubscribe', async () => {
    const registry = await seededRegistry();
    const adapter = createRegistryAdapter({ id: 'x', typeLabel: 'X', registry, now: NOW });
    const cb = vi.fn();
    const unsubscribe = adapter.subscribe!(cb);
    adapter.notifyChanged();
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    adapter.notifyChanged();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('uses the real clock by default', async () => {
    const registry = await seededRegistry();
    const adapter = createRegistryAdapter({ id: 'x', typeLabel: 'X', registry });
    const items = await adapter.list({});
    expect(items.length).toBeGreaterThan(0);
  });
});
