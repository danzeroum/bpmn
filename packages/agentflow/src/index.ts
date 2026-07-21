/**
 * @buildtovalue/agentflow — headless model of a governed AI-agent
 * sub-workflow (Handoff 12 A-1). Schema (3 nodes + decorators), versioned ref
 * parsing, graph validation and the normative autonomy scale. Zero ecosystem
 * imports; integrations arrive by injection.
 */

export * from './types.js';
export {
  type AgentRef,
  type RefInput,
  type ParsedRef,
  AgentRefError,
  parseRef,
  toRef,
  formatRef,
  isValidRef,
} from './ref.js';
export {
  type ValidationIssue,
  type ValidateOptions,
  validateGraph,
  isValid,
} from './validate.js';
export {
  type ToolEffect,
  type ToolAuthorization,
  type ToolSchemaField,
  type ToolSchema,
  type ToolContract,
  type ToolParamsMismatch,
  type ResolveTool,
  effectRequiresGate,
  isToolRef,
  matchToolParams,
} from './toolContract.js';
export {
  type GateRequirement,
  type AutonomyDefinition,
  AUTONOMY_SCALE,
  gateRequirement,
  requiresDownstreamGate,
  minCoherentLevel,
  autonomyCoherence,
} from './autonomy.js';
export {
  nodeIndex,
  hasDelegateEdge,
  decisionRoutes,
  internalSuccessors,
  canReach,
  loopComponents,
  hasRetryLoop,
  isBranchingDecision,
} from './graph.js';
export {
  APPROVAL_GATE_AGENT,
  RESEARCH_AGENT,
  DOCUMENT_REVIEW_AGENT,
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
} from './templates.js';
export {
  type Token,
  type GatewayKind,
  type PendingChoice,
  type BoundaryOption,
  type PendingDecisionInput,
  type TransitionRecord,
  type BlockedDecision,
  type SimulationState,
  type NodeFixture,
  type Fixtures,
  type SimulateOptions,
} from './simTypes.js';
export { simulate } from './simulate.js';
export {
  type LangGraphNode,
  type LangGraphEdge,
  type LangGraphJson,
  type LangGraphImportResult,
  type LangGraphExportResult,
  LangGraphImportError,
  importLangGraph,
  exportLangGraph,
} from './langgraph.js';
