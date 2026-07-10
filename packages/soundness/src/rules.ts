import {
  laneFlowNodeRefs,
  type BpmnDiagram,
  type BpmnNode,
  type IssueSeverity,
  type ValidationIssue,
  type ValidationRule,
} from '@buildtovalue/core';
import {
  buildScopeGraphs,
  coReachableTo,
  cyclicComponents,
  reachableFrom,
  type ScopeGraph,
} from './graph.js';

/** Stable rule codes (Handoff 4 §C1) — never renumber or reuse. */
export const SOUNDNESS_CODES = [
  'SND_DEADLOCK_JOIN',
  'SND_UNMATCHED_SPLIT',
  'SND_NO_PATH_TO_END',
  'SND_INFINITE_LOOP',
  'SND_DEAD_BRANCH',
  'SND_BOUNDARY_NO_OUTFLOW',
  'SND_EVENT_GW_TARGETS',
  'SND_LANE_NO_ACTOR',
  'SND_IMPLICIT_MERGE',
] as const;

export type SoundnessCode = (typeof SOUNDNESS_CODES)[number];

export type SoundnessLocale = 'en' | 'pt';

export interface SoundnessRuleDefinition {
  code: SoundnessCode;
  defaultSeverity: IssueSeverity;
  /** One-line description of what the rule detects, per locale. */
  title: Record<SoundnessLocale, string>;
}

export const SOUNDNESS_RULES: SoundnessRuleDefinition[] = [
  {
    code: 'SND_DEADLOCK_JOIN',
    defaultSeverity: 'error',
    title: {
      en: 'AND-join fed by an XOR-split never synchronizes (deadlock)',
      pt: 'AND-join alimentado por um XOR-split nunca sincroniza (deadlock)',
    },
  },
  {
    code: 'SND_UNMATCHED_SPLIT',
    defaultSeverity: 'warning',
    title: {
      en: 'Split gateway without a matching join of the same type downstream',
      pt: 'Gateway de divisão sem join correspondente do mesmo tipo no fluxo',
    },
  },
  {
    code: 'SND_NO_PATH_TO_END',
    defaultSeverity: 'error',
    title: {
      en: 'Node with no path to any end event',
      pt: 'Nó sem caminho até nenhum evento de fim',
    },
  },
  {
    code: 'SND_INFINITE_LOOP',
    defaultSeverity: 'warning',
    title: {
      en: 'Cycle with no exit edge (structural livelock)',
      pt: 'Ciclo sem nenhuma aresta de saída (livelock estrutural)',
    },
  },
  {
    code: 'SND_DEAD_BRANCH',
    defaultSeverity: 'warning',
    title: {
      en: 'Gateway branch unreachable from the start (dead branch)',
      pt: 'Ramo de gateway inalcançável a partir do início (ramo morto)',
    },
  },
  {
    code: 'SND_BOUNDARY_NO_OUTFLOW',
    defaultSeverity: 'error',
    title: {
      en: 'Boundary event without an outgoing sequence flow (empty handler)',
      pt: 'Boundary event sem sequence flow de saída (handler vazio)',
    },
  },
  {
    code: 'SND_EVENT_GW_TARGETS',
    defaultSeverity: 'error',
    title: {
      en: 'Event-based gateway target must be a catch event or receive task',
      pt: 'Alvo de eventBasedGateway deve ser catch event ou receive task',
    },
  },
  {
    code: 'SND_LANE_NO_ACTOR',
    defaultSeverity: 'info',
    title: {
      en: 'Lane contains no nodes (empty swimlane)',
      pt: 'Raia sem nenhum nó (raia vazia)',
    },
  },
  {
    code: 'SND_IMPLICIT_MERGE',
    defaultSeverity: 'info',
    title: {
      en: 'Node merges 2+ incoming flows without a gateway (implicit merge)',
      pt: 'Nó recebe 2+ fluxos sem gateway (merge implícito)',
    },
  },
];

const RULE_BY_CODE = new Map(SOUNDNESS_RULES.map((rule) => [rule.code, rule]));

export interface SoundnessOptions {
  /** Per-code severity adjustments (companies tune without forking). */
  severityOverrides?: Partial<Record<SoundnessCode, IssueSeverity>>;
  /** Codes to skip entirely. */
  disabled?: SoundnessCode[];
  /** Message language. Default 'en'. */
  locale?: SoundnessLocale;
}

interface RuleContext {
  diagram: BpmnDiagram;
  graphs: ScopeGraph[];
  locale: SoundnessLocale;
  severityOf: (code: SoundnessCode) => IssueSeverity;
}

type ScopedCheck = (context: RuleContext) => ValidationIssue[];

const label = (node: BpmnNode) => node.label || node.id;

function issue(
  context: RuleContext,
  code: SoundnessCode,
  message: Record<SoundnessLocale, string>,
  element: { nodeId?: string; edgeId?: string },
): ValidationIssue {
  return {
    code,
    severity: context.severityOf(code),
    message: message[context.locale],
    ...element,
  };
}

const isExclusiveSplitType = (type: string) =>
  type === 'exclusiveGateway' || type === 'eventBasedGateway';

const isGateway = (type: string) => type.endsWith('Gateway');

/**
 * SND_DEADLOCK_JOIN — the classic trap: an AND-join whose incoming branches
 * trace back to the SAME exclusive decision. The XOR picks one branch; the
 * AND waits for all of them; the token never arrives. Heuristic: walk each
 * incoming branch backwards to its NEAREST split (first node with 2+ outgoing
 * flows); two branches meeting at the same exclusive/event-based split is a
 * structural deadlock. Dominance-precise analysis is out of scope (§3).
 */
const deadlockJoin: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    for (const node of graph.nodes.values()) {
      if (node.type !== 'parallelGateway') continue;
      const incoming = (graph.in.get(node.id) ?? []).filter((flow) => !flow.implicit);
      if (incoming.length < 2) continue;
      const splitCounts = new Map<string, number>();
      for (const flow of incoming) {
        for (const splitId of nearestSplits(graph, flow.source)) {
          splitCounts.set(splitId, (splitCounts.get(splitId) ?? 0) + 1);
        }
      }
      for (const [splitId, count] of splitCounts) {
        const split = graph.nodes.get(splitId);
        if (!split || count < 2 || !isExclusiveSplitType(split.type)) continue;
        issues.push(
          issue(
            context,
            'SND_DEADLOCK_JOIN',
            {
              en: `AND-join "${label(node)}" waits for branches of exclusive split "${label(split)}" — only one will ever arrive`,
              pt: `AND-join "${label(node)}" espera ramos do split exclusivo "${label(split)}" — só um deles chegará`,
            },
            { nodeId: node.id },
          ),
        );
        break; // one report per join is enough
      }
    }
  }
  return issues;
};

/**
 * Nearest upstream splits of a node: walk incoming edges backwards, stopping
 * each path at the first node with 2+ (non-implicit) outgoing flows. The
 * starting node itself counts when it is a split.
 */
function nearestSplits(graph: ScopeGraph, from: string): Set<string> {
  const splits = new Set<string>();
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const outDegree = (graph.out.get(current) ?? []).filter((flow) => !flow.implicit).length;
    if (outDegree >= 2) {
      splits.add(current);
      continue; // the split shields whatever lies behind it
    }
    for (const flow of graph.in.get(current) ?? []) {
      if (flow.implicit || seen.has(flow.source)) continue;
      seen.add(flow.source);
      queue.push(flow.source);
    }
  }
  return splits;
}

/** SND_UNMATCHED_SPLIT — split with no same-type join anywhere downstream. */
const unmatchedSplit: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    for (const node of graph.nodes.values()) {
      if (!isGateway(node.type)) continue;
      const outgoing = (graph.out.get(node.id) ?? []).filter((flow) => !flow.implicit);
      if (outgoing.length < 2) continue;
      // Event-based gateways pair with exclusive merges in practice.
      const joinTypes = new Set(
        node.type === 'eventBasedGateway' ? ['exclusiveGateway', 'eventBasedGateway'] : [node.type],
      );
      const downstream = reachableFrom(graph, [node.id]);
      downstream.delete(node.id);
      const hasJoin = [...downstream].some((id) => {
        const candidate = graph.nodes.get(id)!;
        return (
          joinTypes.has(candidate.type) &&
          (graph.in.get(id) ?? []).filter((flow) => !flow.implicit).length >= 2
        );
      });
      if (!hasJoin) {
        issues.push(
          issue(
            context,
            'SND_UNMATCHED_SPLIT',
            {
              en: `Split "${label(node)}" (${node.type}) has no matching join of the same type downstream`,
              pt: `Split "${label(node)}" (${node.type}) não tem join correspondente do mesmo tipo no fluxo`,
            },
            { nodeId: node.id },
          ),
        );
      }
    }
  }
  return issues;
};

/** SND_NO_PATH_TO_END — node that cannot reach any end of its scope. */
const noPathToEnd: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    if (graph.ends.length === 0) continue; // empty scope
    const canFinish = coReachableTo(graph, graph.ends);
    for (const node of graph.nodes.values()) {
      if (canFinish.has(node.id)) continue;
      issues.push(
        issue(
          context,
          'SND_NO_PATH_TO_END',
          {
            en: `No path from "${label(node)}" to any end event`,
            pt: `Não existe caminho de "${label(node)}" até nenhum evento de fim`,
          },
          { nodeId: node.id },
        ),
      );
    }
  }
  return issues;
};

/** SND_INFINITE_LOOP — SCC with no edge leaving it (structural livelock). */
const infiniteLoop: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    for (const component of cyclicComponents(graph)) {
      const members = new Set(component);
      const hasExit = component.some((id) =>
        (graph.out.get(id) ?? []).some((flow) => !members.has(flow.target)),
      );
      if (hasExit) continue;
      const first = graph.nodes.get(component[0])!;
      issues.push(
        issue(
          context,
          'SND_INFINITE_LOOP',
          {
            en: `Cycle through "${label(first)}" (${component.length} node${component.length > 1 ? 's' : ''}) has no exit`,
            pt: `Ciclo por "${label(first)}" (${component.length} nó${component.length > 1 ? 's' : ''}) não tem saída`,
          },
          { nodeId: first.id },
        ),
      );
    }
  }
  return issues;
};

/** SND_DEAD_BRANCH — gateway branch whose flow can never carry a token. */
const deadBranch: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    if (graph.starts.length === 0) continue; // nothing to be reachable from
    const alive = reachableFrom(graph, graph.starts);
    for (const node of graph.nodes.values()) {
      if (!isGateway(node.type) || alive.has(node.id)) continue;
      for (const flow of graph.out.get(node.id) ?? []) {
        if (flow.implicit) continue;
        issues.push(
          issue(
            context,
            'SND_DEAD_BRANCH',
            {
              en: `Branch of gateway "${label(node)}" is unreachable from the start (dead branch)`,
              pt: `Ramo do gateway "${label(node)}" é inalcançável a partir do início (ramo morto)`,
            },
            { edgeId: flow.edgeId },
          ),
        );
      }
    }
  }
  return issues;
};

/** SND_BOUNDARY_NO_OUTFLOW — a boundary event that catches and does nothing. */
const boundaryNoOutflow: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    for (const node of graph.nodes.values()) {
      if (node.type !== 'boundaryEvent') continue;
      const outgoing = (graph.out.get(node.id) ?? []).filter((flow) => !flow.implicit);
      if (outgoing.length > 0) continue;
      issues.push(
        issue(
          context,
          'SND_BOUNDARY_NO_OUTFLOW',
          {
            en: `Boundary event "${label(node)}" has no outgoing flow — it catches and goes nowhere`,
            pt: `Boundary event "${label(node)}" não tem fluxo de saída — captura e não leva a lugar nenhum`,
          },
          { nodeId: node.id },
        ),
      );
    }
  }
  return issues;
};

const EVENT_GW_LEGAL_TARGETS = new Set(['intermediateCatchEvent', 'receiveTask']);

/** SND_EVENT_GW_TARGETS — spec rule: event gateway races catch events only. */
const eventGatewayTargets: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    for (const node of graph.nodes.values()) {
      if (node.type !== 'eventBasedGateway') continue;
      for (const flow of graph.out.get(node.id) ?? []) {
        if (flow.implicit) continue;
        const target = graph.nodes.get(flow.target);
        if (!target || EVENT_GW_LEGAL_TARGETS.has(target.type)) continue;
        issues.push(
          issue(
            context,
            'SND_EVENT_GW_TARGETS',
            {
              en: `Event gateway "${label(node)}" targets "${label(target)}" (${target.type}) — only catch events or receive tasks are allowed`,
              pt: `Event gateway "${label(node)}" aponta para "${label(target)}" (${target.type}) — só catch events ou receive tasks são permitidos`,
            },
            { edgeId: flow.edgeId },
          ),
        );
      }
    }
  }
  return issues;
};

/** SND_LANE_NO_ACTOR — an empty swimlane is model noise. */
const laneNoActor: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const node of Object.values(context.diagram.nodes)) {
    if (node.type !== 'lane' || node.removedInVersion !== undefined) continue;
    const refs = laneFlowNodeRefs(node).filter((id) => context.diagram.nodes[id]);
    if (refs.length > 0) continue;
    issues.push(
      issue(
        context,
        'SND_LANE_NO_ACTOR',
        {
          en: `Lane "${label(node)}" contains no nodes`,
          pt: `A raia "${label(node)}" não contém nenhum nó`,
        },
        { nodeId: node.id },
      ),
    );
  }
  return issues;
};

/** SND_IMPLICIT_MERGE — legal per spec, hostile to readers. */
const implicitMerge: ScopedCheck = (context) => {
  const issues: ValidationIssue[] = [];
  for (const graph of context.graphs) {
    for (const node of graph.nodes.values()) {
      if (isGateway(node.type)) continue;
      const incoming = (graph.in.get(node.id) ?? []).filter((flow) => !flow.implicit);
      if (incoming.length < 2) continue;
      issues.push(
        issue(
          context,
          'SND_IMPLICIT_MERGE',
          {
            en: `"${label(node)}" merges ${incoming.length} incoming flows without a gateway`,
            pt: `"${label(node)}" recebe ${incoming.length} fluxos de entrada sem gateway`,
          },
          { nodeId: node.id },
        ),
      );
    }
  }
  return issues;
};

const CHECK_BY_CODE: Record<SoundnessCode, ScopedCheck> = {
  SND_DEADLOCK_JOIN: deadlockJoin,
  SND_UNMATCHED_SPLIT: unmatchedSplit,
  SND_NO_PATH_TO_END: noPathToEnd,
  SND_INFINITE_LOOP: infiniteLoop,
  SND_DEAD_BRANCH: deadBranch,
  SND_BOUNDARY_NO_OUTFLOW: boundaryNoOutflow,
  SND_EVENT_GW_TARGETS: eventGatewayTargets,
  SND_LANE_NO_ACTOR: laneNoActor,
  SND_IMPLICIT_MERGE: implicitMerge,
};

/**
 * Runs the full soundness analysis: one graph build, every enabled rule,
 * O(V+E) each — never state-space search (§3). Standalone entry point;
 * `soundnessRules()` wraps the same analysis for the plugin system.
 */
export function analyzeSoundness(
  diagram: BpmnDiagram,
  options: SoundnessOptions = {},
): ValidationIssue[] {
  const disabled = new Set(options.disabled ?? []);
  const context: RuleContext = {
    diagram,
    graphs: buildScopeGraphs(diagram),
    locale: options.locale ?? 'en',
    severityOf: (code) =>
      options.severityOverrides?.[code] ?? RULE_BY_CODE.get(code)!.defaultSeverity,
  };
  const issues: ValidationIssue[] = [];
  for (const rule of SOUNDNESS_RULES) {
    if (disabled.has(rule.code)) continue;
    issues.push(...CHECK_BY_CODE[rule.code](context));
  }
  return issues;
}

/**
 * The soundness analysis in the plugin `validationRules` format — drop it
 * into a `BpmnPlugin` (react) or a `ValidationEngine` (CLI/headless) and the
 * existing integration paths pick it up with no new code:
 *
 * ```ts
 * const plugin = { id: 'soundness', validationRules: soundnessRules() };
 * ```
 *
 * Returned as a single composite rule so the (per-validation) graph build
 * runs once, not nine times.
 */
export function soundnessRules(options: SoundnessOptions = {}): ValidationRule[] {
  return [(diagram) => analyzeSoundness(diagram, options)];
}
