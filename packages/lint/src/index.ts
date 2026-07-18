import {
  activeEdges,
  activeNodes,
  addEdgeCommand,
  addEventDefinitionCommand,
  compositeCommand,
  createEdge,
  isContainerType,
  isEventType,
  isFlowEdge,
  isFlowNode,
  nextEventDefinitionId,
  nodeParentId,
  parseTimerExpression,
  removeEdgeCommand,
  removeNodeCommand,
  timerPropertyOf,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type Command,
  type ValidationIssue,
  type ValidationResult,
  type ValidationRule,
} from '@buildtovalue/core';

/**
 * bpmnlint-style modelling lint (referência item 7). Two profiles of
 * plugin-compatible `ValidationRule`s on top of the structural validation
 * (core) and soundness analysis (soundness) that already exist:
 *
 * - **Etiquette** — style-guide rules: things that parse and even run, but
 *   make a model harder to read or review.
 * - **Executability** — engine-readiness rules: things an execution engine
 *   (Camunda/Zeebe-class) will reject or silently misinterpret.
 *
 * Every issue carries a stable UPPER_SNAKE code so hosts can allowlist rules,
 * map severities or attach quick-fix handlers.
 */

function isActivity(node: BpmnNode): boolean {
  // Registry-free heuristic shared by the rules: tasks and sub-processes.
  return node.type.toLowerCase().includes('task') || node.type === 'subProcess' || node.type === 'callActivity';
}

function isGateway(node: BpmnNode): boolean {
  return node.type.toLowerCase().includes('gateway');
}

function flowCounts(diagram: BpmnDiagram): {
  incoming: Map<string, number>;
  outgoing: Map<string, number>;
} {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const edge of activeEdges(diagram)) {
    if (!isFlowEdge(edge)) continue;
    outgoing.set(edge.sourceId, (outgoing.get(edge.sourceId) ?? 0) + 1);
    incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
  }
  return { incoming, outgoing };
}

// ------------------------------------------------------------------ etiquette

/** Flow elements that read as prose must be named. */
export const labelRequiredRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    if (!isFlowNode(node) && !isContainerType(node.type)) continue;
    if (node.type === 'textAnnotation' || isGateway(node)) continue;
    if ((node.label ?? '').trim() !== '') continue;
    issues.push({
      code: 'LINT_LABEL_REQUIRED',
      severity: 'warning',
      message: `${node.type} "${node.id}" has no label — name every activity, event and container`,
      nodeId: node.id,
    });
  }
  return issues;
};

/** A gateway with one incoming AND one outgoing flow does nothing. */
export const superfluousGatewayRule: ValidationRule = (diagram) => {
  const { incoming, outgoing } = flowCounts(diagram);
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    if (!isGateway(node)) continue;
    if ((incoming.get(node.id) ?? 0) <= 1 && (outgoing.get(node.id) ?? 0) <= 1) {
      issues.push({
        code: 'LINT_SUPERFLUOUS_GATEWAY',
        severity: 'warning',
        message: `Gateway "${node.label || node.id}" neither forks nor joins — remove it or give it a second flow`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/** Branching should be explicit: an activity with 2+ outgoing flows hides a decision. */
export const implicitSplitRule: ValidationRule = (diagram) => {
  const { outgoing } = flowCounts(diagram);
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    if (!isActivity(node)) continue;
    if ((outgoing.get(node.id) ?? 0) >= 2) {
      issues.push({
        code: 'LINT_IMPLICIT_SPLIT',
        severity: 'warning',
        message: `"${node.label || node.id}" forks implicitly (${outgoing.get(node.id)} outgoing flows) — make the decision explicit with a gateway`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/** Joining should be explicit: an activity with 2+ incoming flows hides a merge. */
export const implicitJoinRule: ValidationRule = (diagram) => {
  const { incoming } = flowCounts(diagram);
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    if (!isActivity(node)) continue;
    if ((incoming.get(node.id) ?? 0) >= 2) {
      issues.push({
        code: 'LINT_IMPLICIT_JOIN',
        severity: 'warning',
        message: `"${node.label || node.id}" merges implicitly (${incoming.get(node.id)} incoming flows) — make the merge explicit with a gateway`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/** Two sequence flows with the same source and target are duplicates. */
export const duplicateFlowRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();
  for (const edge of activeEdges(diagram)) {
    if (!isFlowEdge(edge)) continue;
    const key = `${edge.sourceId}→${edge.targetId}`;
    const first = seen.get(key);
    if (first) {
      issues.push({
        code: 'LINT_DUPLICATE_FLOW',
        severity: 'warning',
        message: `Edges "${first}" and "${edge.id}" both connect ${key} — remove the duplicate`,
        edgeId: edge.id,
      });
    } else {
      seen.set(key, edge.id);
    }
  }
  return issues;
};

/** Start events don't take incoming sequence flow; end events don't emit. */
export const eventEndpointsRule: ValidationRule = (diagram) => {
  const { incoming, outgoing } = flowCounts(diagram);
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    if (!isEventType(node.type)) continue;
    if (node.type === 'startEvent' && (incoming.get(node.id) ?? 0) > 0) {
      issues.push({
        code: 'LINT_START_WITH_INCOMING',
        severity: 'error',
        message: `Start event "${node.label || node.id}" has incoming sequence flow`,
        nodeId: node.id,
      });
    }
    if (node.type === 'endEvent' && (outgoing.get(node.id) ?? 0) > 0) {
      issues.push({
        code: 'LINT_END_WITH_OUTGOING',
        severity: 'error',
        message: `End event "${node.label || node.id}" has outgoing sequence flow`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

// ---------------------------------------- event-definition rules (E-5, §3d)

/** The declared kind of an event node, if any. */
function eventKindOf(node: BpmnNode): string | undefined {
  const kind = node.properties.eventDefinition;
  return typeof kind === 'string' ? kind : undefined;
}

/** Kinds a START event can never carry (throw-only / intermediate-only). */
const START_FORBIDDEN_KINDS = new Set(['terminate', 'link']);
/** Kinds an END event can never carry (catch-only / intermediate-only). */
const END_FORBIDDEN_KINDS = new Set(['timer', 'conditional', 'link']);
/** Kinds that reference a named definition (3a). `escalation` stays in the
 * compensation/choreography pendency — deliberately absent from every set. */
const NAMED_REF_KINDS = new Set(['message', 'signal', 'error']);

/** Start events only CATCH: a throw-only or intermediate-only kind is an error. */
export const evtStartThrowRule: ValidationRule = (diagram) =>
  activeNodes(diagram)
    .filter(
      (node) => node.type === 'startEvent' && START_FORBIDDEN_KINDS.has(eventKindOf(node) ?? ''),
    )
    .map((node) => ({
      code: 'EVT_START_THROW',
      severity: 'error' as const,
      message: `Start event "${node.label || node.id}" carries a ${eventKindOf(node)} definition — start events only catch`,
      nodeId: node.id,
    }));

/** End events only THROW: a catch-only or intermediate-only kind is an error. */
export const evtEndCatchRule: ValidationRule = (diagram) =>
  activeNodes(diagram)
    .filter((node) => node.type === 'endEvent' && END_FORBIDDEN_KINDS.has(eventKindOf(node) ?? ''))
    .map((node) => ({
      code: 'EVT_END_CATCH',
      severity: 'error' as const,
      message: `End event "${node.label || node.id}" carries a ${eventKindOf(node)} definition — end events only throw`,
      nodeId: node.id,
    }));

/**
 * An error START event only exists inside an event sub-process — the SAME
 * containment predicate (`nodeParentId` → subProcess) the editor's Execução
 * matrix uses, so lint and tab agree by construction.
 */
export const evtErrorStartToplevelRule: ValidationRule = (diagram) =>
  activeNodes(diagram)
    .filter((node) => {
      if (node.type !== 'startEvent' || eventKindOf(node) !== 'error') return false;
      const parentId = nodeParentId(node);
      return (parentId ? diagram.nodes[parentId]?.type : undefined) !== 'subProcess';
    })
    .map((node) => ({
      code: 'EVT_ERROR_START_TOPLEVEL',
      severity: 'error' as const,
      message: `Error start event "${node.label || node.id}" sits at the top level — an error start only catches inside an event sub-process`,
      nodeId: node.id,
    }));

export const ETIQUETTE_RULES: ValidationRule[] = [
  labelRequiredRule,
  superfluousGatewayRule,
  implicitSplitRule,
  implicitJoinRule,
  duplicateFlowRule,
  eventEndpointsRule,
  evtStartThrowRule,
  evtEndCatchRule,
  evtErrorStartToplevelRule,
];

// -------------------------------------------------------------- executability

/**
 * Service-class tasks need an implementation binding before an engine can
 * run them. The rule accepts the common property spellings so it works with
 * plain profiles (`implementation`) and engine namespaces preserved via
 * extension passthrough (`zeebe:taskDefinitionType`, `camunda:type`...).
 */
export const serviceTaskImplementationRule: ValidationRule = (diagram) => {
  const BINDING_KEYS = [
    'implementation',
    'taskDefinitionType',
    'zeebe:taskDefinitionType',
    'camunda:type',
    'camunda:class',
    'camunda:delegateExpression',
  ];
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    if (node.type !== 'serviceTask' && node.type !== 'sendTask' && node.type !== 'businessRuleTask') {
      continue;
    }
    // businessRuleTask binds via decisionRef (native field) — only flag when
    // neither a decision reference nor a generic binding exists.
    const hasBinding =
      BINDING_KEYS.some((key) => {
        const value = node.properties[key];
        return typeof value === 'string' && value.trim() !== '';
      }) ||
      (node.type === 'businessRuleTask' && typeof node.properties.decisionRef === 'string');
    if (!hasBinding) {
      issues.push({
        code: 'EXEC_MISSING_IMPLEMENTATION',
        severity: 'warning',
        message: `"${node.label || node.id}" (${node.type}) has no implementation binding — an engine cannot execute it`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/**
 * Every outgoing flow of a forking exclusive/inclusive gateway needs a
 * condition (or must be the default flow) — otherwise the engine picks
 * arbitrarily or rejects the deploy.
 */
export const conditionalFlowsRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  const byGateway = new Map<string, { edges: string[]; unconditioned: string[] }>();
  for (const edge of activeEdges(diagram)) {
    if (!isFlowEdge(edge)) continue;
    const source = diagram.nodes[edge.sourceId];
    if (!source) continue;
    if (source.type !== 'exclusiveGateway' && source.type !== 'inclusiveGateway') continue;
    const entry = byGateway.get(source.id) ?? { edges: [], unconditioned: [] };
    entry.edges.push(edge.id);
    const condition = edge.properties.conditionExpression ?? edge.properties.condition;
    const isDefault = diagram.nodes[edge.sourceId]?.properties.defaultFlow === edge.id;
    if (!isDefault && (typeof condition !== 'string' || condition.trim() === '')) {
      entry.unconditioned.push(edge.id);
    }
    byGateway.set(source.id, entry);
  }
  for (const [gatewayId, entry] of byGateway) {
    if (entry.edges.length < 2) continue; // not a fork
    // One conditionless flow is tolerated as the implicit default; 2+ is ambiguous.
    if (entry.unconditioned.length >= 2) {
      const gateway = diagram.nodes[gatewayId];
      issues.push({
        code: 'EXEC_UNCONDITIONED_FLOWS',
        severity: 'warning',
        message: `Gateway "${gateway?.label || gatewayId}" forks with ${entry.unconditioned.length} conditionless flows — add conditions or mark a default`,
        nodeId: gatewayId,
      });
    }
  }
  return issues;
};

/**
 * An executable message/signal/error event needs its NAMED definition (3a) —
 * an engine correlates by the definition, not by the node label. Warning:
 * the model still parses and renders. Distinct from the E-3 `SIG_REF_MISSING`
 * (a GOVERNED binding that fails to resolve) — this is "no definition at all".
 */
export const evtRefMissingRule: ValidationRule = (diagram) =>
  activeNodes(diagram)
    .filter((node) => {
      const kind = eventKindOf(node);
      if (kind === undefined || !NAMED_REF_KINDS.has(kind) || !isEventType(node.type)) return false;
      const ref = node.properties.eventDefinitionRef;
      return typeof ref !== 'string' || ref === '';
    })
    .map((node) => ({
      code: 'EVT_REF_MISSING',
      severity: 'warning' as const,
      message: `Event "${node.label || node.id}" carries a ${eventKindOf(node)} definition with no named ${eventKindOf(node)} — create one and reference it`,
      nodeId: node.id,
    }));

/**
 * A present-but-malformed timer expression is an error the PARSER decides
 * (E-5 §1 — the P1M/PT1M trap lives there, once). Absent timer = no issue:
 * modelling can stay abstract; only a broken CLAIM is flagged.
 */
export const timerMalformedRule: ValidationRule = (diagram) =>
  activeNodes(diagram).flatMap((node) => {
    if (eventKindOf(node) !== 'timer') return [];
    const timer = timerPropertyOf(node);
    if (timer === undefined) return [];
    const parsed = parseTimerExpression(timer.kind, timer.expression);
    return parsed.valid
      ? []
      : [
          {
            code: 'TIMER_MALFORMED',
            severity: 'error' as const,
            message: `Timer "${node.label || node.id}" has a malformed ${timer.kind} expression "${timer.expression}" — ${parsed.error}`,
            nodeId: node.id,
          },
        ];
  });

export const EXECUTABILITY_RULES: ValidationRule[] = [
  serviceTaskImplementationRule,
  conditionalFlowsRule,
  evtRefMissingRule,
  timerMalformedRule,
];

export const ALL_LINT_RULES: ValidationRule[] = [...ETIQUETTE_RULES, ...EXECUTABILITY_RULES];

/** Runs a rule set (default: all) and folds the issues into one result. */
export function lintDiagram(
  diagram: BpmnDiagram,
  rules: ValidationRule[] = ALL_LINT_RULES,
): ValidationResult {
  const issues = rules.flatMap((rule) => rule(diagram));
  return { valid: issues.every((issue) => issue.severity !== 'error'), issues };
}

// -------------------------------------------------- quick fixes + profiles

/** What a quick-fix receives: the CURRENT diagram and the issue to repair. */
export interface LintFixContext {
  diagram: BpmnDiagram;
  issue: ValidationIssue;
}

/**
 * A lint rule with an identity and an OPTIONAL mechanical quick-fix
 * (Handoff 14 §1d). `fix` returns ONE undoable `Command` (composites fold
 * multi-step repairs into a single undo) — or `null` when the concrete issue
 * cannot be fixed mechanically after all. Rules without `fix` are the ones
 * the panel routes to the copilot's C5 pipeline instead.
 */
export interface LintRule {
  /** Stable kebab-case id ("duplicate-flow") — the grouping key for hosts. */
  id: string;
  run: ValidationRule;
  fix?: (ctx: LintFixContext) => Command | null;
}

/**
 * A named, versioned rule set — the unit the Biblioteca lists as a promotable
 * artifact (via `lintProfileAdapter`) and the panel shows as "política:
 * <id>@<version>". `source` tags every finding so etiquette and
 * engine-readiness issues share ONE surface without losing provenance.
 */
export interface LintProfile {
  id: string;
  name: string;
  version: string;
  source: 'etiquette' | 'executability';
  rules: LintRule[];
}

function flowEdgesTouching(diagram: BpmnDiagram, nodeId: string): {
  incoming: BpmnEdge[];
  outgoing: BpmnEdge[];
} {
  const incoming: BpmnEdge[] = [];
  const outgoing: BpmnEdge[] = [];
  for (const edge of activeEdges(diagram)) {
    if (!isFlowEdge(edge)) continue;
    if (edge.targetId === nodeId) incoming.push(edge);
    if (edge.sourceId === nodeId) outgoing.push(edge);
  }
  return { incoming, outgoing };
}

/** Duplicate flow: remove the redundant edge (the issue points at it). */
function fixDuplicateFlow(ctx: LintFixContext): Command | null {
  return ctx.issue.edgeId && ctx.diagram.edges[ctx.issue.edgeId]
    ? removeEdgeCommand(ctx.issue.edgeId)
    : null;
}

/**
 * Superfluous gateway: remove it and, when it sat on a 1-in/1-out path,
 * reconnect its neighbours with a fresh sequence flow — ONE composite.
 */
function fixSuperfluousGateway(ctx: LintFixContext): Command | null {
  const nodeId = ctx.issue.nodeId;
  if (!nodeId || !ctx.diagram.nodes[nodeId]) return null;
  const { incoming, outgoing } = flowEdgesTouching(ctx.diagram, nodeId);
  const commands: Command[] = [removeNodeCommand(nodeId)];
  if (incoming.length === 1 && outgoing.length === 1) {
    // The remove cascades the gateway's own edges, so the reconnect is a
    // brand-new flow between the former neighbours.
    commands.push(
      addEdgeCommand(
        createEdge({
          sourceId: incoming[0].sourceId,
          targetId: outgoing[0].targetId,
          type: 'sequenceFlow',
        }),
      ),
    );
  }
  return commands.length === 1
    ? commands[0]
    : compositeCommand('Remove superfluous gateway', commands);
}

/** Start/end endpoint violations: remove the offending flows — ONE command. */
function fixEventEndpoints(ctx: LintFixContext): Command | null {
  const nodeId = ctx.issue.nodeId;
  if (!nodeId) return null;
  const { incoming, outgoing } = flowEdgesTouching(ctx.diagram, nodeId);
  const offending = ctx.issue.code === 'LINT_START_WITH_INCOMING' ? incoming : outgoing;
  if (offending.length === 0) return null;
  const commands = offending.map((edge) => removeEdgeCommand(edge.id));
  return commands.length === 1
    ? commands[0]
    : compositeCommand('Remove invalid event flows', commands);
}

/**
 * EVT_REF_MISSING quick-fix (E-5 reforço 9): ONE composite creating a
 * definition of the event's OWN kind (message→messages, signal→signals,
 * error→errors with an empty errorCode) and referencing it — the «+» mold
 * from the properties panel, never a generic definition.
 */
const REF_FIX_NAMES: Record<'message' | 'signal' | 'error', string> = {
  message: 'New message',
  signal: 'New signal',
  error: 'New error',
};

function fixEvtRefMissing(ctx: LintFixContext): Command | null {
  const node = ctx.issue.nodeId ? ctx.diagram.nodes[ctx.issue.nodeId] : undefined;
  if (!node) return null;
  const kind = eventKindOf(node);
  if (kind !== 'message' && kind !== 'signal' && kind !== 'error') return null;
  const id = nextEventDefinitionId(ctx.diagram, kind);
  return compositeCommand(`Create ${kind} definition and reference it`, [
    addEventDefinitionCommand(kind, { id, name: REF_FIX_NAMES[kind] }),
    updateNodeCommand(node.id, { properties: { eventDefinitionRef: id } }),
  ]);
}

// E-5 (§3d): new rules = NEW promotable profile versions (1.0.0 → 1.1.0) —
// the panel header and the Biblioteca adapter reflect it from this one source.
export const ETIQUETTE_PROFILE: LintProfile = {
  id: 'lint-etiquette',
  name: 'Etiqueta de modelagem',
  version: '1.1.0',
  source: 'etiquette',
  rules: [
    { id: 'label-required', run: labelRequiredRule },
    { id: 'superfluous-gateway', run: superfluousGatewayRule, fix: fixSuperfluousGateway },
    { id: 'implicit-split', run: implicitSplitRule },
    { id: 'implicit-join', run: implicitJoinRule },
    { id: 'duplicate-flow', run: duplicateFlowRule, fix: fixDuplicateFlow },
    { id: 'event-endpoints', run: eventEndpointsRule, fix: fixEventEndpoints },
    { id: 'evt-start-throw', run: evtStartThrowRule },
    { id: 'evt-end-catch', run: evtEndCatchRule },
    { id: 'evt-error-start-toplevel', run: evtErrorStartToplevelRule },
  ],
};

export const EXECUTABILITY_PROFILE: LintProfile = {
  id: 'lint-engine',
  name: 'Prontidão de execução (engine)',
  version: '1.1.0',
  source: 'executability',
  rules: [
    { id: 'service-task-implementation', run: serviceTaskImplementationRule },
    { id: 'conditional-flows', run: conditionalFlowsRule },
    { id: 'evt-ref-missing', run: evtRefMissingRule, fix: fixEvtRefMissing },
    { id: 'timer-malformed', run: timerMalformedRule },
  ],
};

/** The shipped profiles — both run on the SAME panel surface (§1d). */
export const LINT_PROFILES: LintProfile[] = [ETIQUETTE_PROFILE, EXECUTABILITY_PROFILE];

/** An issue annotated with the rule and profile that produced it. */
export interface LintFinding extends ValidationIssue {
  ruleId: string;
  profileId: string;
  source: 'etiquette' | 'executability';
  /** True when the rule's quick-fix yields a command for THIS issue. */
  fixable: boolean;
}

/** Runs the profiles and annotates every issue with rule/profile provenance. */
export function lintFindings(
  diagram: BpmnDiagram,
  profiles: LintProfile[] = LINT_PROFILES,
): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const profile of profiles) {
    for (const rule of profile.rules) {
      for (const issue of rule.run(diagram)) {
        findings.push({
          ...issue,
          ruleId: rule.id,
          profileId: profile.id,
          source: profile.source,
          fixable: rule.fix !== undefined && rule.fix({ diagram, issue }) !== null,
        });
      }
    }
  }
  return findings;
}

/**
 * A FRESH quick-fix command for a finding, built against the CURRENT diagram
 * — commands close over undo state at execute time, so never reuse one across
 * executions. `null` when the finding's rule has no mechanical fix.
 */
export function fixCommandFor(
  diagram: BpmnDiagram,
  finding: LintFinding,
  profiles: LintProfile[] = LINT_PROFILES,
): Command | null {
  for (const profile of profiles) {
    if (profile.id !== finding.profileId) continue;
    const rule = profile.rules.find((r) => r.id === finding.ruleId);
    return rule?.fix?.({ diagram, issue: finding }) ?? null;
  }
  return null;
}
