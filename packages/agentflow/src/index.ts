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
