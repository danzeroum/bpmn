import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BpmnDiagram } from '@buildtovalue/core';
import {
  CoverageTracker,
  SimulationEngine,
  type DecisionEvaluator,
  type CoverageSummary,
  type Decision,
  type SimulationState,
  type TransitionRecord,
} from '@buildtovalue/simulation';

/** A token journey to animate along one edge, keyed so it plays exactly once. */
export interface TokenTravel {
  key: number;
  edgeId: string;
  targetNodeId: string;
  durationMs: number;
}

export interface UseSimulationResult {
  state: SimulationState;
  coverage: CoverageSummary;
  sessionNumber: number;
  /** Step-by-step (no animation). Defaults on under prefers-reduced-motion. */
  stepMode: boolean;
  setStepMode: (on: boolean) => void;
  /** True when an OR gateway participates (panel shows the approximation notice). */
  hasApproximateSemantics: boolean;
  /** A decision-free token can be advanced. */
  canAdvance: boolean;
  /** In-flight edge journeys for the token layer (empty in step mode). */
  travels: TokenTravel[];
  clearTravel: (key: number) => void;
  statusLine: string;
  advance: () => void;
  choose: (decision: Decision) => void;
  fireBoundary: (boundaryId: string) => void;
  reset: () => void;
  /** Access the live engine (for scenario capture / ledger — Handoff 7A-3). */
  engine: SimulationEngine;
}

/** Detects the user's reduced-motion preference (SSR/jsdom-safe). */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

const TRAVEL_MS = 450;

/**
 * React controller around the headless {@link SimulationEngine}. Owns the
 * engine and a {@link CoverageTracker} that survives resets (§3.1), mirrors
 * their state into React, and turns each step into token-travel animations
 * over the real edge geometry. All semantics live in the engine — this hook is
 * orchestration only.
 */
export function useSimulation(
  diagram: BpmnDiagram,
  options: { decisions?: DecisionEvaluator } = {},
): UseSimulationResult {
  const { decisions } = options;
  const engine = useMemo(() => new SimulationEngine(diagram, { decisions }), [diagram, decisions]);
  const tracker = useMemo(() => new CoverageTracker(engine.graph), [engine]);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [stepMode, setStepMode] = useState(prefersReducedMotion);
  const [travels, setTravels] = useState<TokenTravel[]>([]);
  const travelKey = useRef(0);

  // Restart cleanly whenever the diagram (hence engine) changes.
  useEffect(() => {
    setSessionNumber(1);
    setTravels([]);
    rerender();
  }, [engine, rerender]);

  const emitTravels = useCallback(
    (transitions: TransitionRecord[]) => {
      if (stepMode) return;
      const fresh = transitions
        .filter((t) => t.edgeId && (t.type === 'move' || t.type === 'split'))
        .map((t) => ({
          key: travelKey.current++,
          edgeId: t.edgeId!,
          targetNodeId: t.nodeId ?? '',
          durationMs: TRAVEL_MS,
        }));
      if (fresh.length > 0) setTravels((prev) => [...prev, ...fresh]);
    },
    [stepMode],
  );

  const clearTravel = useCallback((key: number) => {
    setTravels((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const advance = useCallback(() => {
    const result = engine.advance();
    emitTravels(result.transitions);
    // Folding coverage on every step keeps the checklist live mid-session.
    if (engine.complete) tracker.record(engine.state.traversedEdges);
    rerender();
  }, [engine, tracker, emitTravels, rerender]);

  const choose = useCallback(
    (decision: Decision) => {
      const result = engine.choose(decision);
      emitTravels(result.transitions);
      if (engine.complete) tracker.record(engine.state.traversedEdges);
      rerender();
    },
    [engine, tracker, emitTravels, rerender],
  );

  const fireBoundary = useCallback(
    (boundaryId: string) => {
      const result = engine.fireBoundary(boundaryId);
      emitTravels(result.transitions);
      if (engine.complete) tracker.record(engine.state.traversedEdges);
      rerender();
    },
    [engine, tracker, emitTravels, rerender],
  );

  const reset = useCallback(() => {
    // Fold the finished session's coverage before wiping the run (§3.1).
    tracker.record(engine.state.traversedEdges);
    engine.reset();
    setSessionNumber((n) => n + 1);
    setTravels([]);
    rerender();
  }, [engine, tracker, rerender]);

  const state = engine.state;
  const coverage = tracker.summary;

  const statusLine = useMemo(() => {
    if (engine.deadlocked) return 'Deadlock — token preso no join (aguardando ramo que não vem)';
    if (engine.complete) return 'Sessão completa — token chegou ao fim';
    if (state.blockedDecision) return 'Decisão não-simulável — token parado';
    if (state.pendingDecisionInput) return 'Aguardando entradas da decisão';
    if (state.pendingChoice) return 'Aguardando decisão no gateway';
    const token = state.tokens[0];
    const node = token ? engine.graph.nodes.get(token.nodeId) : undefined;
    return node ? `Token em: ${node.label || node.id}` : 'Simulação pronta';
  }, [engine, state]);

  return {
    state,
    coverage,
    sessionNumber,
    stepMode,
    setStepMode,
    hasApproximateSemantics: engine.hasApproximateSemantics,
    canAdvance: engine.canAdvance,
    travels,
    clearTravel,
    statusLine,
    advance,
    choose,
    fireBoundary,
    reset,
    engine,
  };
}
