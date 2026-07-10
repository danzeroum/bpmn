import type { BpmnDiagram } from '@buildtovalue/core';
import { buildSimGraph, type SimGraph } from './graph.js';
import { computeDominators, dominates } from './dominators.js';
import type {
  BoundaryOption,
  Decision,
  PendingChoice,
  SimulationOptions,
  SimulationState,
  Token,
  TransitionRecord,
} from './types.js';

/** What a single call to {@link SimulationEngine.advance} / choose produced. */
export interface StepResult {
  /** A token changed position (moved, split, joined or was consumed). */
  moved: boolean;
  /** The transitions appended to the trail by this step. */
  transitions: TransitionRecord[];
}

/**
 * Headless BPMN token engine. Small-step and deterministic: every call to
 * {@link advance} fires exactly one token by one hop, and every branching
 * point is resolved by an explicit {@link Decision}. The ordered list of
 * decisions IS the scenario ({@link scenario}), so {@link SimulationEngine.replay}
 * reproduces a run bit-for-bit.
 *
 * Exact semantics for **XOR, AND and event-based** gateways and boundary
 * events. **OR (inclusive)** uses a dominator-based structural convergence
 * rule (see {@link dominates} and {@link SimulationEngine.orJoinReady}): the
 * join fires once no live token can still reach it *without* having already
 * passed through it. This is re-evaluated after every step, so a branch that
 * diverges away from the join no longer strands it. The `approximate` flag is
 * retained because a fully token-state-exact OR-join is undecidable in the
 * general case; see `docs/limitations.md`. Never mutates the diagram.
 */
export class SimulationEngine {
  readonly graph: SimGraph;
  /** Immediate-dominator map of the flow graph — drives the OR-join rule. */
  private readonly dom: Map<string, string>;
  private tokens: Token[] = [];
  private joinArrivals = new Map<string, Set<string>>();
  private traversedEdges = new Set<string>();
  private visitedNodes = new Set<string>();
  private trail: TransitionRecord[] = [];
  private decisions: Decision[] = [];
  private tokenSeq = 0;
  private stepSeq = 0;
  private started = false;

  constructor(
    private readonly diagram: BpmnDiagram,
    options: SimulationOptions = {},
  ) {
    this.graph = buildSimGraph(diagram, options.scope);
    this.dom = computeDominators(this.graph);
    this.reset();
  }

  /** True when any inclusive (OR) gateway participates: OR is approximate. */
  get hasApproximateSemantics(): boolean {
    for (const node of this.graph.nodes.values()) {
      if (node.gateway === 'inclusive') return true;
    }
    return false;
  }

  /** Reset to the initial marking (a token on each start event). Coverage is
   * tracked externally, so callers keep it across resets (Handoff 7A §3.1). */
  reset(): void {
    this.tokens = [];
    this.joinArrivals.clear();
    this.traversedEdges.clear();
    this.visitedNodes.clear();
    this.trail = [];
    this.tokenSeq = 0;
    this.stepSeq = 0;
    this.started = true;
    // Start events, then any source node when a scope has no explicit start
    // (BPMN allows an implicit start) — keeps the engine and soundness aligned.
    const seeds =
      this.graph.starts.length > 0
        ? this.graph.starts
        : [...this.graph.nodes.values()].filter((n) => n.incoming.length === 0).map((n) => n.id);
    for (const nodeId of seeds) this.placeToken(nodeId);
  }

  // ------------------------------------------------------------------ queries

  get state(): SimulationState {
    return {
      tokens: this.tokens.map((t) => ({ ...t })),
      joinArrivals: Object.fromEntries([...this.joinArrivals].map(([k, v]) => [k, [...v]])),
      traversedEdges: [...this.traversedEdges],
      visitedNodes: [...this.visitedNodes],
      trail: this.trail.map((t) => ({ ...t })),
      complete: this.complete,
      deadlocked: this.deadlocked,
      pendingChoice: this.pendingChoice,
      boundaryOptions: this.boundaryOptions,
    };
  }

  /** The complete session trail (the human-readable transition log). */
  get transitions(): TransitionRecord[] {
    return this.trail.map((t) => ({ ...t }));
  }

  /** All tokens consumed and no token stuck at a sync join. */
  get complete(): boolean {
    return this.started && this.tokens.length === 0 && this.joinArrivals.size === 0;
  }

  /** Tokens are gone but some are absorbed at a sync join that will never
   * complete — the deadlock the soundness analysis predicts. */
  get deadlocked(): boolean {
    return this.started && this.tokens.length === 0 && this.joinArrivals.size > 0;
  }

  /** The first branch decision the engine is blocked on, if any. */
  get pendingChoice(): PendingChoice | null {
    const token = this.tokens.find((t) => this.isDecisionSplit(t.nodeId));
    if (!token) return null;
    const node = this.graph.nodes.get(token.nodeId)!;
    const kind = node.gateway as 'exclusive' | 'inclusive' | 'eventBased';
    return {
      nodeId: node.id,
      kind,
      multiple: kind === 'inclusive',
      approximate: kind === 'inclusive',
      options: node.outgoing.map((edgeId) => {
        const edge = this.graph.edges.get(edgeId)!;
        return { edgeId, targetId: edge.target, label: edge.label };
      }),
    };
  }

  /** Boundary events that can be fired right now (a token rests on their host). */
  get boundaryOptions(): BoundaryOption[] {
    const options: BoundaryOption[] = [];
    const hosts = new Set(this.tokens.map((t) => t.nodeId));
    for (const host of hosts) {
      for (const boundary of this.graph.boundariesByHost.get(host) ?? []) {
        const node = this.graph.nodes.get(boundary)!;
        options.push({
          host,
          boundary,
          interrupting: node.interrupting !== false,
          label: node.label || boundary,
        });
      }
    }
    return options;
  }

  /** A token exists that can be advanced without a decision. */
  get canAdvance(): boolean {
    return !this.complete && this.tokens.some((t) => !this.isDecisionSplit(t.nodeId));
  }

  /** The serializable scenario: the ordered decisions plus provenance. */
  get scenario(): Scenario {
    return {
      diagramId: this.diagram.id,
      versionId: this.diagram.version.id,
      semanticVersion: this.diagram.version.semanticVersion,
      scope: this.graph.scope ?? null,
      decisions: this.decisions.map((d) => ({ ...d })),
    };
  }

  // ----------------------------------------------------------------- stepping

  /** Advance the first decision-free token by one hop. No-op when the only
   * tokens sit at a split (resolve with {@link choose}) or the run is done. */
  advance(): StepResult {
    const start = this.trail.length;
    const token = this.tokens.find((t) => !this.isDecisionSplit(t.nodeId));
    if (!token) {
      // No free token, but an OR-join may have become ready now that the
      // branches diverging away from it are gone.
      this.settleOrJoins();
      const transitions = this.trail.slice(start);
      return { moved: transitions.length > 0, transitions };
    }
    this.step(token);
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  /** Resolve the pending branch decision and move the token(s). */
  choose(decision: Decision): StepResult {
    if (decision.kind === 'boundary') return this.fireBoundary(decision.boundary);
    const token = this.tokens.find((t) => t.nodeId === decision.gateway);
    if (!token) throw new SimulationError(`No token at gateway ${decision.gateway}`);
    const node = this.graph.nodes.get(token.nodeId)!;
    const start = this.trail.length;
    if (decision.kind === 'inclusive') {
      if (node.gateway !== 'inclusive') {
        throw new SimulationError(`${node.id} is not an inclusive gateway`);
      }
      const edges = decision.edges.filter((e) => node.outgoing.includes(e));
      if (edges.length === 0) throw new SimulationError('Inclusive choice needs ≥1 flow');
      this.emit(token, edges, 'split');
    } else {
      if (!node.outgoing.includes(decision.edge)) {
        throw new SimulationError(`Edge ${decision.edge} is not an output of ${node.id}`);
      }
      this.emit(token, [decision.edge], 'move');
    }
    this.decisions.push(decision);
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  /** Fire a boundary event on the host a token currently rests on. */
  fireBoundary(boundaryId: string): StepResult {
    const node = this.graph.nodes.get(boundaryId);
    if (!node?.boundaryHost) throw new SimulationError(`${boundaryId} is not a boundary event`);
    const host = node.boundaryHost;
    const token = this.tokens.find((t) => t.nodeId === host);
    if (!token) throw new SimulationError(`No token on host ${host} to interrupt`);
    const start = this.trail.length;
    if (node.interrupting !== false) {
      // Interrupting: the host token is cancelled and re-emerges at the boundary.
      this.removeToken(token.id);
      this.placeToken(boundaryId);
      this.record('boundary', `Interrupting boundary "${node.label}" fired`, {
        nodeId: boundaryId,
      });
    } else {
      // Non-interrupting: the host keeps its token; a second one spawns.
      this.placeToken(boundaryId);
      this.record('boundary', `Non-interrupting boundary "${node.label}" fired`, {
        nodeId: boundaryId,
      });
    }
    this.decisions.push({ kind: 'boundary', host, boundary: boundaryId });
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  // ------------------------------------------------------------------- replay

  /** Rebuild a run deterministically from a scenario. Auto-advances between
   * recorded decisions; applies each decision at the point it becomes due. */
  static replay(diagram: BpmnDiagram, scenario: Scenario): SimulationEngine {
    const engine = new SimulationEngine(diagram, {
      scope: scenario.scope ?? undefined,
    });
    const queue = [...scenario.decisions];
    let guard = 0;
    const maxSteps = 100_000; // loop-safety for pathological cyclic scenarios
    while (guard++ < maxSteps) {
      const next = queue[0];
      // A pending gateway choice must be consumed by the matching decision.
      const choice = engine.pendingChoice;
      if (choice) {
        if (!next || !SimulationEngine.matchesChoice(next, choice)) {
          throw new SimulationError(
            `Scenario diverged: gateway ${choice.nodeId} needs a decision`,
          );
        }
        engine.choose(next);
        queue.shift();
        continue;
      }
      // A boundary decision fires before its host is advanced past.
      if (next && next.kind === 'boundary' && engine.tokens.some((t) => t.nodeId === next.host)) {
        engine.fireBoundary(next.boundary);
        queue.shift();
        continue;
      }
      if (engine.canAdvance) {
        engine.advance();
        continue;
      }
      break;
    }
    if (queue.length > 0) {
      throw new SimulationError(`Scenario has ${queue.length} unreachable decision(s)`);
    }
    return engine;
  }

  private static matchesChoice(decision: Decision, choice: PendingChoice): boolean {
    if (decision.kind === 'boundary') return false;
    if (decision.kind === 'inclusive') {
      return choice.kind === 'inclusive' && decision.gateway === choice.nodeId;
    }
    return decision.gateway === choice.nodeId && choice.kind === decision.kind;
  }

  // -------------------------------------------------------------- internals

  private isDecisionSplit(nodeId: string): boolean {
    const node = this.graph.nodes.get(nodeId);
    if (!node?.gateway || node.outgoing.length <= 1) return false;
    return node.gateway === 'exclusive' || node.gateway === 'eventBased' || node.gateway === 'inclusive';
  }

  /** Advance a non-decision token: end/sink consumption, parallel split, or move. */
  private step(token: Token): void {
    const node = this.graph.nodes.get(token.nodeId)!;
    if (node.outgoing.length === 0) {
      // End event, or an implicit end (sink with no outgoing flow).
      this.removeToken(token.id);
      this.record('end', `Token consumed at "${node.label || node.id}"`, { nodeId: node.id });
    } else if (node.gateway === 'parallel' && node.outgoing.length > 1) {
      this.emit(token, node.outgoing, 'split');
    } else {
      // Single outgoing (task, event, XOR/OR join, AND with one out): move.
      this.emit(token, [node.outgoing[0]], 'move');
    }
  }

  /** Consume `token` and deliver a token along each of `edgeIds`. */
  private emit(token: Token, edgeIds: string[], mode: 'move' | 'split'): void {
    this.removeToken(token.id);
    if (mode === 'split') {
      const node = this.graph.nodes.get(token.nodeId)!;
      this.record('split', `Split at "${node.label || node.id}" → ${edgeIds.length} tokens`, {
        nodeId: node.id,
      });
    }
    for (const edgeId of edgeIds) this.deliver(edgeId, mode);
  }

  /** Traverse one edge and place / absorb the token at its target. */
  private deliver(edgeId: string, mode: 'move' | 'split'): void {
    const edge = this.graph.edges.get(edgeId)!;
    this.traversedEdges.add(edgeId);
    const target = this.graph.nodes.get(edge.target)!;
    const syncJoin = target.gateway === 'parallel' && target.incoming.length > 1;
    const orJoin = target.gateway === 'inclusive' && target.incoming.length > 1;

    if (syncJoin) {
      const arrivals = this.arrivalsFor(target.id);
      arrivals.add(edgeId);
      if (target.incoming.every((e) => arrivals.has(e))) {
        this.joinArrivals.delete(target.id);
        this.placeToken(target.id);
        this.record('join-fire', `AND join "${target.label || target.id}" synchronized`, {
          nodeId: target.id,
          edgeId,
        });
      } else {
        this.record(
          'join-wait',
          `AND join "${target.label || target.id}": ${arrivals.size} of ${target.incoming.length}`,
          { nodeId: target.id, edgeId },
        );
      }
      return;
    }

    if (orJoin) {
      // Record the arrival; firing is decided by settleOrJoins() at the end of
      // the step, once every token has moved — so a branch that later diverges
      // away from the join can't strand it.
      const arrivals = this.arrivalsFor(target.id);
      arrivals.add(edgeId);
      this.record('join-wait', `OR join "${target.label || target.id}" arrival`, {
        nodeId: target.id,
        edgeId,
        approximate: true,
      });
      return;
    }

    this.placeToken(target.id);
    if (mode === 'move') {
      this.record('move', `Token → "${target.label || target.id}"`, {
        nodeId: target.id,
        edgeId,
      });
    }
  }

  /**
   * Fires every waiting OR-join that has become ready, to a fixpoint. Run at
   * the end of each step: firing one join places a token that may in turn
   * settle another, and a token leaving on a diverging branch may unblock a
   * join no arrival would otherwise re-evaluate.
   */
  private settleOrJoins(): void {
    let fired = true;
    while (fired) {
      fired = false;
      for (const joinId of [...this.joinArrivals.keys()]) {
        const node = this.graph.nodes.get(joinId);
        if (node?.gateway !== 'inclusive') continue;
        if (!this.orJoinReady(joinId)) continue;
        this.joinArrivals.delete(joinId);
        this.placeToken(joinId);
        this.record('join-fire', `OR join "${node.label || joinId}" (approximate)`, {
          nodeId: joinId,
          approximate: true,
        });
        fired = true;
      }
    }
  }

  /**
   * OR-join convergence rule: ready once no live token can still reach the join
   * *without having already passed through it*. Reachability alone over-waits
   * in loops — a token downstream of the join can loop back to it — so we skip
   * any token the join **dominates** (Cooper–Harvey–Kennedy): such a token only
   * exists because a token already went through the join, so its next arrival
   * is a later activation cycle, not the one being synchronized now. This is
   * the global convergence analysis the local heuristic lacked.
   */
  private orJoinReady(joinId: string): boolean {
    const live = new Set<string>(this.tokens.map((t) => t.nodeId));
    for (const partial of this.joinArrivals.keys()) live.add(partial);
    live.delete(joinId);
    for (const from of live) {
      if (dominates(this.dom, joinId, from)) continue;
      if (this.canReach(from, joinId)) return false;
    }
    return true;
  }

  /** Forward reachability over sequence flow (BFS, O(V+E)). */
  private canReach(from: string, target: string): boolean {
    if (from === target) return true;
    const seen = new Set<string>([from]);
    const queue = [from];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = this.graph.nodes.get(current);
      for (const edgeId of node?.outgoing ?? []) {
        const next = this.graph.edges.get(edgeId)!.target;
        if (next === target) return true;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  }

  private arrivalsFor(nodeId: string): Set<string> {
    let set = this.joinArrivals.get(nodeId);
    if (!set) {
      set = new Set();
      this.joinArrivals.set(nodeId, set);
    }
    return set;
  }

  private placeToken(nodeId: string): void {
    this.tokens.push({ id: `t${this.tokenSeq++}`, nodeId });
    this.visitedNodes.add(nodeId);
  }

  private removeToken(tokenId: string): void {
    this.tokens = this.tokens.filter((t) => t.id !== tokenId);
  }

  private record(
    type: TransitionRecord['type'],
    message: string,
    opts: { nodeId?: string; edgeId?: string; approximate?: boolean } = {},
  ): void {
    this.trail.push({ step: this.stepSeq++, type, message, ...opts });
  }
}

/** A replayable simulation scenario (the roteiro) — canonical JSON. */
export interface Scenario {
  diagramId: string;
  versionId: string;
  semanticVersion: string;
  /** Simulated scope, or `null` for the top process level. */
  scope: string | null;
  decisions: Decision[];
}

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}
