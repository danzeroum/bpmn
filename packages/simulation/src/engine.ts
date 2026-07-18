import { BpmnError } from '@buildtovalue/core';
import type { BpmnDiagram } from '@buildtovalue/core';
import { buildSimGraph, type SimGraph } from './graph.js';
import { computeDominators, dominates } from './dominators.js';
import type {
  BlockedDecision,
  BoundaryOption,
  Decision,
  DecisionEvaluator,
  ErrorThrowOption,
  EventSubprocessOption,
  PendingChoice,
  PendingDecisionInput,
  SimNode,
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
  /** HOST-injected decision-table support (SF-2); undefined = no decisions. */
  private readonly decisionSupport?: DecisionEvaluator;
  private blocked: BlockedDecision | null = null;

  constructor(
    private readonly diagram: BpmnDiagram,
    options: SimulationOptions = {},
  ) {
    this.graph = buildSimGraph(diagram, options.scope);
    this.dom = computeDominators(this.graph);
    this.decisionSupport = options.decisions;
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
    this.blocked = null;
    this.started = true;
    // Start events, then any source node when a scope has no explicit start
    // (BPMN allows an implicit start) — keeps the engine and soundness aligned.
    // An event-subprocess shell is NEVER an implicit start (ES-5): it has no
    // flow by construction (the editor's veto) and only fires by its event.
    const seeds =
      this.graph.starts.length > 0
        ? this.graph.starts
        : [...this.graph.nodes.values()]
            .filter((n) => n.incoming.length === 0 && !n.eventSubprocess)
            .map((n) => n.id);
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
      errorThrowOptions: this.errorThrowOptions,
      eventSubprocessOptions: this.eventSubprocessOptions,
      pendingDecisionInput: this.pendingDecisionInput,
      blockedDecision: this.blocked ? { ...this.blocked } : null,
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

  /**
   * Boundary events that can be fired right now (a token rests on their
   * host). E-6 (§3e): ERROR boundaries leave this manual list — the user
   * throws the ERROR ({@link errorThrowOptions} + {@link throwError}) and the
   * engine resolves the boundary by matching. `fireBoundary` itself still
   * accepts them (old scenarios replay unchanged).
   */
  get boundaryOptions(): BoundaryOption[] {
    const options: BoundaryOption[] = [];
    const hosts = new Set(this.tokens.map((t) => t.nodeId));
    for (const host of hosts) {
      for (const boundary of this.graph.boundariesByHost.get(host) ?? []) {
        const node = this.graph.nodes.get(boundary)!;
        if (node.eventKind === 'error') continue;
        options.push({
          host,
          boundary,
          interrupting: node.interrupting !== false,
          label: node.label || boundary,
          ...(node.eventKind !== undefined ? { eventKind: node.eventKind } : {}),
          ...(node.eventRef !== undefined ? { eventRef: node.eventRef } : {}),
        });
      }
    }
    return options;
  }

  /**
   * "Throw error" cards (E-6): one per host with a resting token and ≥1 error
   * boundary — and, since ES-5, also for activity hosts when the SCOPE has an
   * eligible event subprocess with an ERROR start (the error can be caught
   * without any boundary). The options are the DISTINCT named definitions the
   * candidates match on, plus the UNCATALOGUED error (`errorRef: undefined`,
   * reforço 10) — the UI path that exercises the declared catch-all.
   */
  get errorThrowOptions(): ErrorThrowOption[] {
    const cards: ErrorThrowOption[] = [];
    const esubErrors = this.errorEventSubprocesses();
    const hosts = new Set(this.tokens.map((t) => t.nodeId));
    for (const host of hosts) {
      const hostNode = this.graph.nodes.get(host)!;
      const errors = (this.graph.boundariesByHost.get(host) ?? [])
        .map((id) => this.graph.nodes.get(id)!)
        .filter((node) => node.eventKind === 'error');
      if (errors.length === 0 && (esubErrors.length === 0 || !this.isActivity(hostNode))) continue;
      const seen = new Set<string>();
      const options: ErrorThrowOption['options'] = [];
      for (const boundary of errors) {
        if (boundary.eventRef === undefined || seen.has(boundary.eventRef)) continue;
        seen.add(boundary.eventRef);
        options.push({ errorRef: boundary.eventRef, label: boundary.eventRefLabel });
      }
      for (const esub of esubErrors) {
        const ref = esub.esubStart!.ref;
        if (ref === undefined || seen.has(ref)) continue;
        seen.add(ref);
        options.push({ errorRef: ref, label: esub.esubStart!.refLabel });
      }
      options.push({}); // the uncatalogued error — label is the UI's
      cards.push({ host, hostLabel: hostNode.label || host, options });
    }
    return cards;
  }

  /**
   * Manual timer/conditional event-subprocess cards (ES-5, §4e): those kinds
   * NEVER auto-fire — the user fires them via {@link fireEventSubprocess}
   * while the scope is live. The mode is part of the option (reforço 10) so
   * the card can show it before the user decides.
   */
  get eventSubprocessOptions(): EventSubprocessOption[] {
    if (this.tokens.length === 0) return [];
    const options: EventSubprocessOption[] = [];
    for (const node of this.graph.nodes.values()) {
      const start = node.esubStart;
      if (!start || (start.kind !== 'timer' && start.kind !== 'conditional')) continue;
      options.push({
        sub: node.id,
        subLabel: node.label || node.id,
        startId: start.startId,
        kind: start.kind,
        interrupting: start.interrupting,
      });
    }
    return options;
  }

  /** Eligible ERROR-start event subprocesses of this scope (graph order). */
  private errorEventSubprocesses(): SimNode[] {
    return [...this.graph.nodes.values()].filter((n) => n.esubStart?.kind === 'error');
  }

  /** A host an error can be thrown on: a task/subProcess-like activity — not
   * a gateway, event, boundary or event-subprocess shell. */
  private isActivity(node: SimNode): boolean {
    return (
      !node.gateway &&
      !node.isStart &&
      !node.isEnd &&
      node.boundaryHost === undefined &&
      node.eventSubprocess !== true &&
      !node.type.toLowerCase().includes('event')
    );
  }

  /** A token exists that can be advanced without a decision. */
  get canAdvance(): boolean {
    return (
      !this.complete &&
      this.tokens.some((t) => this.isFreeToken(t))
    );
  }

  /** Advanceable without a decision: not a split, not awaiting/blocked on a
   * decision table (a blocked token stays put — the declared stop, §5). */
  private isFreeToken(token: Token): boolean {
    if (this.isDecisionSplit(token.nodeId)) return false;
    if (this.blocked?.nodeId === token.nodeId) return false;
    return !this.decisionSupport?.hasDecision(token.nodeId);
  }

  /** A businessRuleTask waiting for its decision inputs (SF-2), if any. */
  get pendingDecisionInput(): PendingDecisionInput | null {
    if (this.blocked) return null; // the honest warning owns the panel now
    const support = this.decisionSupport;
    if (!support) return null;
    const token = this.tokens.find((t) => support.hasDecision(t.nodeId));
    if (!token) return null;
    const node = this.graph.nodes.get(token.nodeId)!;
    return { nodeId: node.id, label: node.label || node.id, inputs: support.inputsOf(node.id) };
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
    const token = this.tokens.find((t) => this.isFreeToken(t));
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
    if (decision.kind === 'decision') return this.decideDecision(decision);
    if (decision.kind === 'error') return this.throwError(decision.host, decision.errorRef);
    if (decision.kind === 'signal') return this.throwSignal(decision.ref);
    if (decision.kind === 'message') return this.throwMessage(decision.ref);
    if (decision.kind === 'eventSubprocess') return this.fireEventSubprocess(decision.sub);
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
    this.applyBoundary(node, token);
    this.decisions.push({ kind: 'boundary', host, boundary: boundaryId });
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  /** Cancel-or-spawn semantics of one boundary firing (shared with E-6). */
  private applyBoundary(node: SimNode, token: Token): void {
    if (node.interrupting !== false) {
      // Interrupting: the host token is cancelled and re-emerges at the boundary.
      this.removeToken(token.id);
      this.placeToken(node.id);
      this.record('boundary', `Interrupting boundary "${node.label}" fired`, {
        nodeId: node.id,
      });
    } else {
      // Non-interrupting: the host keeps its token; a second one spawns.
      this.placeToken(node.id);
      this.record('boundary', `Non-interrupting boundary "${node.label}" fired`, {
        nodeId: node.id,
      });
    }
  }

  // ------------------------------------------------- thrown events (E-6, §3e)

  /**
   * Throw an error on a host: the USER picks the error (a named definition id
   * or the uncatalogued `undefined`), the ENGINE resolves the destination by
   * MATCHING. Since ES-5 the candidates include the eligible ERROR-start
   * event subprocesses of the token's scope, and the TOTAL precedence order
   * is declared (especificidade > escopo > catch-all, documented in
   * limitations.md):
   *
   *   1. event subprocess with the EXACT ref  (same scope — WINS)
   *   2. boundary with the EXACT ref          (outer scope — preterido)
   *   3. event subprocess catch-all (error start with no ref)
   *   4. boundary catch-all
   *
   * The first non-empty tier resolves the throw; MORE than one candidate in
   * that tier is a DECLARED stop naming the candidates ({@link BlockedDecision})
   * — never a guess (§5). Uncaught remains a declared stop (propagation
   * beyond the direct scope is not simulated).
   */
  throwError(host: string, errorRef?: string): StepResult {
    const token = this.tokens.find((t) => t.nodeId === host);
    if (!token) throw new SimulationError(`No token on host ${host} to throw an error on`);
    const hostNode = this.graph.nodes.get(host)!;
    const boundaries = (this.graph.boundariesByHost.get(host) ?? [])
      .map((id) => this.graph.nodes.get(id)!)
      .filter((node) => node.eventKind === 'error');
    const esubs = this.errorEventSubprocesses();
    const start = this.trail.length;
    const thrown = errorRef !== undefined ? `error "${errorRef}"` : 'uncatalogued error';
    const tiers: { candidates: SimNode[]; esub: boolean; exact: boolean }[] = [
      {
        candidates:
          errorRef !== undefined ? esubs.filter((e) => e.esubStart!.ref === errorRef) : [],
        esub: true,
        exact: true,
      },
      {
        candidates: errorRef !== undefined ? boundaries.filter((b) => b.eventRef === errorRef) : [],
        esub: false,
        exact: true,
      },
      { candidates: esubs.filter((e) => e.esubStart!.ref === undefined), esub: true, exact: false },
      { candidates: boundaries.filter((b) => b.eventRef === undefined), esub: false, exact: false },
    ];
    const winner = tiers.find((tier) => tier.candidates.length > 0);
    if (winner && winner.candidates.length === 1) {
      const target = winner.candidates[0];
      const via = winner.exact
        ? `errorRef "${errorRef}"`
        : 'the DECLARED catch-all (no errorRef)';
      if (winner.esub) {
        const preExisting = new Set(this.tokens.map((t) => t.id));
        this.catchByEventSubprocess(
          [target],
          preExisting,
          (esub) =>
            `Thrown ${thrown} on "${hostNode.label || host}": caught by event subprocess "${esub.label || esub.id}" (start ${esub.esubStart!.startId}, ${via}`,
        );
      } else {
        this.record(
          'event',
          `Thrown ${thrown} on "${hostNode.label || host}": caught by boundary "${target.label || target.id}" via ${winner.exact ? `errorRef match "${errorRef}"` : via}`,
          { nodeId: target.id },
        );
        this.applyBoundary(target, token);
      }
    } else if (!winner) {
      // Uncaught: propagation to a parent scope is not simulated (limitations).
      this.blocked = {
        nodeId: host,
        cell: errorRef ?? '(uncatalogued)',
        reason: `thrown ${thrown} is caught by NO boundary or event subprocess on "${hostNode.label || host}" — parent-scope propagation is not simulated`,
      };
      this.record(
        'decision-blocked',
        `Thrown ${thrown} on "${hostNode.label || host}" not caught: no eligible boundary or event subprocess — declared stop`,
        { nodeId: host },
      );
    } else {
      // Honest ambiguity: >1 candidates in the SAME tier (e.g. two event
      // subprocesses with the same ref, or two catch-alls of one kind).
      const candidates = winner.candidates.map((c) => `${c.id} ("${c.label || c.id}")`).join(', ');
      this.blocked = {
        nodeId: host,
        cell: errorRef ?? '(uncatalogued)',
        reason: `ambiguous catch for ${thrown}: candidates ${candidates} — refine the errorRefs`,
      };
      this.record(
        'decision-blocked',
        `Thrown ${thrown} on "${hostNode.label || host}" is AMBIGUOUS: candidates ${candidates} — declared stop`,
        { nodeId: host },
      );
    }
    this.decisions.push({ kind: 'error', host, ...(errorRef !== undefined ? { errorRef } : {}) });
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  /**
   * Shared catch semantics of event subprocesses for ONE throw (ES-5,
   * decisão 1 da ES-0): the token goes to the CONTAINER shell — descent into
   * its children is not simulated (declared in limitations.md). Interrupting
   * (via `startIsInterrupting`, single source) cancels every token of the
   * host scope that existed BEFORE the throw, exactly ONCE per throw — the
   * tokens this same throw just placed survive (reforço 9, the declared
   * broadcast rule). The trail names start, mode, and on interruption the
   * cancelled COUNT and the scope.
   */
  private catchByEventSubprocess(
    esubs: SimNode[],
    preExisting: Set<string>,
    describe: (esub: SimNode) => string,
  ): void {
    for (const esub of esubs) {
      const mode = esub.esubStart!.interrupting
        ? 'interrupting'
        : 'non-interrupting: scope continues';
      this.placeToken(esub.id);
      this.record('event', `${describe(esub)}, ${mode})`, { nodeId: esub.id });
    }
    if (esubs.some((esub) => esub.esubStart!.interrupting)) {
      const victims = this.tokens.filter((t) => preExisting.has(t.id));
      for (const victim of victims) this.removeToken(victim.id);
      this.record(
        'event',
        `interrupting: ${victims.length} token(s) cancelled in scope "${this.scopeLabel()}"`,
        {},
      );
    }
  }

  /** Human name of the simulated scope for the interruption trail line. */
  private scopeLabel(): string {
    if (this.graph.scope !== undefined) {
      return this.diagram.nodes[this.graph.scope]?.label || this.graph.scope;
    }
    return this.diagram.name || 'process';
  }

  /**
   * Manually fire a timer/conditional event subprocess (ES-5): those kinds
   * NEVER auto-fire — {@link eventSubprocessOptions} is the declared manual
   * card. Applies the SAME named interruption as the throw path (reforço 10).
   */
  fireEventSubprocess(subId: string): StepResult {
    const node = this.graph.nodes.get(subId);
    const esubStart = node?.esubStart;
    if (!node || !esubStart) {
      throw new SimulationError(`${subId} is not an eligible event subprocess`);
    }
    if (esubStart.kind !== 'timer' && esubStart.kind !== 'conditional') {
      throw new SimulationError(
        `Event subprocess ${subId} has a "${esubStart.kind}" start — fire it by throwing the event, not manually`,
      );
    }
    const start = this.trail.length;
    const preExisting = new Set(this.tokens.map((t) => t.id));
    this.catchByEventSubprocess(
      [node],
      preExisting,
      (esub) =>
        `Event subprocess "${esub.label || esub.id}" manually fired (start ${esubStart.startId}, ${esubStart.kind} never auto-fires in simulation`,
    );
    this.decisions.push({ kind: 'eventSubprocess', sub: subId, atStep: start });
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  /** Catch nodes of `kind` holding a resting token whose ref matches. */
  private waitingCatches(kind: 'signal' | 'message', ref: string): Token[] {
    return this.tokens.filter((token) => {
      const node = this.graph.nodes.get(token.nodeId);
      return (
        node !== undefined &&
        node.type === 'intermediateCatchEvent' &&
        node.eventKind === kind &&
        node.eventRef === ref
      );
    });
  }

  /** Eligible event subprocesses whose start is `kind` matching `ref`. */
  private matchingEventSubprocesses(kind: 'signal' | 'message', ref: string): SimNode[] {
    return [...this.graph.nodes.values()].filter(
      (n) => n.esubStart?.kind === kind && n.esubStart.ref === ref,
    );
  }

  /**
   * Broadcast a signal by named definition: EVERY waiting catch that matches
   * advances, and (ES-5) every matching event subprocess of the scope fires —
   * deterministic, no ambiguity possible. Zero recipients is a DECLARED
   * no-op in the trail, never a guessed route. When any recipient subprocess
   * is INTERRUPTING, the scope's pre-existing tokens are cancelled exactly
   * once AFTER all deliveries — the tokens this throw placed survive
   * (reforço 9, the declared rule).
   */
  throwSignal(ref: string): StepResult {
    const start = this.trail.length;
    const waiting = this.waitingCatches('signal', ref);
    const esubs = this.matchingEventSubprocesses('signal', ref);
    const total = waiting.length + esubs.length;
    // Trail wording is part of the E-6 compat contract: without event
    // subprocesses in play the line stays byte-identical to E-6.
    this.record(
      'event',
      total === 0
        ? `Signal "${ref}" thrown: no waiting catch — declared no-op`
        : esubs.length === 0
          ? `Signal "${ref}" thrown: broadcast to ${waiting.length} waiting catch(es)`
          : `Signal "${ref}" thrown: broadcast to ${total} recipient(s)`,
      {},
    );
    const preExisting = new Set(this.tokens.map((t) => t.id));
    for (const token of waiting) {
      const node = this.graph.nodes.get(token.nodeId)!;
      this.emit(token, node.outgoing, node.outgoing.length > 1 ? 'split' : 'move');
    }
    this.catchByEventSubprocess(
      esubs,
      preExisting,
      (esub) =>
        `Signal "${ref}" caught by event subprocess "${esub.label || esub.id}" (start ${esub.esubStart!.startId}`,
    );
    this.decisions.push({ kind: 'signal', ref });
    this.settleOrJoins();
    return { moved: total > 0, transitions: this.trail.slice(start) };
  }

  /**
   * Deliver a message by named definition: a SINGLE destination. Since ES-5
   * the candidate set includes matching MESSAGE-start event subprocesses of
   * the scope. More than one candidate in total means runtime correlation —
   * not simulable, so the stop is DECLARED naming ALL the candidates (see
   * limitations.md); zero is a declared no-op.
   */
  throwMessage(ref: string): StepResult {
    const start = this.trail.length;
    const waiting = this.waitingCatches('message', ref);
    const esubs = this.matchingEventSubprocesses('message', ref);
    const total = waiting.length + esubs.length;
    if (total === 1 && waiting.length === 1) {
      const node = this.graph.nodes.get(waiting[0].nodeId)!;
      this.record(
        'event',
        `Message "${ref}" delivered to its single waiting catch "${node.label || node.id}"`,
        { nodeId: node.id },
      );
      this.emit(waiting[0], node.outgoing, node.outgoing.length > 1 ? 'split' : 'move');
    } else if (total === 1) {
      const preExisting = new Set(this.tokens.map((t) => t.id));
      this.catchByEventSubprocess(
        esubs,
        preExisting,
        (esub) =>
          `Message "${ref}" caught by event subprocess "${esub.label || esub.id}" (start ${esub.esubStart!.startId}`,
      );
    } else if (total === 0) {
      this.record('event', `Message "${ref}" thrown: no waiting catch — declared no-op`, {});
    } else {
      const candidates = [
        ...waiting.map((t) => {
          const node = this.graph.nodes.get(t.nodeId)!;
          return `${node.id} ("${node.label || node.id}")`;
        }),
        ...esubs.map((esub) => `${esub.id} ("${esub.label || esub.id}", event subprocess)`),
      ].join(', ');
      const anchor = waiting[0]?.nodeId ?? esubs[0].id;
      this.blocked = {
        nodeId: anchor,
        cell: ref,
        reason: `message "${ref}" has ${total} waiting recipients (${candidates}) — runtime correlation is not simulable`,
      };
      this.record(
        'decision-blocked',
        `Message "${ref}" has ${total} waiting recipients (${candidates}) — declared stop (runtime correlation is not simulable)`,
        { nodeId: anchor },
      );
    }
    this.decisions.push({ kind: 'message', ref });
    this.settleOrJoins();
    return { moved: total === 1, transitions: this.trail.slice(start) };
  }

  /**
   * Evaluate the pending businessRuleTask decision (SF-2) with the supplied
   * context and route the token by the FIRST output value: with multiple
   * outgoing flows, the flow whose label equals the output (stringified) is
   * taken; with one, the token just moves on. Every failure mode — a cell
   * outside the S-FEEL subset, no matching rule, an output matching no flow —
   * is a DECLARED stop ({@link BlockedDecision}), never a guess (§5).
   */
  private decideDecision(decision: Extract<Decision, { kind: 'decision' }>): StepResult {
    const support = this.decisionSupport;
    if (!support?.hasDecision(decision.node)) {
      throw new SimulationError(`${decision.node} has no evaluable decision table`);
    }
    const token = this.tokens.find((t) => t.nodeId === decision.node);
    if (!token) throw new SimulationError(`No token at ${decision.node}`);
    const node = this.graph.nodes.get(decision.node)!;
    const start = this.trail.length;

    const outcome = support.evaluate(decision.node, decision.context);
    const stop = (cell: string, reason: string): StepResult => {
      this.blocked = { nodeId: node.id, cell, reason };
      this.record('decision-blocked', `Decision "${node.label || node.id}" not simulable: ${reason}`, {
        nodeId: node.id,
      });
      this.decisions.push(decision);
      return { moved: false, transitions: this.trail.slice(start) };
    };
    if (outcome.nonSimulable) return stop(outcome.nonSimulable.cell, outcome.nonSimulable.reason);
    if (outcome.noMatch || !outcome.outputs) {
      return stop('', 'no rule matched the provided inputs (declared non-result)');
    }

    const values = Object.values(outcome.outputs);
    const summary = Object.entries(outcome.outputs)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    this.record(
      'decision',
      `Decision "${node.label || node.id}" fired rule ${(outcome.ruleIndex ?? 0) + 1}: ${summary}`,
      { nodeId: node.id },
    );

    if (node.outgoing.length > 1) {
      const wanted = String(values[0]);
      const edgeId = node.outgoing.find((e) => this.graph.edges.get(e)!.label === wanted);
      if (!edgeId) {
        return stop('', `decision output '${wanted}' matches no outgoing flow label`);
      }
      this.emit(token, [edgeId], 'move');
    } else if (node.outgoing.length === 1) {
      this.emit(token, [node.outgoing[0]], 'move');
    } else {
      this.removeToken(token.id);
      this.record('end', `Token consumed at "${node.label || node.id}"`, { nodeId: node.id });
    }
    this.decisions.push(decision);
    this.settleOrJoins();
    return { moved: true, transitions: this.trail.slice(start) };
  }

  // ------------------------------------------------------------------- replay

  /** Rebuild a run deterministically from a scenario. Auto-advances between
   * recorded decisions; applies each decision at the point it becomes due. */
  static replay(
    diagram: BpmnDiagram,
    scenario: Scenario,
    options: Omit<SimulationOptions, 'scope'> = {},
  ): SimulationEngine {
    const engine = new SimulationEngine(diagram, {
      ...options,
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
      // A businessRuleTask waiting for inputs consumes its decision.
      const pendingDecision = engine.pendingDecisionInput;
      if (pendingDecision) {
        if (!next || next.kind !== 'decision' || next.node !== pendingDecision.nodeId) {
          throw new SimulationError(
            `Scenario diverged: decision ${pendingDecision.nodeId} needs inputs`,
          );
        }
        engine.choose(next);
        queue.shift();
        if (engine.blocked) break; // declared stop — the scenario ends here
        continue;
      }
      // A boundary decision fires before its host is advanced past.
      if (next && next.kind === 'boundary' && engine.tokens.some((t) => t.nodeId === next.host)) {
        engine.fireBoundary(next.boundary);
        queue.shift();
        continue;
      }
      // E-6: a thrown error re-resolves through the SAME matching, as soon as
      // its host holds a token (the boundary heuristic).
      if (next && next.kind === 'error' && engine.tokens.some((t) => t.nodeId === next.host)) {
        engine.throwError(next.host, next.errorRef);
        queue.shift();
        if (engine.blocked) break; // declared stop — the scenario ends here
        continue;
      }
      // E-6: signal/message throws re-resolve at their queue position.
      if (next && (next.kind === 'signal' || next.kind === 'message')) {
        engine.choose(next);
        queue.shift();
        if (engine.blocked) break; // declared stop — the scenario ends here
        continue;
      }
      // ES-5: a manual event-subprocess fire is anchored to WHEN it happened
      // (`atStep`) — an interrupting fire cancels whatever is live at that
      // moment, so replay advances up to the anchor before applying it.
      if (next && next.kind === 'eventSubprocess') {
        if (engine.trail.length < next.atStep && engine.canAdvance) {
          engine.advance();
          continue;
        }
        engine.choose(next);
        queue.shift();
        if (engine.blocked) break; // declared stop — the scenario ends here
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
    if (
      decision.kind === 'boundary' ||
      decision.kind === 'decision' ||
      decision.kind === 'error' ||
      decision.kind === 'signal' ||
      decision.kind === 'message' ||
      decision.kind === 'eventSubprocess'
    ) {
      return false;
    }
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

export class SimulationError extends BpmnError {
  constructor(message: string) {
    super('SIMULATION', message);
  }
}
