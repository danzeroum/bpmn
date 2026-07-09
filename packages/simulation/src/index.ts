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
export type {
  BoundaryOption,
  Decision,
  GatewayKind,
  PendingChoice,
  SimEdge,
  SimNode,
  SimulationOptions,
  SimulationState,
  Token,
  TransitionRecord,
} from './types.js';
