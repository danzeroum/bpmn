import { describe, expect, it } from 'vitest';
import type { SquadManifest } from '@buildtovalue/agentflow';
import { buildSquadDiagram } from '../src/index.js';

/**
 * Squad Lane SL-9 — the manifest→diagram projection. The manifest is the source
 * of truth (D5); the diagram is a DETERMINISTIC projection: same manifest →
 * byte-identical diagram, one lane per role, an agentTask per lane, and one
 * edge per drawable squad relation carrying its kind as `edge.type`.
 */
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

describe('buildSquadDiagram — deterministic projection (SL-9)', () => {
  it('projects one pool, one lane per role, one agentTask per lane', () => {
    const d = buildSquadDiagram(manifest());
    const nodes = Object.values(d.nodes);
    expect(nodes.filter((n) => n.type === 'pool')).toHaveLength(1);
    // orch + 2 members = 3 roles → 3 lanes, 3 agentTasks
    expect(nodes.filter((n) => n.type === 'lane')).toHaveLength(3);
    const tasks = nodes.filter((n) => n.type === 'agentTask');
    expect(tasks.map((t) => t.id).sort()).toEqual(['orch', 'pesquisador', 'revisor']);
  });

  it('carries the squad edge kind as edge.type (distinguishable per relation)', () => {
    const d = buildSquadDiagram(manifest());
    const kinds = Object.values(d.edges).map((e) => e.type).sort();
    expect(kinds).toEqual(['delegar', 'solicitar-revisao']);
  });

  it('binds agentRef + personaRef onto the member task properties', () => {
    const d = buildSquadDiagram(manifest());
    const task = Object.values(d.nodes).find((n) => n.id === 'pesquisador')!;
    expect(task.properties.agentWorkflowRef).toBe('agnt-rsch@2.1.0');
    expect(task.properties.personaRef).toBe('prs:analista@1.0.0');
  });

  it('adds a humano lane only when an edge references it', () => {
    const withHuman = manifest({
      edges: [
        { from: 'orch', to: 'pesquisador', kind: 'delegar' },
        { from: 'revisor', to: 'humano', kind: 'escalar' },
      ],
    });
    const d = buildSquadDiagram(withHuman);
    expect(Object.values(d.nodes).some((n) => n.id === 'humano')).toBe(true);
    // and the escalation edge is drawn to it
    expect(Object.values(d.edges).some((e) => e.targetId === 'humano' && e.type === 'escalar')).toBe(true);
  });

  it('drops edges to unknown roles rather than inventing a lane', () => {
    const d = buildSquadDiagram(
      manifest({ edges: [{ from: 'orch', to: 'fantasma', kind: 'delegar' }] }),
    );
    expect(Object.values(d.nodes).some((n) => n.id === 'fantasma')).toBe(false);
    expect(Object.values(d.edges)).toHaveLength(0);
  });

  it('fans a broadcast (`*`) source out to every non-human member', () => {
    const d = buildSquadDiagram(
      manifest({ edges: [{ from: '*', to: 'orch', kind: 'consolidar' }] }),
    );
    const consolidate = Object.values(d.edges).filter((e) => e.type === 'consolidar');
    // pesquisador → orch and revisor → orch (orch → orch is skipped: from===to)
    expect(consolidate.map((e) => e.sourceId).sort()).toEqual(['pesquisador', 'revisor']);
    expect(consolidate.every((e) => e.targetId === 'orch')).toBe(true);
  });

  it('is deterministic — same manifest projects a byte-identical diagram', () => {
    const a = buildSquadDiagram(manifest());
    const b = buildSquadDiagram(manifest());
    const shape = (d: ReturnType<typeof buildSquadDiagram>) => ({
      nodes: Object.entries(d.nodes)
        .map(([id, n]) => `${id}:${n.type}:${n.x},${n.y},${n.width},${n.height}`)
        .sort(),
      edges: Object.values(d.edges)
        .map((e) => `${e.sourceId}->${e.targetId}:${e.type}`)
        .sort(),
    });
    expect(shape(a)).toEqual(shape(b));
  });
});
