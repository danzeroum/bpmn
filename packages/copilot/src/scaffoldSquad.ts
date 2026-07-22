import type { CopilotProposal, ProposedCommand } from './types.js';

/**
 * Squad Lane SL-12 — the whitelisted `scaffoldSquad` copilot command (§8-08).
 *
 * It is a PROPOSAL GENERATOR, not a mutation: it returns a {@link CopilotProposal}
 * built ENTIRELY from the primitive whitelisted commands (`addNode`/`addEdge`),
 * so it is structurally incapable of expressing anything off the whitelist — the
 * same governance fence as any copilot edit. The proposal then flows through the
 * ordinary PROPOSTA → APLICADA pipeline (`validateProposal` → `buildPlan` →
 * CopilotPanel): applying it runs through the CommandStack like any edit and
 * NEVER approves/promotes (issue #150). Deterministic: ids and positions come
 * from the template + prefix, never a clock or random source.
 *
 * Each of the 4 templates scaffolds a well-formed squad process: a start, the
 * squad's agentTasks (each with an `autonomyLevel`), an approval gate BEFORE the
 * end, and the sequence flows — so the scaffold satisfies the SL-12 gate-coverage
 * rule out of the box (every route to the end passes the gate). The gate is a
 * core `userTask` marked `properties.gate = true` (the domain `btv:gate` type
 * cannot be created through the core whitelist); the app's injected `isGate`
 * recognizes it.
 */

/** The four squad scaffold templates (aligned with the squad dynamics). */
export type SquadTemplateId = 'hierarquico' | 'sequencial' | 'paralelo' | 'revisao';

export const SQUAD_TEMPLATE_IDS: readonly SquadTemplateId[] = [
  'hierarquico',
  'sequencial',
  'paralelo',
  'revisao',
];

interface ScaffoldNode {
  suffix: string;
  type: string;
  label: string;
  col: number;
  row: number;
  autonomyLevel?: number;
  /** Marks the approval gate. A `btv:gate` domain type cannot be created through
   * the core whitelist, so the gate is a `userTask` carrying `properties.gate` —
   * the app's injected `isGate` recognizes it (`n.properties.gate === true`). */
  gate?: boolean;
}
interface ScaffoldEdge {
  from: string;
  to: string;
}
interface SquadTemplate {
  title: string;
  nodes: ScaffoldNode[];
  edges: ScaffoldEdge[];
}

const agent = (suffix: string, label: string, col: number, row = 0): ScaffoldNode => ({
  suffix,
  type: 'agentTask',
  label,
  col,
  row,
  autonomyLevel: 2,
});

const TEMPLATES: Record<SquadTemplateId, SquadTemplate> = {
  // Orchestrator delegates to two members in sequence, then a gate.
  hierarquico: {
    title: 'Hierarchical squad (orchestrator → members → gate)',
    nodes: [
      { suffix: 'start', type: 'startEvent', label: 'Start', col: 0, row: 0 },
      agent('orch', 'Orchestrator', 1),
      agent('m1', 'Researcher', 2),
      agent('m2', 'Reviewer', 3),
      { suffix: 'gate', type: 'userTask', label: 'Approval gate', col: 4, row: 0, gate: true },
      { suffix: 'end', type: 'endEvent', label: 'End', col: 5, row: 0 },
    ],
    edges: [
      { from: 'start', to: 'orch' },
      { from: 'orch', to: 'm1' },
      { from: 'm1', to: 'm2' },
      { from: 'm2', to: 'gate' },
      { from: 'gate', to: 'end' },
    ],
  },
  // A straight pipeline of three stages, then a gate.
  sequencial: {
    title: 'Sequential squad (pipeline → gate)',
    nodes: [
      { suffix: 'start', type: 'startEvent', label: 'Start', col: 0, row: 0 },
      agent('a1', 'Stage 1', 1),
      agent('a2', 'Stage 2', 2),
      agent('a3', 'Stage 3', 3),
      { suffix: 'gate', type: 'userTask', label: 'Approval gate', col: 4, row: 0, gate: true },
      { suffix: 'end', type: 'endEvent', label: 'End', col: 5, row: 0 },
    ],
    edges: [
      { from: 'start', to: 'a1' },
      { from: 'a1', to: 'a2' },
      { from: 'a2', to: 'a3' },
      { from: 'a3', to: 'gate' },
      { from: 'gate', to: 'end' },
    ],
  },
  // Orchestrator fans out to two parallel branches that consolidate before a gate.
  paralelo: {
    title: 'Parallel squad (fan-out → consolidate → gate)',
    nodes: [
      { suffix: 'start', type: 'startEvent', label: 'Start', col: 0, row: 0 },
      agent('orch', 'Orchestrator', 1),
      agent('m1', 'Branch A', 2, -1),
      agent('m2', 'Branch B', 2, 1),
      agent('cons', 'Consolidate', 3),
      { suffix: 'gate', type: 'userTask', label: 'Approval gate', col: 4, row: 0, gate: true },
      { suffix: 'end', type: 'endEvent', label: 'End', col: 5, row: 0 },
    ],
    edges: [
      { from: 'start', to: 'orch' },
      { from: 'orch', to: 'm1' },
      { from: 'orch', to: 'm2' },
      { from: 'm1', to: 'cons' },
      { from: 'm2', to: 'cons' },
      { from: 'cons', to: 'gate' },
      { from: 'gate', to: 'end' },
    ],
  },
  // A producer/reviewer pair with a gate (the doc-review archetype).
  revisao: {
    title: 'Review squad (producer → reviewer → gate)',
    nodes: [
      { suffix: 'start', type: 'startEvent', label: 'Start', col: 0, row: 0 },
      agent('prod', 'Producer', 1),
      agent('rev', 'Reviewer', 2),
      { suffix: 'gate', type: 'userTask', label: 'Approval gate', col: 3, row: 0, gate: true },
      { suffix: 'end', type: 'endEvent', label: 'End', col: 4, row: 0 },
    ],
    edges: [
      { from: 'start', to: 'prod' },
      { from: 'prod', to: 'rev' },
      { from: 'rev', to: 'gate' },
      { from: 'gate', to: 'end' },
    ],
  },
};

const COL_W = 180;
const ROW_H = 120;
const ORIGIN_X = 120;
const ORIGIN_Y = 200;

/** Options for {@link scaffoldSquad}. */
export interface ScaffoldSquadOptions {
  /** Namespaces the generated ids (default `sq`). Change it to scaffold a second
   * squad on the same canvas without id collisions. */
  prefix?: string;
}

/**
 * Generates a whitelisted {@link CopilotProposal} scaffolding a squad process for
 * the given template. Nodes are proposed before the edges that reference them, so
 * `validateProposal` accepts the proposal in order.
 */
export function scaffoldSquad(template: SquadTemplateId, options: ScaffoldSquadOptions = {}): CopilotProposal {
  const prefix = options.prefix ?? 'sq';
  const spec = TEMPLATES[template];
  const id = (suffix: string): string => `${prefix}-${suffix}`;

  const nodeCommands: ProposedCommand[] = spec.nodes.map((n) => {
    const properties: Record<string, unknown> = {};
    if (n.autonomyLevel !== undefined) properties.autonomyLevel = n.autonomyLevel;
    if (n.gate === true) properties.gate = true;
    return {
      type: 'addNode',
      params: {
        id: id(n.suffix),
        type: n.type,
        label: n.label,
        x: ORIGIN_X + n.col * COL_W,
        y: ORIGIN_Y + n.row * ROW_H,
        ...(Object.keys(properties).length > 0 ? { properties } : {}),
      },
    };
  });

  const edgeCommands: ProposedCommand[] = spec.edges.map((e, i) => ({
    type: 'addEdge',
    params: {
      id: id(`e${i}`),
      sourceId: id(e.from),
      targetId: id(e.to),
      type: 'sequenceFlow',
    },
  }));

  return {
    commands: [...nodeCommands, ...edgeCommands],
    rationale: `${spec.title} — scaffolded as a proposal. Review and apply to your draft; applying never promotes.`,
    promptTemplateRef: { id: `scaffold:squad-${template}`, version: '1.0.0' },
  };
}
