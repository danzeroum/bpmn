import {
  activeEdges,
  activeNodes,
  isContainerType,
  isEventType,
  isFlowEdge,
  isFlowNode,
  type BpmnDiagram,
  type BpmnNode,
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

export const ETIQUETTE_RULES: ValidationRule[] = [
  labelRequiredRule,
  superfluousGatewayRule,
  implicitSplitRule,
  implicitJoinRule,
  duplicateFlowRule,
  eventEndpointsRule,
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

export const EXECUTABILITY_RULES: ValidationRule[] = [
  serviceTaskImplementationRule,
  conditionalFlowsRule,
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
