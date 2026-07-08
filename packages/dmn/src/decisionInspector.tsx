import { useState } from 'react';
import { createNode, type BpmnNode } from '@bpmn-react/core';
import {
  SEAL_LABELS,
  useDiagram,
  useEditorConfig,
  type InspectorSection,
} from '@bpmn-react/react';
import {
  createDecisionCommand,
  createDecisionTable,
  decisionTableOf,
  linkDecisionCommand,
  unlinkDecisionCommand,
} from './decisionTable.js';
import { DMN_SPEC_VERSION } from './DmnXmlConverter.js';
import type { DecisionSummary } from './DecisionPeek.js';

export interface DecisionInspectorOptions {
  /**
   * Searches the host's decision registry. Defaults to the dmn:decision
   * nodes of the current diagram (label/ref substring match).
   */
  searchDecisions?: (query: string) => DecisionSummary[];
  /** "abrir →" — opens the decision's own editing surface (drill-down). */
  onOpen?: (ref: string) => void;
  /** "diff" — compares the linked version against the draft (optional). */
  onDiff?: (ref: string) => void;
  /** Spec label shown in the section header — parameterized (§11.4). */
  specVersion?: string;
}

/**
 * `DECISÃO · DMN` inspector section for businessRuleTask (Handoff 5 §4.3,
 * wireframe 2d) — a plugin `InspectorSection` rendered by PropertiesPanel.
 * Linked: card with name + semver + seal + hit policy + rule count and the
 * abrir → / diff / desvincular actions. Unlinked: registry search with
 * per-result vincular, or "+ criar nova tabela" (born RASCUNHO). Every
 * action is ONE undoable command + ONE ledger entry (aceite 10.5.2).
 */
export function decisionInspectorSection(
  options: DecisionInspectorOptions = {},
): InspectorSection {
  const specVersion = options.specVersion ?? DMN_SPEC_VERSION;

  function DecisionSection({ node }: { node: BpmnNode }) {
    const { diagram, execute } = useDiagram();
    // The editor's registry knows the plugin node types (dmn:decision).
    const { registry } = useEditorConfig();
    const [query, setQuery] = useState('');

    const decisionRef =
      typeof node.properties.decisionRef === 'string' ? node.properties.decisionRef : undefined;

    const fromDiagram = (ref: string): DecisionSummary | undefined => {
      const decision = diagram.nodes[ref];
      if (!decision || decision.type !== 'dmn:decision') return undefined;
      return {
        ref,
        label: decision.label,
        semanticVersion: diagram.version.semanticVersion,
        status: diagram.version.status,
        table: decisionTableOf(decision),
      };
    };

    const search =
      options.searchDecisions ??
      ((q: string) =>
        Object.values(diagram.nodes)
          .filter(
            (candidate) =>
              candidate.type === 'dmn:decision' &&
              (q.trim() === '' ||
                candidate.label.toLowerCase().includes(q.toLowerCase()) ||
                candidate.id.toLowerCase().includes(q.toLowerCase())),
          )
          .map((candidate) => fromDiagram(candidate.id))
          .filter((summary): summary is DecisionSummary => summary !== undefined));

    const createDecision = () => {
      const decision = createNode(
        {
          type: 'dmn:decision',
          label: `Decisão de ${node.label}`,
          x: node.x,
          y: node.y + node.height + 80,
          properties: { decisionTable: createDecisionTable() },
          versionId: diagram.version.id,
        },
        registry,
      );
      execute(createDecisionCommand(node.id, decision));
    };

    if (decisionRef) {
      const summary = options.searchDecisions
        ? options.searchDecisions(decisionRef).find((entry) => entry.ref === decisionRef)
        : fromDiagram(decisionRef);
      const table = summary?.table;
      return (
        <section className="btv-dmn-inspector" aria-label={`Decisão · ${specVersion}`}>
          <h4 className="btv-dmn-inspector-kicker">DECISÃO · {specVersion}</h4>
          <div className="btv-dmn-inspector-card" data-decision-card={decisionRef}>
            <strong>{summary?.label ?? decisionRef}</strong>
            {summary?.semanticVersion && <span>v{summary.semanticVersion}</span>}
            {summary?.status && (
              <span className="bpmnr-breadcrumb-seal" data-status={summary.status}>
                {SEAL_LABELS[summary.status]}
              </span>
            )}
            {table && (
              <p>
                hit {table.hitPolicy} · {table.rules.length}{' '}
                {table.rules.length === 1 ? 'regra' : 'regras'}
              </p>
            )}
            <div className="btv-dmn-inspector-actions">
              {options.onOpen && (
                <button type="button" onClick={() => options.onOpen?.(decisionRef)}>
                  abrir →
                </button>
              )}
              {options.onDiff && (
                <button type="button" onClick={() => options.onDiff?.(decisionRef)}>
                  diff
                </button>
              )}
              <button
                type="button"
                onClick={() => execute(unlinkDecisionCommand(node.id, decisionRef))}
              >
                desvincular
              </button>
            </div>
          </div>
        </section>
      );
    }

    const results = search(query);
    return (
      <section className="btv-dmn-inspector" aria-label={`Decisão · ${specVersion}`}>
        <h4 className="btv-dmn-inspector-kicker">DECISÃO · {specVersion}</h4>
        <input
          type="search"
          placeholder="Buscar decisão…"
          aria-label="Buscar decisão"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {results.length > 0 && (
          <ul className="btv-dmn-inspector-results">
            {results.map((result) => (
              <li key={result.ref}>
                <span>{result.label}</span>
                {result.semanticVersion && <span>v{result.semanticVersion}</span>}
                <button
                  type="button"
                  onClick={() => execute(linkDecisionCommand(node.id, result.ref))}
                >
                  vincular
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btv-dmn-inspector-create" onClick={createDecision}>
          + criar nova tabela
        </button>
      </section>
    );
  }

  return {
    id: 'dmn-decision',
    appliesTo: (node) => node.type === 'businessRuleTask',
    component: DecisionSection,
  };
}
