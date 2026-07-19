export {
  buildSimGraph,
  flowScopeOf,
  gatewayKindOf,
  isFlowNode,
  type SimGraph,
} from './graph.js';
export {
  SimulationEngine,
  SimulationError,
  type Scenario,
  type StepResult,
} from './engine.js';
export {
  CoverageTracker,
  enumerateStructuralPaths,
  MAX_PATHS,
  type CoveragePath,
  type CoverageSummary,
} from './coverage.js';
export { canonicalizeScenario, hashScenario } from './scenario.js';
export {
  buildSession,
  canonicalizeSession,
  coveragePercent,
  type SessionCoverage,
  type SimulationSession,
} from './session.js';
export type {
  BlockedDecision,
  BoundaryOption,
  CompensateCard,
  CompensationDestination,
  CompensationPlan,
  CompensationStep,
  Decision,
  DecisionEvaluator,
  ErrorThrowOption,
  EscalationDestination,
  EscalationThrowOption,
  EsubStartInfo,
  EventSubprocessOption,
  DecisionOutcome,
  PendingDecisionInput,
  GatewayKind,
  PendingChoice,
  SimEdge,
  SimNode,
  SimulationOptions,
  SimulationState,
  Token,
  TransitionRecord,
} from './types.js';
