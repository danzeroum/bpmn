import { evaluate, checkTable, type NonSimulable, type SfeelTable } from '@buildtovalue/sfeel';
import type { BpmnDiagram, BpmnNode } from '@buildtovalue/core';
import { decisionTableOf, type DecisionTable } from './decisionTable.js';

/**
 * S-FEEL-backed decision support for the token simulator (Handoff 9 SF-2).
 *
 * Structurally implements `@buildtovalue/simulation`'s `DecisionEvaluator`
 * WITHOUT importing it (dmn does not depend on simulation): the host passes
 * the returned object to `SimulationOptions.decisions`. Tables are resolved
 * from the node itself (`properties.decisionTable`) by default; hosts with a
 * registry/DRD lookup inject their own `resolveTable`.
 */
export interface SfeelDecisionSupport {
  hasDecision(nodeId: string): boolean;
  inputsOf(nodeId: string): string[];
  evaluate(
    nodeId: string,
    context: Record<string, number | string | boolean>,
  ): {
    outputs?: Record<string, number | string | boolean>;
    ruleIndex?: number;
    noMatch?: boolean;
    nonSimulable?: { cell: string; reason: string };
  };
}

const asSfeelTable = (table: DecisionTable): SfeelTable => table;

export function createSfeelDecisionSupport(
  diagram: BpmnDiagram,
  resolveTable: (node: BpmnNode) => DecisionTable | undefined = defaultResolve,
): SfeelDecisionSupport {
  const tableOf = (nodeId: string): DecisionTable | undefined => {
    const node = diagram.nodes[nodeId];
    return node ? resolveTable(node) : undefined;
  };
  return {
    hasDecision: (nodeId) => tableOf(nodeId) !== undefined,
    inputsOf: (nodeId) => (tableOf(nodeId)?.inputs ?? []).map((c) => c.expression),
    evaluate: (nodeId, context) => {
      const table = tableOf(nodeId);
      /* v8 ignore next -- guarded by hasDecision */
      if (!table) return { nonSimulable: { cell: '', reason: 'no decision table' } };
      const outcome = evaluate(asSfeelTable(table), context);
      if ('nonSimulable' in outcome) return { nonSimulable: outcome.nonSimulable };
      if (outcome.result === null) return { noMatch: true };
      return { outputs: outcome.result.outputs, ruleIndex: outcome.result.ruleIndex };
    },
  };
}

/** Default table source: the node's own `properties.decisionTable` — a
 * businessRuleTask carrying its table, or a DMN decision node. */
function defaultResolve(node: BpmnNode): DecisionTable | undefined {
  if (node.type !== 'businessRuleTask' && node.type !== 'decision') return undefined;
  return decisionTableOf(node);
}

/** Static ⚠ analysis of a node's table for the editor (§5 feedback-before-
 * simulation): every out-of-subset cell with rule/column coordinates. */
export function nonSimulableCells(table: DecisionTable): NonSimulable[] {
  return checkTable(asSfeelTable(table));
}
