export {
  buildScopeGraphs,
  coReachableTo,
  cyclicComponents,
  isFlowEdge,
  isFlowNode,
  flowScopeOf,
  reachableFrom,
  type FlowEdge,
  type ScopeGraph,
} from './graph.js';
export { soundnessPromotionRule } from './promotion.js';
export {
  analyzeSoundness,
  soundnessRules,
  SOUNDNESS_CODES,
  SOUNDNESS_RULES,
  type SoundnessCode,
  type SoundnessLocale,
  type SoundnessOptions,
  type SoundnessRuleDefinition,
} from './rules.js';
