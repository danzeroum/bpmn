import { describe, expect, it } from 'vitest';
import { createDiagram, agentGateCoverageViolations, type BpmnNode } from '@buildtovalue/core';
import {
  scaffoldSquad,
  SQUAD_TEMPLATE_IDS,
  WHITELISTED_COMMANDS,
  validateProposal,
  buildPlan,
} from '../src/index.js';

/**
 * Squad Lane SL-12 — the whitelisted squad scaffolder. It is a PROPOSAL
 * generator: every command it emits is a primitive whitelisted command, it flows
 * through the ordinary validate→plan pipeline (PROPOSTA→APLICADA, applying never
 * approves), and each template scaffolds a gate-covered squad process.
 */
const emptyDiagram = () => createDiagram({ name: 'Canvas', id: 'canvas' });
// The scaffold marks its approval gate with `properties.gate` (a core userTask —
// btv:gate is a domain type the core whitelist cannot create).
const isGate = (n: BpmnNode) => n.properties.gate === true;
const requiresGate = (level: number) => level <= 3;

describe('scaffoldSquad — whitelisted proposal generator (SL-12)', () => {
  it('offers exactly four templates', () => {
    expect(SQUAD_TEMPLATE_IDS).toEqual(['hierarquico', 'sequencial', 'paralelo', 'revisao']);
  });

  it('every emitted command is on the copilot whitelist (governance fence)', () => {
    for (const template of SQUAD_TEMPLATE_IDS) {
      const proposal = scaffoldSquad(template);
      for (const cmd of proposal.commands) {
        expect(WHITELISTED_COMMANDS).toContain(cmd.type);
      }
      // nodes are proposed before the edges that reference them
      const firstEdge = proposal.commands.findIndex((c) => c.type === 'addEdge');
      const lastNode = proposal.commands.map((c) => c.type).lastIndexOf('addNode');
      expect(lastNode).toBeLessThan(firstEdge);
    }
  });

  it('each template validates against a fresh diagram + carries a versioned scaffold ref', () => {
    for (const template of SQUAD_TEMPLATE_IDS) {
      const proposal = scaffoldSquad(template);
      expect(validateProposal(emptyDiagram(), proposal)).toEqual({ ok: true });
      expect(proposal.promptTemplateRef).toEqual({ id: `scaffold:squad-${template}`, version: '1.0.0' });
      expect(proposal.rationale).toMatch(/applying never promotes/i);
    }
  });

  it('the scaffolded process is gate-covered (no GATE_NOT_COVERING out of the box)', () => {
    for (const template of SQUAD_TEMPLATE_IDS) {
      const plan = buildPlan(emptyDiagram(), scaffoldSquad(template));
      // every agentTask requiring a gate has one on the path before every commit
      expect(agentGateCoverageViolations(plan.projected, { requiresGate, isGate })).toEqual([]);
      // and the scaffold really added agentTasks + a marked gate node
      const nodes = Object.values(plan.projected.nodes);
      expect(nodes.some((n) => n.type === 'agentTask')).toBe(true);
      expect(nodes.some((n) => n.properties.gate === true)).toBe(true);
    }
  });

  it('is deterministic — the same template + prefix scaffolds an identical proposal', () => {
    expect(JSON.stringify(scaffoldSquad('paralelo'))).toBe(JSON.stringify(scaffoldSquad('paralelo')));
  });

  it('a prefix namespaces ids so two squads can coexist on one canvas', () => {
    const a = scaffoldSquad('revisao', { prefix: 'sqA' });
    const afterA = buildPlan(emptyDiagram(), a).projected;
    // a differently-prefixed squad still validates against the projection…
    expect(validateProposal(afterA, scaffoldSquad('revisao', { prefix: 'sqB' })).ok).toBe(true);
    // …but re-applying the SAME prefix collides on ids (integral rejection)
    expect(validateProposal(afterA, a).ok).toBe(false);
  });
});
