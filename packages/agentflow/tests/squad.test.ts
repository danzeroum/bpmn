import { describe, expect, it } from 'vitest';
import {
  RESEARCH_AGENT,
  squadAutonomy,
  validateContextContract,
  validateSquad,
  type AgentRef,
  type AgentWorkflow,
  type ContextContract,
  type SquadManifest,
} from '../src/index.js';

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
    { from: 'pesquisador', to: 'revisor', kind: 'solicitar-revisao' },
  ],
  contextContractRef: 'ctx-contract:doc-review@1.0.0',
  gates: [{ gateId: 'gate-final', scope: 'por-execucao' }],
  ...over,
});

const contract = (over: Partial<ContextContract> = {}): ContextContract => ({
  kind: 'ContextContract',
  id: 'ctx-contract:doc-review',
  version: '1.0.0',
  keys: [
    { key: 'doc.fontes', owner: 'pesquisador', readers: ['*'], writers: ['pesquisador'], purpose: 'grounding', merge: 'acrescentar' },
    { key: 'veredito', owner: 'revisor', readers: ['orch'], writers: ['revisor'], purpose: 'operational-action', merge: 'exigir-decisao', immutableAfterGate: true },
    { key: 'cliente.pii', forbidden: true },
  ],
  ...over,
});

describe('validateSquad — structure (Squad Lane SL-8)', () => {
  it('a well-formed manifest has no errors', () => {
    expect(validateSquad(manifest()).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('SQUAD_DYNAMIC_INVALID for an unknown dynamic', () => {
    const issues = validateSquad(manifest({ dynamic: 'anarquico' as never }));
    expect(issues.find((i) => i.code === 'SQUAD_DYNAMIC_INVALID')?.severity).toBe('error');
  });

  it('SQUAD_EDGE_KIND_INVALID for an unknown edge kind', () => {
    const issues = validateSquad(manifest({ edges: [{ from: 'orch', to: 'x', kind: 'teleportar' as never }] }));
    expect(issues.map((i) => i.code)).toContain('SQUAD_EDGE_KIND_INVALID');
  });

  it('SQUAD_REF_INVALID for a malformed member ref', () => {
    const issues = validateSquad(
      manifest({ members: [{ agentRef: 'not-a-ref', personaRef: 'prs:x@1.0.0', role: 'r' }] }),
    );
    expect(issues.map((i) => i.code)).toContain('SQUAD_REF_INVALID');
  });

  it('SQUAD_EDGE_ROLE_UNKNOWN for an edge to a role that is not declared', () => {
    // an edge the diagram projection would silently DROP must be flagged here,
    // so the omission is never mute (the Problems Panel explains why it vanished)
    const issue = validateSquad(
      manifest({ edges: [{ from: 'orch', to: 'fantasma', kind: 'delegar' }] }),
    ).find((i) => i.code === 'SQUAD_EDGE_ROLE_UNKNOWN');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toMatch(/fantasma/);
    expect(issue?.remediation).toMatch(/orch|humano|broadcast/);
  });

  it('accepts orch, declared roles, humano, and "*" as a broadcast source', () => {
    const codes = validateSquad(
      manifest({
        edges: [
          { from: 'orch', to: 'pesquisador', kind: 'delegar' },
          { from: 'revisor', to: 'humano', kind: 'escalar' },
          { from: '*', to: 'orch', kind: 'consolidar' },
        ],
      }),
    ).map((i) => i.code);
    expect(codes).not.toContain('SQUAD_EDGE_ROLE_UNKNOWN');
  });

  it('flags "*" used as a target (broadcast is a source-only token)', () => {
    const codes = validateSquad(
      manifest({ edges: [{ from: 'orch', to: '*', kind: 'delegar' }] }),
    ).map((i) => i.code);
    expect(codes).toContain('SQUAD_EDGE_ROLE_UNKNOWN');
  });
});

describe('validateSquad — SQUAD_MEMBER_STALE (injected, degradable)', () => {
  it('warns for a stale member when a status resolver is injected', () => {
    const resolveMemberStatus = (ref: AgentRef): boolean => ref.id === 'agnt-qa';
    const found = validateSquad(manifest(), { resolveMemberStatus }).find(
      (i) => i.code === 'SQUAD_MEMBER_STALE',
    );
    expect(found?.severity).toBe('warning');
    expect(found?.message).toMatch(/revisor/);
    expect(found?.remediation).toMatch(/active/);
  });

  it('stays silent about currency when no resolver is injected', () => {
    expect(validateSquad(manifest()).map((i) => i.code)).not.toContain('SQUAD_MEMBER_STALE');
  });
});

describe('validateContextContract — CTX_* (Squad Lane SL-8)', () => {
  it('a well-formed contract has no errors', () => {
    expect(validateContextContract(contract())).toEqual([]);
  });

  it('CTX_WRITE_FORBIDDEN when a forbidden key still grants access', () => {
    const wf = contract({
      keys: [{ key: 'cliente.pii', forbidden: true, writers: ['revisor'] }],
    });
    const found = validateContextContract(wf).find((i) => i.code === 'CTX_WRITE_FORBIDDEN');
    expect(found?.severity).toBe('error');
    expect(found?.remediation).toMatch(/forbidden/);
  });

  it('CTX_PURPOSE_VIOLATION when immutableAfterGate is set on a non-operational key', () => {
    const wf = contract({
      keys: [{ key: 'doc.fontes', purpose: 'grounding', immutableAfterGate: true }],
    });
    const found = validateContextContract(wf).find((i) => i.code === 'CTX_PURPOSE_VIOLATION');
    expect(found?.severity).toBe('error');
    expect(found?.remediation).toMatch(/operational-action/);
  });

  it('CTX_PURPOSE_VIOLATION when grounding requires a decision to merge', () => {
    const wf = contract({ keys: [{ key: 'doc.fontes', purpose: 'grounding', merge: 'exigir-decisao' }] });
    expect(validateContextContract(wf).map((i) => i.code)).toContain('CTX_PURPOSE_VIOLATION');
  });

  it('runs CTX checks through the manifest when the contract resolves', () => {
    const bad = contract({ keys: [{ key: 'cliente.pii', forbidden: true, owner: 'orch' }] });
    const resolveContextContract = (ref: AgentRef): ContextContract | undefined =>
      ref.id === 'ctx-contract:doc-review' ? bad : undefined;
    expect(validateSquad(manifest(), { resolveContextContract }).map((i) => i.code)).toContain(
      'CTX_WRITE_FORBIDDEN',
    );
  });
});

describe('squadAutonomy — max of the chain (reusing SL-4, Squad Lane SL-8)', () => {
  it('is the max autonomy across resolved members', () => {
    const rsch: AgentWorkflow = { ...RESEARCH_AGENT, autonomyLevel: 2 };
    const qa: AgentWorkflow = { ...RESEARCH_AGENT, id: 'agnt-qa', autonomyLevel: 4 };
    const resolveMember = (ref: AgentRef): AgentWorkflow | undefined =>
      ref.id === 'agnt-rsch' ? rsch : ref.id === 'agnt-qa' ? qa : undefined;
    expect(squadAutonomy(manifest(), resolveMember)).toBe(4);
  });

  it('is undefined when no member resolves (degradable)', () => {
    expect(squadAutonomy(manifest(), () => undefined)).toBeUndefined();
  });
});
