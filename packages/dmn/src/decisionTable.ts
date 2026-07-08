import {
  addNodeCommand,
  compositeCommand,
  updateNodeCommand,
  type BpmnNode,
  type Command,
} from '@bpmn-react/core';

/** DMN hit policies with their effect phrases (Handoff 5 §4.2 menu). */
export const HIT_POLICIES = {
  U: 'Unique — no overlap, single match',
  A: 'Any — overlaps agree, single output',
  P: 'Priority — highest output priority wins',
  F: 'First — first matching rule wins',
  R: 'Rule order — all matches, rule order',
  O: 'Output order — all matches, output priority order',
  C: 'Collect — all matches aggregated',
} as const;

export type HitPolicy = keyof typeof HIT_POLICIES;

export interface DecisionTableColumn {
  id: string;
  label: string;
  /** FEEL input expression / output name. */
  expression: string;
  typeRef: string;
}

export interface DecisionRule {
  id: string;
  /** FEEL unary tests, one per input column ('-' = any). */
  inputEntries: string[];
  /** FEEL expressions, one per output column. */
  outputEntries: string[];
  annotation?: string;
}

export interface DecisionTable {
  hitPolicy: HitPolicy;
  inputs: DecisionTableColumn[];
  outputs: DecisionTableColumn[];
  rules: DecisionRule[];
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq += 1)}`;

/** A starter table: 1 input, 1 output, 1 any-rule — born a draft artifact. */
export function createDecisionTable(partial: Partial<DecisionTable> = {}): DecisionTable {
  return {
    hitPolicy: 'U',
    inputs: [{ id: nextId('in'), label: 'Input', expression: 'input', typeRef: 'string' }],
    outputs: [{ id: nextId('out'), label: 'Output', expression: 'output', typeRef: 'string' }],
    rules: [{ id: nextId('rule'), inputEntries: ['-'], outputEntries: [''] }],
    ...partial,
  };
}

/** The table stored on a decision node, if any. */
export function decisionTableOf(node: {
  properties: Record<string, unknown>;
}): DecisionTable | undefined {
  const table = node.properties.decisionTable;
  return table && typeof table === 'object' ? (table as DecisionTable) : undefined;
}

export interface InvalidCell {
  ruleId: string;
  /** Column index across inputs+outputs (inputs first). */
  column: number;
  message: string;
}

/**
 * Structural validation of FEEL cells — unbalanced quotes/brackets and empty
 * output entries. Never color-only in the UI: the editor renders ▲ + border
 * + tooltip per invalid cell (§4.2).
 */
export function validateDecisionTable(table: DecisionTable): InvalidCell[] {
  const invalid: InvalidCell[] = [];
  const balanced = (expr: string): boolean => {
    let depth = 0;
    let quote: string | null = null;
    for (const ch of expr) {
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') depth += 1;
      else if (ch === ')' || ch === ']') depth -= 1;
      if (depth < 0) return false;
    }
    return depth === 0 && quote === null;
  };
  for (const rule of table.rules) {
    rule.inputEntries.forEach((entry, index) => {
      if (!balanced(entry)) {
        invalid.push({ ruleId: rule.id, column: index, message: 'Expressão FEEL desbalanceada' });
      }
    });
    rule.outputEntries.forEach((entry, index) => {
      const column = table.inputs.length + index;
      if (entry.trim() === '') {
        invalid.push({ ruleId: rule.id, column, message: 'Saída obrigatória' });
      } else if (!balanced(entry)) {
        invalid.push({ ruleId: rule.id, column, message: 'Expressão FEEL desbalanceada' });
      }
    });
  }
  return invalid;
}

/** Wraps a command with a specific audit event (1 ledger entry per action). */
function withAudit(command: Command, type: string, details: Record<string, unknown>): Command {
  return { ...command, toAuditEvent: () => ({ type, details }) };
}

/**
 * Links a decision to a businessRuleTask — ONE undoable command, ONE ledger
 * entry (aceite 10.5.2); unlink never deletes the table.
 */
export function linkDecisionCommand(nodeId: string, decisionRef: string): Command {
  return withAudit(
    updateNodeCommand(nodeId, { properties: { decisionRef } }),
    'DECISION_LINKED',
    { nodeId, decisionRef },
  );
}

export function unlinkDecisionCommand(nodeId: string, decisionRef?: string): Command {
  return withAudit(
    updateNodeCommand(nodeId, { properties: { decisionRef: undefined } }),
    'DECISION_UNLINKED',
    { nodeId, ...(decisionRef ? { decisionRef } : {}) },
  );
}

/**
 * "+ criar nova tabela" (wireframe 2d): adds the decision node (born a draft
 * artifact with its starter table) AND links it to the businessRuleTask as
 * ONE undoable command / ONE ledger entry (aceite 10.5.2).
 */
export function createDecisionCommand(nodeId: string, decision: BpmnNode): Command {
  return withAudit(
    compositeCommand(`Create decision ${decision.label}`, [
      addNodeCommand(decision),
      updateNodeCommand(nodeId, { properties: { decisionRef: decision.id } }),
    ]),
    'DECISION_CREATED',
    { nodeId, decisionRef: decision.id },
  );
}

/** Creates (or replaces) the table bound to a DECISION node — undoable. */
export function setDecisionTableCommand(decisionId: string, table: DecisionTable): Command {
  return withAudit(
    updateNodeCommand(decisionId, { properties: { decisionTable: table } }),
    'DECISION_TABLE_CHANGED',
    { decisionId, hitPolicy: table.hitPolicy, rules: table.rules.length },
  );
}
