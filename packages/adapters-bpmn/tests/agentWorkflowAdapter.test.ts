import { describe, expect, it } from 'vitest';
import { APPROVAL_GATE_AGENT, RESEARCH_AGENT, type AgentWorkflow } from '@buildtovalue/agentflow';
import { createLibraryCatalog } from '@buildtovalue/library';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  agentPromotionGate,
  agentReferenceCurrencyWarnings,
  agentWorkflowAdapter,
  groupAgentVersions,
  type AgentArtifactVersion,
} from '../src/index.js';

/** A store: Research Agent v2.0.0 active + v2.1.0 candidate; Approval Gate active. */
function source(): AgentArtifactVersion[] {
  return [
    { workflow: { ...RESEARCH_AGENT, version: '2.0.0' }, status: 'active', createdAt: '2026-06-01T00:00:00.000Z', author: 'ia.copilot@gpt-4o' },
    { workflow: { ...RESEARCH_AGENT, version: '2.1.0' }, status: 'candidate', createdAt: '2026-07-01T00:00:00.000Z', originTemplate: 'research-agent' },
    { workflow: APPROVAL_GATE_AGENT, status: 'active', createdAt: '2026-05-01T00:00:00.000Z' },
  ];
}

describe('agentWorkflowAdapter — the generic Library serves a non-BPMN artifact (§9.7)', () => {
  it('lists AGENTE cards with lifecycle + autonomy-as-text (no new color)', async () => {
    const catalog = createLibraryCatalog([agentWorkflowAdapter({ source })]);
    const { items, counts } = await catalog.list();
    expect(counts.byAdapter).toEqual({ 'btv-agent': 2 }); // 2 logical agents
    expect(items.every((i) => i.typeLabel === 'AGENTE')).toBe(true);
    expect(items.every((i) => i.thumbnail?.kind === 'icon')).toBe(true); // 🤖, not a color
    const research = items.find((i) => i.ref.artifactId === 'agnt-rsch')!;
    // the active version wins over the candidate for the card
    expect(research.version).toBe('2.0.0');
    expect(research.status).toBe('active');
    expect(research.meta).toMatch(/autonomia 2/);
  });

  it('drawer detail: version timeline (newest first), actions, provenance', async () => {
    const catalog = createLibraryCatalog([agentWorkflowAdapter({ source })]);
    const detail = await catalog.get({ adapterId: 'btv-agent', artifactId: 'agnt-rsch' });
    expect(detail.versions.map((v) => v.version)).toEqual(['2.1.0', '2.0.0']); // newest first
    expect(detail.versions.find((v) => v.version === '2.1.0')?.note).toMatch(/template: research-agent/);
    expect(detail.actions.map((a) => a.id)).toContain('open-studio');
    expect(detail.provenance?.author).toBe('ia.copilot@gpt-4o');
    expect(detail.provenance?.ledgerHash).toMatch(/^[0-9a-f]{64}$/); // canonical-JSON content hash
  });

  it('groups versions by agent id, ascending by semver', () => {
    const groups = groupAgentVersions(source);
    const research = groups.find((g) => g.id === 'agnt-rsch')!;
    expect(research.versions.map((v) => v.workflow.version)).toEqual(['2.0.0', '2.1.0']);
  });
});

describe('agentWorkflowAdapter — edge branches', () => {
  it('with no active version, the latest by semver wins; boundRuns + provenance surface', async () => {
    const src = (): AgentArtifactVersion[] => [
      { workflow: { ...RESEARCH_AGENT, version: '1.0.0' }, status: 'draft' },
      { workflow: { ...RESEARCH_AGENT, version: '1.1.0' }, status: 'candidate', changeSummary: 'tuned prompt', ledgerHash: 'deadbeef', author: 'u-1', createdAt: '2026-07-02T00:00:00.000Z' },
    ];
    const catalog = createLibraryCatalog([agentWorkflowAdapter({ source: src, boundRuns: () => 4 })]);
    const item = (await catalog.list()).items[0];
    expect(item.version).toBe('1.1.0'); // latest wins with no active
    expect(item.boundRuns).toBe(4);
    const detail = await catalog.get({ adapterId: 'btv-agent', artifactId: 'agnt-rsch' });
    expect(detail.changeSummary).toBe('tuned prompt');
    expect(detail.provenance?.ledgerHash).toBe('deadbeef'); // host-provided hash reused
  });

  it('rejects an unknown agent id', async () => {
    const catalog = createLibraryCatalog([agentWorkflowAdapter({ source })]);
    await expect(catalog.get({ adapterId: 'btv-agent', artifactId: 'ghost' })).rejects.toThrow(/unknown agent/);
  });
});

describe('agentPromotionGate — §3 validation as a promotion gate (§5)', () => {
  it('allows promotion when the graph validates', () => {
    expect(agentPromotionGate(RESEARCH_AGENT)).toEqual({ allowed: true });
  });

  it('blocks promotion when the graph has a §3 error, naming the codes', () => {
    const broken: AgentWorkflow = { ...structuredClone(RESEARCH_AGENT), inputSchema: {} };
    const verdict = agentPromotionGate(broken);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/EMPTY_INPUT_SCHEMA/);
    expect(agentPromotionGate(broken, 'pt').reason).toMatch(/bloqueiam a promoção/);
  });
});

describe('agentReferenceCurrencyWarnings — reused vigência rule (§5)', () => {
  function processReferencing(ref: string): BpmnDiagram {
    const d = createDiagram({ name: 'Active process' });
    d.nodes = {
      t1: createNode({ type: 'agentTask', id: 't1', label: 'Research', x: 40, y: 40, properties: { agentWorkflowRef: ref } }),
    };
    return d;
  }

  it('warns when an active process references a candidate agent version', () => {
    const warnings = agentReferenceCurrencyWarnings(processReferencing('agnt-rsch@2.1.0'), source);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ nodeId: 't1', status: 'candidate' });
    expect(warnings[0].message).toMatch(/vigência|currency/i);
  });

  it('does not warn when the referenced agent version is active', () => {
    expect(agentReferenceCurrencyWarnings(processReferencing('agnt-rsch@2.0.0'), source)).toEqual([]);
  });

  it('ignores an unresolved ref (that is the CALL_REF_MISSING badge, not currency)', () => {
    expect(agentReferenceCurrencyWarnings(processReferencing('agnt-ghost@9.9.9'), source)).toEqual([]);
  });

  it('ignores a malformed ref, a non-string ref, and non-agentTask nodes', () => {
    expect(agentReferenceCurrencyWarnings(processReferencing('not-a-ref'), source)).toEqual([]);
    const d = createDiagram({ name: 'Mixed' });
    d.nodes = {
      task: createNode({ type: 'task', id: 'task', label: 'Plain', x: 0, y: 0 }),
      t1: createNode({ type: 'agentTask', id: 't1', label: 'A', x: 40, y: 40, properties: { agentWorkflowRef: 42 } }),
    };
    expect(agentReferenceCurrencyWarnings(d, source)).toEqual([]);
  });

  it('localizes the currency warning', () => {
    const [warn] = agentReferenceCurrencyWarnings(processReferencing('agnt-rsch@2.1.0'), source, 'pt');
    expect(warn.message).toMatch(/vigência: mesma regra do callActivity/);
  });
});
