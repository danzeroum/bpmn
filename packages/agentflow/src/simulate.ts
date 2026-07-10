/**
 * Mock simulation engine (Handoff 12 A-2).
 *
 * This is agentflow's OWN engine (cerca §2): it models message passing, data
 * mapping and retries over the abstract agent graph. It does NOT adapt or
 * import the H7 BPMN token engine — the only thing shared with
 * `@buildtovalue/simulation` is the result SHAPE (see `simTypes.ts`).
 *
 * It is deterministic: node outputs come from declared fixtures, never from a
 * clock or a random source (same run twice → byte-identical trail). Stops are
 * honest: an exhausted retry, an unmatched route, or a condition outside the
 * simulable subset all produce a {@link BlockedDecision} naming the node, the
 * reason and the count — the run never guesses a route (S-FEEL discipline).
 */

import { END_ROUTE, type AgentNode, type AgentWorkflow } from './types.js';
import { canReach, internalSuccessors, nodeIndex } from './graph.js';
import type {
  Fixtures,
  SimulateOptions,
  SimulationState,
  TransitionRecord,
} from './simTypes.js';

const DEFAULT_MAX_STEPS = 10_000;

/** A fresh, empty run state. */
function emptyState(): SimulationState {
  return {
    tokens: [],
    joinArrivals: {},
    traversedEdges: [],
    visitedNodes: [],
    trail: [],
    complete: false,
    deadlocked: false,
    pendingChoice: null,
    boundaryOptions: [],
    pendingDecisionInput: null,
    blockedDecision: null,
  };
}

/** Reads a dotted path (`a.b.c`) out of a plain object, or undefined. */
function readPath(source: Record<string, unknown>, path: string): unknown {
  let cur: unknown = source;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Parses a condition literal into a JS value, or `undefined` if unsupported. */
function parseLiteral(raw: string): string | number | boolean | undefined {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^"[^"]*"$/.test(t) || /^'[^']*'$/.test(t)) return t.slice(1, -1);
  return undefined;
}

const CONDITION = /^output\.([A-Za-z0-9_.]+)\s*(===|!==|>=|<=|>|<)\s*(.+)$/;

/** The result of evaluating a decision condition against the merged output. */
type ConditionResult = { value: boolean } | { blocked: string };

/**
 * Evaluates the simulable condition subset `output.<path> <op> <literal>`
 * against the accumulated output. Anything outside the subset — an unknown
 * shape, an absent field, an ordering compare on non-numbers — is a DECLARED
 * block, never a guess (§3, S-FEEL discipline).
 */
function evaluateCondition(condition: string, merged: Record<string, unknown>): ConditionResult {
  const match = CONDITION.exec(condition.trim());
  if (!match) return { blocked: `condition "${condition}" is outside the simulable subset` };
  const [, path, op, literalRaw] = match;
  const actual = readPath(merged, path);
  if (actual === undefined) return { blocked: `condition references output.${path}, which is absent` };
  const literal = parseLiteral(literalRaw);
  if (literal === undefined) return { blocked: `condition literal "${literalRaw.trim()}" is not simulable` };
  switch (op) {
    case '===':
      return { value: actual === literal };
    case '!==':
      return { value: actual !== literal };
    default: {
      if (typeof actual !== 'number' || typeof literal !== 'number') {
        return { blocked: `ordering compare needs numbers, got ${typeof actual} ${op} ${typeof literal}` };
      }
      const v =
        op === '>' ? actual > literal
        : op === '<' ? actual < literal
        : op === '>=' ? actual >= literal
        : actual <= literal;
      return { value: v };
    }
  }
}

/** Resolves `{{node.output.path}}` templates in tool params against the run
 * context — the data-mapping half of the semantics (§2). Non-strings and
 * unresolved templates pass through unchanged (deterministic). */
function resolveParams(
  params: Record<string, unknown> | undefined,
  context: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string') {
      out[key] = value;
      continue;
    }
    out[key] = value.replace(/\{\{\s*([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_.]+)\s*\}\}/g, (whole, node, path) => {
      const nodeOut = context.get(node);
      const resolved = nodeOut ? readPath(nodeOut, path) : undefined;
      return resolved === undefined ? whole : String(resolved);
    });
  }
  return out;
}

/** The i-th declared output for a node (last entry repeats), or `{}`. */
function fixtureOutput(fixtures: Fixtures, nodeId: string, visit: number): Record<string, unknown> {
  const outputs = fixtures[nodeId]?.outputs;
  if (!outputs || outputs.length === 0) return {};
  return outputs[Math.min(visit, outputs.length - 1)] ?? {};
}

function decoratorOf(node: AgentNode, type: 'memory' | 'planner' | 'errorBoundary') {
  return node.decorators?.find((d) => d.type === type);
}

/** Logical backoff (not wall-clock, §4): `exponential` → 2^(attempt-1), else 1. */
function backoffDelay(attempt: number, kind: 'fixed' | 'exponential' | undefined): number {
  return kind === 'exponential' ? 2 ** (attempt - 1) : 1;
}

/** The entry node: the first node with no forward (non-loop) predecessor. */
function entryNode(wf: AgentWorkflow, index: Map<string, AgentNode>): string | undefined {
  const hasForwardPredecessor = (id: string): boolean => {
    for (const node of wf.nodes) {
      if (node.id === id) continue;
      const reachesId = internalSuccessors(wf, node.id, index).includes(id);
      const routeToId =
        node.type === 'decision' &&
        (node.config.onTrue.next === id || node.config.onFalse.next === id);
      if ((reachesId || routeToId) && !canReach(wf, id, node.id, index)) return true; // predecessor is upstream
    }
    return false;
  };
  return wf.nodes.find((n) => !hasForwardPredecessor(n.id))?.id ?? wf.nodes[0]?.id;
}

/**
 * Runs a deterministic mock simulation of `wf` and returns the final
 * {@link SimulationState}. The trail is the ordered record of every micro-step;
 * an honest stop lands in `blockedDecision`, a clean finish sets `complete`.
 */
export function simulate(wf: AgentWorkflow, options: SimulateOptions = {}): SimulationState {
  const fixtures = options.fixtures ?? {};
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const index = nodeIndex(wf);
  const state = emptyState();

  const context = new Map<string, Record<string, unknown>>(); // nodeId → its last output
  let merged: Record<string, unknown> = {}; // accumulated agent output (data-mapping)
  const visitCount = new Map<string, number>(); // nodeId → times executed
  const failCount = new Map<string, number>(); // nodeId → execution failures so far
  const retryCount = new Map<string, number>(); // decisionId → loop-backs taken
  let clock = 0; // logical time (backoff), never wall-clock
  let step = 0;

  const record = (entry: Omit<TransitionRecord, 'step'>): void => {
    state.trail.push({ step: step++, ...entry });
  };
  const block = (nodeId: string, cell: string, reason: string): SimulationState => {
    state.blockedDecision = { nodeId, cell, reason };
    state.tokens = [{ id: 'token', nodeId }];
    record({ type: 'decision-blocked', message: `⛔ ${nodeId}: ${reason}`, nodeId });
    return state;
  };

  const entry = entryNode(wf, index);
  if (entry === undefined) {
    state.complete = true;
    return state;
  }
  let current: string = entry;

  while (step < maxSteps) {
    const node = index.get(current)!;
    state.tokens = [{ id: 'token', nodeId: current }];
    if (!state.visitedNodes.includes(current)) state.visitedNodes.push(current);

    if (node.type === 'decision') {
      const result = evaluateCondition(node.config.condition, merged);
      if ('blocked' in result) return block(node.id, 'condition', result.blocked);
      const branch: 'onTrue' | 'onFalse' = result.value ? 'onTrue' : 'onFalse';
      const route = node.config[branch];
      record({
        type: 'decision',
        message: `◆ ${node.id}: ${node.config.condition} → ${result.value} (${branch})`,
        nodeId: node.id,
      });

      if (route.next === END_ROUTE) {
        record({ type: 'end', message: `✓ end · ${JSON.stringify(merged)}`, nodeId: node.id });
        state.complete = true;
        state.tokens = [];
        return state;
      }
      if (!index.has(route.next)) {
        return block(node.id, branch, `route ${branch} points at "${route.next}", which is not a node`);
      }
      const loopsBack = canReach(wf, route.next, node.id, index);
      if (loopsBack) {
        const taken = (retryCount.get(node.id) ?? 0) + 1;
        retryCount.set(node.id, taken);
        const limit = route.maxRetries;
        if (limit === undefined) return block(node.id, branch, `unbounded retry route ${branch}`);
        if (taken > limit) {
          return block(node.id, branch, `retry exhausted after ${limit} attempts (${taken} tries)`);
        }
        record({ type: 'move', message: `↺ retry ${taken}/${limit} via ${branch}`, nodeId: node.id });
      }
      const edgeId = `${node.id}->${route.next}`;
      state.traversedEdges.push(edgeId);
      current = route.next;
      continue;
    }

    // llm / tool node — execute it (with errorBoundary handling), then move on.
    const visit = visitCount.get(node.id) ?? 0;
    const fails = fixtures[node.id]?.fails ?? 0;
    const failedSoFar = failCount.get(node.id) ?? 0;
    if (failedSoFar < fails) {
      failCount.set(node.id, failedSoFar + 1);
      const boundary = decoratorOf(node, 'errorBoundary');
      if (!boundary || boundary.type !== 'errorBoundary') {
        return block(node.id, 'execution', 'node failed with no error boundary');
      }
      const attempt = failedSoFar + 1;
      if (attempt > boundary.maxRetries) {
        return block(node.id, 'errorBoundary', `error boundary exhausted after ${boundary.maxRetries} retries`);
      }
      clock += backoffDelay(attempt, boundary.backoff);
      record({
        type: 'move',
        message: `⛑ ${node.id} errorBoundary retry ${attempt}/${boundary.maxRetries} · backoff Δ${backoffDelay(attempt, boundary.backoff)} (t=${clock})`,
        nodeId: node.id,
      });
      continue; // re-execute the same node
    }

    const output = fixtureOutput(fixtures, node.id, visit);
    visitCount.set(node.id, visit + 1);
    context.set(node.id, output);
    merged = { ...merged, ...output };

    const memory = decoratorOf(node, 'memory');
    if (memory && memory.type === 'memory') {
      record({
        type: 'move',
        message: `💾 ${node.id} memory[${memory.scope}${memory.expiry ? `·${memory.expiry}` : ''}] ← {${Object.keys(output).join(', ')}}`,
        nodeId: node.id,
      });
    }

    if (node.type === 'tool') {
      const resolved = resolveParams(node.config.params, context);
      record({
        type: 'move',
        message: `🛠 ${node.id} ${node.config.usesTool}(${JSON.stringify(resolved)}) → ${JSON.stringify(output)}`,
        nodeId: node.id,
      });
    } else {
      record({
        type: 'move',
        message: `🧠 ${node.id} (${node.config.model}) → ${JSON.stringify(output)}`,
        nodeId: node.id,
      });
    }

    // planner static (§4): successors are followed in declared order.
    const next = internalSuccessors(wf, node.id, index)[0];
    if (next === undefined) {
      record({ type: 'end', message: `✓ end · ${JSON.stringify(merged)}`, nodeId: node.id });
      state.complete = true;
      state.tokens = [];
      return state;
    }
    state.traversedEdges.push(`${node.id}->${next}`);
    current = next;
  }

  // Ran out of the step budget — an honest structural block, never a hang.
  return block(current, 'budget', `step budget ${maxSteps} exhausted`);
}
