import {
  XmlBuilder,
  childrenByLocalName,
  firstChildByLocalName,
  type XmlElement,
} from '@bpmn-react/core';
import type { DecisionRule, DecisionTable, DecisionTableColumn, HitPolicy } from './decisionTable.js';

/**
 * Canonical DMN 1.3 serialization of a decision table (OMG DMN §7.2.3):
 * `<dmn:decisionTable>` with `<dmn:input>` / `<dmn:output>` / `<dmn:rule>`
 * children — NOT the legacy `bpmnr:property` JSON blob. This is what makes a
 * decision interoperable with standard DMN tooling (Camunda, dmn-js, the DMN
 * TCK): the decision logic lives in the spec elements, not a vendor extension.
 *
 * The bpmn-react model's single-letter {@link HitPolicy} maps to the DMN
 * enumeration; ids for the wrapper/expression/entry elements are derived
 * deterministically from the model ids so re-export is byte-stable.
 */

/** Single-letter model hit policy → DMN `hitPolicy` enumeration value. */
const HIT_POLICY_TO_XML: Record<HitPolicy, string> = {
  U: 'UNIQUE',
  A: 'ANY',
  P: 'PRIORITY',
  F: 'FIRST',
  R: 'RULE ORDER',
  O: 'OUTPUT ORDER',
  C: 'COLLECT',
};

const XML_TO_HIT_POLICY: Record<string, HitPolicy> = Object.fromEntries(
  Object.entries(HIT_POLICY_TO_XML).map(([letter, word]) => [word, letter as HitPolicy]),
);

/** Text content of an element's `<dmn:text>` child (or the element itself). */
function textOf(el: XmlElement | undefined): string {
  if (!el) return '';
  const text = firstChildByLocalName(el, 'text');
  return (text ? text.text : el.text).trim();
}

/**
 * Writes a decision's logic as a canonical `<dmn:decisionTable>`. Called inside
 * the open `<dmn:decision>` element, after any requirements (the DMN schema
 * orders the decision's expression last).
 */
export function writeDecisionTable(
  xml: XmlBuilder,
  table: DecisionTable,
  decisionId: string,
): void {
  const inputs = table.inputs ?? [];
  const outputs = table.outputs ?? [];
  const rules = table.rules ?? [];
  xml.open('dmn:decisionTable', {
    id: `${decisionId}_dt`,
    hitPolicy: HIT_POLICY_TO_XML[table.hitPolicy] ?? HIT_POLICY_TO_XML.U,
  });
  for (const input of inputs) {
    xml.open('dmn:input', { id: input.id, label: input.label || undefined });
    xml.open('dmn:inputExpression', {
      id: `${input.id}_expr`,
      typeRef: input.typeRef || undefined,
    });
    xml.element('dmn:text', {}, input.expression);
    xml.close();
    xml.close();
  }
  for (const output of outputs) {
    xml.element('dmn:output', {
      id: output.id,
      label: output.label || undefined,
      name: output.expression || undefined,
      typeRef: output.typeRef || undefined,
    });
  }
  for (const rule of rules) {
    xml.open('dmn:rule', { id: rule.id });
    if (rule.annotation) xml.element('dmn:description', {}, rule.annotation);
    rule.inputEntries.forEach((entry, index) => {
      xml.open('dmn:inputEntry', { id: `${rule.id}_i${index}` });
      xml.element('dmn:text', {}, entry);
      xml.close();
    });
    rule.outputEntries.forEach((entry, index) => {
      xml.open('dmn:outputEntry', { id: `${rule.id}_o${index}` });
      xml.element('dmn:text', {}, entry);
      xml.close();
    });
    xml.close();
  }
  xml.close();
}

function readColumn(el: XmlElement, kind: 'input' | 'output'): DecisionTableColumn {
  if (kind === 'input') {
    const expr = firstChildByLocalName(el, 'inputExpression');
    return {
      id: el.attributes.id ?? '',
      label: el.attributes.label ?? '',
      expression: textOf(expr),
      typeRef: expr?.attributes.typeRef ?? '',
    };
  }
  return {
    id: el.attributes.id ?? '',
    label: el.attributes.label ?? '',
    expression: el.attributes.name ?? '',
    typeRef: el.attributes.typeRef ?? '',
  };
}

function readRule(el: XmlElement): DecisionRule {
  const annotation = firstChildByLocalName(el, 'description')?.text.trim();
  return {
    id: el.attributes.id ?? '',
    inputEntries: childrenByLocalName(el, 'inputEntry').map((entry) => textOf(entry)),
    outputEntries: childrenByLocalName(el, 'outputEntry').map((entry) => textOf(entry)),
    ...(annotation ? { annotation } : {}),
  };
}

/**
 * Reads a `<dmn:decisionTable>` child of a decision element back into the
 * model, or `undefined` when the decision carries no canonical table. Callers
 * fall back to the legacy `bpmnr:property` form only when this returns nothing.
 */
export function readDecisionTable(decisionEl: XmlElement): DecisionTable | undefined {
  const dt = firstChildByLocalName(decisionEl, 'decisionTable');
  if (!dt) return undefined;
  const rawHit = (dt.attributes.hitPolicy ?? '').toUpperCase();
  return {
    hitPolicy: XML_TO_HIT_POLICY[rawHit] ?? 'U',
    inputs: childrenByLocalName(dt, 'input').map((el) => readColumn(el, 'input')),
    outputs: childrenByLocalName(dt, 'output').map((el) => readColumn(el, 'output')),
    rules: childrenByLocalName(dt, 'rule').map(readRule),
  };
}
