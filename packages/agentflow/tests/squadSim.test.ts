import { describe, expect, it } from 'vitest';
import {
  MASKED_VALUE,
  RESEARCH_AGENT,
  defaultAgentRunner,
  simulateSquad,
  type AgentRef,
  type AgentRunner,
  type AgentWorkflow,
  type ContextContract,
  type Fixtures,
  type SquadManifest,
} from '../src/index.js';

/**
 * Squad Lane SL-10 — `simulateSquad`. Deterministic delegate traversal over the
 * agentflow engine (never the BPMN one), an honest cross-agent stop, a fact trail
 * (intencao→acao→io→decisao→evidencia) labeled fixture × evidencia-declarada with
 * masked I/O, filterable by agent/kind/error.
 */
const RSCH: AgentWorkflow = RESEARCH_AGENT;
// A trivial one-node workflow so a second member completes with a known output.
const REVIEWER: AgentWorkflow = {
  kind: 'AgentWorkflow',
  id: 'agnt-qa',
  version: '0.9.0',
  autonomyLevel: 1,
  entry: 'llm-verdict',
  inputSchema: { doc: 'string' },
  outputSchema: { veredito: 'string' },
  nodes: [{ id: 'llm-verdict', type: 'llm', config: { model: 'gpt-4o', promptRef: 'prm:qa@1.0.0' } }],
  edges: [{ from: 'llm-verdict', to: 'end', edgeType: 'sequence' }],
};

const RSCH_FIXTURES: Fixtures = {
  'llm-1': {
    outputs: [
      { query: 'q', is_complete: false, answer: 'partial', sources: ['a'] },
      { is_complete: true, answer: 'full', sources: ['a', 'b'] },
    ],
  },
  'tool-2': { outputs: [{ results: ['a'] }, { results: ['a', 'b'] }] },
};

const manifest = (over: Partial<SquadManifest> = {}): SquadManifest => ({
  kind: 'SquadManifest',
  id: 'sqd-doc-review',
  version: '1.0.0',
  dynamic: 'hierarquico',
  orchestratorRef: 'agnt-orch@1.0.0',
  members: [
    { agentRef: 'agnt-rsch@2.1.0', personaRef: 'prs:analista@1.0.0', role: 'pesquisador' },
    { agentRef: 'agnt-qa@0.9.0', personaRef: 'prs:revisor@1.0.0', role: 'revisor' },
  ],
  edges: [
    { from: 'orch', to: 'pesquisador', kind: 'delegar' },
    { from: 'pesquisador', to: 'revisor', kind: 'delegar' },
  ],
  contextContractRef: 'ctx-contract:doc-review@1.0.0',
  gates: [{ gateId: 'g', scope: 'por-execucao' }],
  ...over,
});

// A resolver that maps refs to workflows; orch resolves to a trivial complete wf.
const ORCH: AgentWorkflow = { ...REVIEWER, id: 'agnt-orch', version: '1.0.0' };
const resolveWorkflow = (ref: AgentRef): AgentWorkflow | undefined =>
  ref.id === 'agnt-rsch' ? RSCH : ref.id === 'agnt-qa' ? REVIEWER : ref.id === 'agnt-orch' ? ORCH : undefined;

const fixturesByRole: Record<string, Fixtures> = {
  pesquisador: RSCH_FIXTURES,
  revisor: { 'llm-verdict': { outputs: [{ veredito: 'aprovado' }] } },
  orch: { 'llm-verdict': { outputs: [{ veredito: 'go' }] } },
};

describe('simulateSquad — traversal + honest stop (SL-10)', () => {
  it('runs the orchestrator then delegated members in manifest order', () => {
    const res = simulateSquad(manifest(), { resolveWorkflow, fixturesByRole });
    expect(res.order).toEqual(['orch', 'pesquisador', 'revisor']);
    expect(res.complete).toBe(true);
    expect(res.blocked).toBeNull();
  });

  it('emits the fact chain (intencao → acao → evidencia) per agent', () => {
    const res = simulateSquad(manifest(), { resolveWorkflow, fixturesByRole });
    const kinds = new Set(res.facts.map((f) => f.kind));
    expect(kinds.has('intencao')).toBe(true);
    expect(kinds.has('acao')).toBe(true);
    expect(kinds.has('evidencia')).toBe(true);
    // every fact is filterable by agent + kind + error (flat fields)
    expect(res.facts.every((f) => typeof f.agent === 'string' && typeof f.kind === 'string')).toBe(true);
  });

  it('stops honestly cross-agent when a member blocks — names agent + node + reason', () => {
    const res = simulateSquad(manifest(), {
      resolveWorkflow,
      // pesquisador never completes → its decision runs out of retries
      fixturesByRole: { ...fixturesByRole, pesquisador: { 'llm-1': { outputs: [{ is_complete: false }] }, 'tool-2': { outputs: [{ results: [] }] } } },
    });
    expect(res.complete).toBe(false);
    expect(res.blocked?.agent).toBe('pesquisador');
    expect(res.blocked?.nodeId).toBe('dec-3');
    expect(res.blocked?.reason).toMatch(/retr|route|max/i);
    // the revisor never ran — the stop halted the squad
    expect(res.order).not.toContain('revisor');
    // and there is a `parada` fact flagged as an error
    expect(res.facts.some((f) => f.kind === 'parada' && f.error === true)).toBe(true);
  });

  it('stops honestly when a member workflow does not resolve (no silent skip)', () => {
    const res = simulateSquad(manifest(), {
      resolveWorkflow: (ref) => (ref.id === 'agnt-orch' ? ORCH : undefined),
      fixturesByRole,
    });
    expect(res.blocked?.agent).toBe('pesquisador');
    expect(res.blocked?.reason).toMatch(/resolve/i);
  });

  it('is deterministic — the same squad 10× produces byte-identical facts', () => {
    const runs = Array.from({ length: 10 }, () =>
      JSON.stringify(simulateSquad(manifest(), { resolveWorkflow, fixturesByRole }).facts),
    );
    expect(new Set(runs).size).toBe(1);
  });
});

describe('simulateSquad — provenance + masking (E6/D1)', () => {
  const contract: ContextContract = {
    kind: 'ContextContract',
    id: 'ctx-contract:doc-review',
    version: '1.0.0',
    keys: [
      { key: 'answer', owner: 'pesquisador', writers: ['pesquisador'], readers: ['*'], purpose: 'grounding' },
      { key: 'sources', owner: 'pesquisador', writers: ['pesquisador'], readers: ['*'], sensitivity: 'pii' },
    ],
  };

  it('labels facts fixture by default and evidencia-declarada for declared roles (E6)', () => {
    const res = simulateSquad(manifest(), {
      resolveWorkflow,
      fixturesByRole,
      declaredEvidenceRoles: ['revisor'],
    });
    const revisorFacts = res.facts.filter((f) => f.agent === 'revisor');
    expect(revisorFacts.every((f) => f.source === 'evidencia-declarada')).toBe(true);
    const pesqFacts = res.facts.filter((f) => f.agent === 'pesquisador');
    expect(pesqFacts.every((f) => f.source === 'fixture')).toBe(true);
  });

  it('masks a sensitive context key conservatively when no policy is injected', () => {
    const res = simulateSquad(manifest(), { resolveWorkflow, fixturesByRole, contract });
    const evidence = res.facts.find((f) => f.agent === 'pesquisador' && f.kind === 'evidencia');
    // `sources` is sensitivity:pii → redacted; `answer` (grounding, not sensitive) passes through
    expect(evidence?.io?.output?.sources).toBe(MASKED_VALUE);
    expect(evidence?.io?.output?.answer).toBe('full');
  });

  it('uses the injected masking policy when present (never leaks, host-shaped)', () => {
    const res = simulateSquad(manifest(), {
      resolveWorkflow,
      fixturesByRole,
      contract,
      maskingPolicy: { mask: (name) => `[${name}]` },
    });
    const evidence = res.facts.find((f) => f.agent === 'pesquisador' && f.kind === 'evidencia');
    expect(evidence?.io?.output?.sources).toBe('[sources]');
  });

  it('carries a per-step masked context snapshot (step mode, D8)', () => {
    const res = simulateSquad(manifest(), { resolveWorkflow, fixturesByRole, contract });
    const evidence = res.facts.find((f) => f.agent === 'pesquisador' && f.kind === 'evidencia');
    expect(evidence?.contextAfter).toBeDefined();
    expect(evidence?.contextAfter?.answer).toBe('full'); // written key, grounding → visible
  });
});

describe('AgentRunner seam (SL-10)', () => {
  it('the default runner exposes simulate and NO run (no backend in this delivery)', () => {
    expect(typeof defaultAgentRunner.simulate).toBe('function');
    expect(defaultAgentRunner.run).toBeUndefined();
  });

  it('an injected runner is used for every member', () => {
    let calls = 0;
    const runner: AgentRunner = {
      simulate: (wf, opts) => {
        calls++;
        return defaultAgentRunner.simulate(wf, opts);
      },
    };
    simulateSquad(manifest(), { resolveWorkflow, fixturesByRole, runner });
    expect(calls).toBe(3); // orch + 2 members
  });
});
