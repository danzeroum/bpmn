import { describe, expectTypeOf, it } from 'vitest';
import type {
  BlockedDecision,
  BoundaryOption,
  GatewayKind,
  PendingChoice,
  PendingDecisionInput,
  SimulationState,
  Token,
  TransitionRecord,
} from '../src/index.js';

/**
 * Cerca §2 — SHAPE parity, verified structurally and WITHOUT importing the
 * ecosystem (agentflow stays zero-imports; the independence test scans src/).
 *
 * The reference shapes below are inlined VERBATIM from
 * `packages/simulation/src/types.ts` (H7). The assertions require mutual
 * assignability, so if either side's shape drifts the build breaks — the cue to
 * re-sync this copy. (A cross-package assignability check that imports both can
 * be added from a package that already depends on the ecosystem, e.g. A-6.)
 */

// ---- inlined H7 reference shapes (no import) ----
interface H7Token {
  id: string;
  nodeId: string;
}
type H7GatewayKind = 'exclusive' | 'parallel' | 'inclusive' | 'eventBased';
interface H7PendingChoice {
  nodeId: string;
  kind: Extract<H7GatewayKind, 'exclusive' | 'inclusive' | 'eventBased'>;
  multiple: boolean;
  options: { edgeId: string; targetId: string; label: string }[];
  approximate: boolean;
}
interface H7BoundaryOption {
  host: string;
  boundary: string;
  interrupting: boolean;
  label: string;
}
interface H7PendingDecisionInput {
  nodeId: string;
  label: string;
  inputs: string[];
}
interface H7TransitionRecord {
  step: number;
  type:
    | 'move'
    | 'split'
    | 'join-wait'
    | 'join-fire'
    | 'boundary'
    | 'decision'
    | 'decision-blocked'
    | 'end';
  message: string;
  nodeId?: string;
  edgeId?: string;
  approximate?: boolean;
}
interface H7BlockedDecision {
  nodeId: string;
  cell: string;
  reason: string;
}
interface H7SimulationState {
  tokens: H7Token[];
  joinArrivals: Record<string, string[]>;
  traversedEdges: string[];
  visitedNodes: string[];
  trail: H7TransitionRecord[];
  complete: boolean;
  deadlocked: boolean;
  pendingChoice: H7PendingChoice | null;
  boundaryOptions: H7BoundaryOption[];
  pendingDecisionInput: H7PendingDecisionInput | null;
  blockedDecision: H7BlockedDecision | null;
}

describe('agent simulation result is structurally identical to the H7 shape (§2)', () => {
  it('the three named types match exactly', () => {
    expectTypeOf<SimulationState>().toEqualTypeOf<H7SimulationState>();
    expectTypeOf<TransitionRecord>().toEqualTypeOf<H7TransitionRecord>();
    expectTypeOf<BlockedDecision>().toEqualTypeOf<H7BlockedDecision>();
  });

  it('the referenced shapes carried for parity match too', () => {
    expectTypeOf<Token>().toEqualTypeOf<H7Token>();
    expectTypeOf<GatewayKind>().toEqualTypeOf<H7GatewayKind>();
    expectTypeOf<PendingChoice>().toEqualTypeOf<H7PendingChoice>();
    expectTypeOf<BoundaryOption>().toEqualTypeOf<H7BoundaryOption>();
    expectTypeOf<PendingDecisionInput>().toEqualTypeOf<H7PendingDecisionInput>();
  });

  it('a state is assignable in both directions (runtime smoke of the type claim)', () => {
    const asAgent = (s: H7SimulationState): SimulationState => s;
    const asH7 = (s: SimulationState): H7SimulationState => s;
    expectTypeOf(asAgent).toBeFunction();
    expectTypeOf(asH7).toBeFunction();
  });
});
