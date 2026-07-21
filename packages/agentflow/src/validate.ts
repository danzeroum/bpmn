/**
 * Graph validation (Handoff 12 §3) — runs headless at save and at promotion.
 *
 * Returns a flat list of {@link ValidationIssue}; an `error` blocks promotion
 * (the core wires this into `evaluateGates` in A-3), a `warning` never does.
 * The five §3 rules, the honest-stop prohibition (§1.4) and the autonomy
 * coherence rule (§4) live here. Delegate resolution is INJECTED and fully
 * degradable (§1.7): with no resolver a delegate is a warning, never an error.
 */

import { END_ROUTE, type AgentWorkflow } from './types.js';
import { autonomyCoherence } from './autonomy.js';
import { canReach, decisionRoutes, loopComponents, nodeIndex } from './graph.js';
import { formatRef, parseRef, type AgentRef } from './ref.js';
import { effectRequiresGate, matchToolParams, type ResolveTool } from './toolContract.js';

/** A single validation finding. */
export interface ValidationIssue {
  /** Stable machine code, e.g. "RETRY_WITHOUT_MAX". */
  code: string;
  severity: 'error' | 'warning';
  /** English message; the host localizes at the edge. */
  message: string;
  /** The offending node, when the issue is node-scoped. */
  nodeId?: string;
  /** Actionable fix — errors that block promotion always carry one (§1.5). */
  remediation?: string;
}

/** Injected, degradable integrations (cerca §1.7). */
export interface ValidateOptions {
  /**
   * Resolves a delegate reference to another AgentWorkflow. Injected by the
   * host (registry). Absent or returning false → the delegate is a warning,
   * not an error (§3.4).
   */
  resolveDelegate?: (ref: AgentRef) => boolean;
  /**
   * Resolves a `tool:*@semver` ref to its {@link ToolContract} — the injected
   * `ToolProvider` (Squad Lane SL-2). Absent → tool-contract checks degrade to
   * the structural ref check only; present but returning `undefined` → a
   * declared `TOOL_UNRESOLVED` warning (cerca §2.4, never silent).
   */
  resolveTool?: ResolveTool;
}

/** True when a decision condition inspects structured output (honest stop,
 * §1.4) rather than an implicit metric. */
function isStructuredCondition(condition: string): boolean {
  return /\boutput\b/.test(condition);
}

/** Rule §1.4 named prohibition: an implicit `confidence` metric is forbidden. */
function checkImplicitMetric(wf: AgentWorkflow, issues: ValidationIssue[]): void {
  for (const node of wf.nodes) {
    if (node.type !== 'decision') continue;
    if (/\bconfidence\b/.test(node.config.condition)) {
      issues.push({
        code: 'DECISION_IMPLICIT_METRIC',
        severity: 'error',
        nodeId: node.id,
        message: `Decision "${node.id}" stops on an implicit "confidence" metric.`,
        remediation:
          'Route on a structured output field instead (e.g. output.is_complete === true); "confidence" is not a real API signal.',
      });
    }
  }
}

/** Rule 1 (§3.1): a decision route that loops back must declare maxRetries. */
function checkRetryMax(wf: AgentWorkflow, issues: ValidationIssue[]): void {
  const index = nodeIndex(wf);
  for (const node of wf.nodes) {
    if (node.type !== 'decision') continue;
    for (const route of decisionRoutes(node)) {
      if (route.next === END_ROUTE || !index.has(route.next)) continue;
      const loopsBack = canReach(wf, route.next, node.id, index);
      if (loopsBack && route.maxRetries === undefined) {
        issues.push({
          code: 'RETRY_WITHOUT_MAX',
          severity: 'error',
          nodeId: node.id,
          message: `Decision "${node.id}" route ${route.branch} loops back to "${route.next}" without maxRetries.`,
          remediation: `Add maxRetries to the ${route.branch} route of "${node.id}" to bound the retry loop.`,
        });
      }
    }
  }
}

/** Rule 2 (§3.2): no cycle without a decision carrying a stop criterion. */
function checkCycleStop(wf: AgentWorkflow, issues: ValidationIssue[]): void {
  const index = nodeIndex(wf);
  for (const component of loopComponents(wf, index)) {
    const members = new Set(component);
    const hasStop = component.some((id) => {
      const node = index.get(id);
      if (node?.type !== 'decision') return false;
      if (!isStructuredCondition(node.config.condition)) return false;
      // A stop needs a way OUT of the loop: a route to the sink or outside it.
      return decisionRoutes(node).some((r) => r.next === END_ROUTE || !members.has(r.next));
    });
    if (!hasStop) {
      issues.push({
        code: 'CYCLE_WITHOUT_STOP',
        severity: 'error',
        nodeId: component[0],
        message: `Loop [${component.join(', ')}] has no decision with a structured stop criterion and an exit.`,
        remediation:
          'Add a decision inside the loop whose condition inspects structured output (e.g. output.is_complete === true) and routes out of the loop.',
      });
    }
  }
}

/** Rule 3 (§3.3): an LLM consumed by a structured decision forces JSON mode. */
function checkStructuredLlm(wf: AgentWorkflow, issues: ValidationIssue[]): void {
  const index = nodeIndex(wf);
  const structuredDecisions = wf.nodes.filter(
    (n) => n.type === 'decision' && isStructuredCondition(n.config.condition),
  );
  if (structuredDecisions.length === 0) return;
  for (const node of wf.nodes) {
    if (node.type !== 'llm' || node.config.structuredOutput === true) continue;
    const feedsStructured = structuredDecisions.some((d) => canReach(wf, node.id, d.id, index));
    if (feedsStructured) {
      issues.push({
        code: 'LLM_NOT_STRUCTURED',
        severity: 'error',
        nodeId: node.id,
        message: `LLM "${node.id}" feeds a structured decision but does not set structuredOutput.`,
        remediation: `Set structuredOutput: true on "${node.id}" so its output can be evaluated (JSON mode).`,
      });
    }
  }
}

/** Rule 4 (§3.4): delegate points to a valid versioned ref; resolution is
 * injected (unresolved → warning, not error). Also validates promptRef form. */
function checkRefs(wf: AgentWorkflow, options: ValidateOptions, issues: ValidationIssue[]): void {
  for (const node of wf.nodes) {
    if (node.type !== 'llm') continue;
    try {
      const { warnings } = parseRef(node.config.promptRef);
      for (const w of warnings) {
        issues.push({ code: 'PROMPT_REF_ABBREVIATED', severity: 'warning', nodeId: node.id, message: w });
      }
    } catch (err) {
      issues.push({
        code: 'PROMPT_REF_INVALID',
        severity: 'error',
        nodeId: node.id,
        message: `LLM "${node.id}" has an invalid promptRef "${node.config.promptRef}": ${(err as Error).message}`,
        remediation: 'Use a versioned reference of the form "id@major.minor.patch".',
      });
    }
  }

  for (const edge of wf.edges) {
    if (edge.edgeType !== 'delegate') continue;
    let ref: AgentRef;
    try {
      const parsed = parseRef(edge.to);
      ref = parsed.ref;
      for (const w of parsed.warnings) {
        issues.push({ code: 'DELEGATE_REF_ABBREVIATED', severity: 'warning', nodeId: edge.from, message: w });
      }
    } catch (err) {
      issues.push({
        code: 'DELEGATE_REF_INVALID',
        severity: 'error',
        nodeId: edge.from,
        message: `Delegate on "${edge.from}" targets an invalid ref "${edge.to}": ${(err as Error).message}`,
        remediation: 'A delegate must reference another agent as "id@major.minor.patch".',
      });
      continue;
    }
    // Degradable resolution (§1.7): no resolver, or an unresolved ref, is a warning.
    if (!options.resolveDelegate || !options.resolveDelegate(ref)) {
      issues.push({
        code: 'DELEGATE_UNRESOLVED',
        severity: 'warning',
        nodeId: edge.from,
        message: `Delegate target "${edge.to}" could not be resolved${options.resolveDelegate ? '' : ' (no resolver injected)'}.`,
      });
    }
  }
}

/**
 * Squad Lane SL-1 (§6): every `tool` node binds to a versioned `tool:*@semver`
 * contract. The structural ref check always runs; contract-aware checks (params
 * ↔ inputSchema, effect ↔ gate) run only when the injected `resolveTool`
 * returns a contract, and degrade honestly otherwise.
 */
function checkToolContracts(
  wf: AgentWorkflow,
  options: ValidateOptions,
  issues: ValidationIssue[],
): void {
  for (const node of wf.nodes) {
    if (node.type !== 'tool') continue;
    const raw = node.config.usesTool;

    // Structural: `usesTool` must be a versioned TOOL ref (cerca §2.1/§2.2).
    let ref: AgentRef;
    try {
      const parsed = parseRef(raw);
      ref = parsed.ref;
      if (!ref.id.startsWith('tool:')) {
        issues.push({
          code: 'TOOL_REF_INVALID',
          severity: 'error',
          nodeId: node.id,
          message: `Tool node "${node.id}" references "${raw}", which is not a tool contract.`,
          remediation: 'Bind the node to a versioned tool contract of the form "tool:id@major.minor.patch".',
        });
        continue;
      }
      for (const w of parsed.warnings) {
        issues.push({ code: 'TOOL_REF_ABBREVIATED', severity: 'warning', nodeId: node.id, message: w });
      }
    } catch (err) {
      issues.push({
        code: 'TOOL_REF_INVALID',
        severity: 'error',
        nodeId: node.id,
        message: `Tool node "${node.id}" uses an invalid tool ref "${raw}": ${(err as Error).message}`,
        remediation: 'Bind the node to a versioned tool contract of the form "tool:id@major.minor.patch".',
      });
      continue;
    }

    // Degradable resolution (§1.7): no ToolProvider injected → structural check
    // only. A provider that cannot resolve the ref → declared warning (§2.4).
    if (!options.resolveTool) continue;
    const contract = options.resolveTool(ref);
    if (!contract) {
      issues.push({
        code: 'TOOL_UNRESOLVED',
        severity: 'warning',
        nodeId: node.id,
        message: `Tool contract "${raw}" could not be resolved by the injected ToolProvider.`,
      });
      continue;
    }

    // params ↔ inputSchema (§6).
    const mismatch = matchToolParams(node.config.params ?? {}, contract.inputSchema);
    if (mismatch.missingRequired.length > 0 || mismatch.unknownParams.length > 0) {
      const parts: string[] = [];
      if (mismatch.missingRequired.length > 0) {
        parts.push(`missing required ${mismatch.missingRequired.join(', ')}`);
      }
      if (mismatch.unknownParams.length > 0) {
        parts.push(`unknown ${mismatch.unknownParams.join(', ')}`);
      }
      issues.push({
        code: 'TOOL_PARAMS_MISMATCH',
        severity: 'error',
        nodeId: node.id,
        message: `Tool node "${node.id}" params do not match ${formatRef(ref)} inputSchema: ${parts.join('; ')}.`,
        remediation:
          'Align the node params with the tool contract inputSchema: supply every required input and remove params the contract does not declare.',
      });
    }

    // effect ↔ authorization (headless, acid-safe): a gated-effect tool whose
    // OWN contract authorization is not "gate" is ungated at the source. This
    // reads only the injected ToolContract — never the BPMN process. The
    // PROCESS-level rules the handoff §6 lists (EFFECT_NEEDS_GATE / GATE_NOT_COVERING,
    // "a gate covering the action" over reachableGateFrom) need the surrounding
    // diagram and are born in @buildtovalue/core at SL-12; keeping this code
    // distinct (TOOL_EFFECT_UNGATED) avoids conflating the two (§2.3/§2.9).
    // Refinement (pendência): authorization "proibida" in use deserves its own
    // TOOL_FORBIDDEN code rather than folding into this one.
    if (effectRequiresGate(contract.effect) && contract.authorization !== 'gate') {
      issues.push({
        code: 'TOOL_EFFECT_UNGATED',
        severity: 'error',
        nodeId: node.id,
        message: `Tool node "${node.id}" invokes ${formatRef(ref)} with a "${contract.effect}" effect but its contract authorization is "${contract.authorization}", not gated.`,
        remediation:
          'A write-irreversible or external-commitment tool must declare authorization "gate"; the process must then route a btv:gate before the effect (checked in core).',
      });
    }
  }
}

/**
 * Squad Lane SL-3 (§6): an autonomy ≥ 2 workflow (bounded loop or higher) must
 * declare a governed budget. Missing it is a WARNING (never blocks) — the run
 * still simulates, just without a projected ceiling.
 */
function checkBudget(wf: AgentWorkflow, issues: ValidationIssue[]): void {
  if (wf.autonomyLevel >= 2 && wf.budget === undefined) {
    issues.push({
      code: 'BUDGET_MISSING',
      severity: 'warning',
      message: `Workflow "${wf.id}" is autonomy ${wf.autonomyLevel} but declares no budget.`,
      remediation:
        'Declare a budget { maxTokens, maxCostBRL, maxWallTimeMs, maxSteps } so the run has a governed ceiling (autonomy ≥ 2).',
    });
  }
}

/** Rule 5 (§3.5): non-empty input/output schemas + structural integrity. */
function checkSchemasAndStructure(wf: AgentWorkflow, issues: ValidationIssue[]): void {
  if (Object.keys(wf.inputSchema).length === 0) {
    issues.push({
      code: 'EMPTY_INPUT_SCHEMA',
      severity: 'error',
      message: 'inputSchema is empty.',
      remediation: 'Declare at least one input property (name → type token).',
    });
  }
  if (Object.keys(wf.outputSchema).length === 0) {
    issues.push({
      code: 'EMPTY_OUTPUT_SCHEMA',
      severity: 'error',
      message: 'outputSchema is empty.',
      remediation: 'Declare at least one output property (name → type token).',
    });
  }

  const index = nodeIndex(wf);
  for (const edge of wf.edges) {
    if (edge.edgeType === 'delegate') continue; // target is a ref, checked in checkRefs
    if (!index.has(edge.from) || !index.has(edge.to)) {
      issues.push({
        code: 'EDGE_ENDPOINT_MISSING',
        severity: 'error',
        message: `Edge ${edge.from} → ${edge.to} references a node that does not exist.`,
        remediation: 'Point the edge at existing node ids.',
      });
    }
  }
  for (const node of wf.nodes) {
    if (node.type !== 'decision') continue;
    for (const route of decisionRoutes(node)) {
      if (route.next !== END_ROUTE && !index.has(route.next)) {
        issues.push({
          code: 'DECISION_ROUTE_MISSING',
          severity: 'error',
          nodeId: node.id,
          message: `Decision "${node.id}" route ${route.branch} points at "${route.next}", which is neither a node nor "end".`,
          remediation: `Route the ${route.branch} branch to an existing node id or "end".`,
        });
      }
    }
  }
}

/**
 * Validates an AgentWorkflow against the §3 rules, the §1.4 honest-stop
 * prohibition and the §4 autonomy coherence rule. Pure and deterministic —
 * issue order is stable (rule order, then node/edge order).
 */
export function validateGraph(wf: AgentWorkflow, options: ValidateOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkSchemasAndStructure(wf, issues);
  checkImplicitMetric(wf, issues);
  checkRetryMax(wf, issues);
  checkCycleStop(wf, issues);
  checkStructuredLlm(wf, issues);
  checkRefs(wf, options, issues);
  checkToolContracts(wf, options, issues);
  checkBudget(wf, issues);
  issues.push(...autonomyCoherence(wf));
  return issues;
}

/** Convenience: true when validation produced no `error`-severity issue. */
export function isValid(wf: AgentWorkflow, options: ValidateOptions = {}): boolean {
  return validateGraph(wf, options).every((issue) => issue.severity !== 'error');
}
