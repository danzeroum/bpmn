import { useMemo, useState, type KeyboardEvent } from 'react';
import type { BpmnNode } from '@buildtovalue/core';
import {
  GovernanceBreadcrumb,
  useDiagram,
  useDismissal,
  type GovernanceBreadcrumbLevel,
} from '@buildtovalue/react';
import {
  decisionTableOf,
  HIT_POLICIES,
  setDecisionTableCommand,
  validateDecisionTable,
  type DecisionRule,
  type DecisionTable,
  type HitPolicy,
} from './decisionTable.js';
import { nonSimulableCells } from './sfeelSupport.js';

export interface DecisionTableEditorProps {
  /** The `dmn:decision` node whose table is edited (same diagram/stack). */
  decisionId: string;
  /** Governance trail rendered on top (fluxo vX ▸ nó ▸ tabela vY [SELO]). */
  breadcrumbLevels?: GovernanceBreadcrumbLevel[];
  onNavigate?: (id: string | null, index: number) => void;
  /** Opens the host's formal promotion flow (same modal as the Designer). */
  onPromote?: () => void;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq += 1)}`;

/**
 * Decision table editor (Handoff 5 §4.2) — HTML/DOM surface sharing the BTV
 * tokens, OUTSIDE the SVG budget. Canonical DMN anatomy: hit policy cell
 * (gold), input/output headers split by the 3px double divider, rule-number
 * column, dashed annotation column. Every mutation is ONE command on the
 * shared CommandStack (global undo merges canvas + table chronologically);
 * a non-draft table is read-only — editing proposes a new version through
 * the core's clone/supersede flow (aceite 10.5.4).
 */
export function DecisionTableEditor({
  decisionId,
  breadcrumbLevels,
  onNavigate,
  onPromote,
}: DecisionTableEditorProps) {
  const { diagram, execute } = useDiagram();
  const node: BpmnNode | undefined = diagram.nodes[decisionId];
  const table = node ? decisionTableOf(node) : undefined;
  const readOnly = diagram.version.status !== 'draft';

  const [selectedCell, setSelectedCell] = useState<{ ruleId: string; column: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ ruleId: string; column: number } | null>(null);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [hitMenuOpen, setHitMenuOpen] = useState(false);
  const [headerPopover, setHeaderPopover] = useState<{ kind: 'input' | 'output'; index: number } | null>(null);

  // §11.1: popovers sit on the SINGLE dismissal stack — never own listeners.
  useDismissal('dmn-hit-menu', hitMenuOpen, () => setHitMenuOpen(false));
  useDismissal('dmn-header-popover', headerPopover !== null, () => setHeaderPopover(null));

  const invalid = useMemo(() => (table ? validateDecisionTable(table) : []), [table]);
  const invalidAt = (ruleId: string, column: number) =>
    invalid.find((cell) => cell.ruleId === ruleId && cell.column === column);
  // §5 feedback-before-simulation: cells outside the S-FEEL subset get a ⚠
  // "não-simulável" marker while EDITING — before any token ever runs.
  const notSimulable = useMemo(() => (table ? nonSimulableCells(table) : []), [table]);
  const nonSimAt = (ruleIndex: number, column: number) =>
    notSimulable.find((c) => c.ruleIndex === ruleIndex && c.columnIndex === column);

  if (!node || !table) {
    return (
      <section className="btv-dmn-editor" aria-label="Decision table">
        <p className="btv-dmn-editor-empty">Nenhuma tabela vinculada a esta decisão.</p>
      </section>
    );
  }

  const commit = (next: DecisionTable) => execute(setDecisionTableCommand(decisionId, next));

  const setEntry = (ruleId: string, column: number, value: string) => {
    const rules = table.rules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      if (column < table.inputs.length) {
        const inputEntries = [...rule.inputEntries];
        inputEntries[column] = value;
        return { ...rule, inputEntries };
      }
      const outputIndex = column - table.inputs.length;
      if (outputIndex < table.outputs.length) {
        const outputEntries = [...rule.outputEntries];
        outputEntries[outputIndex] = value;
        return { ...rule, outputEntries };
      }
      return { ...rule, annotation: value };
    });
    commit({ ...table, rules });
  };

  const totalColumns = table.inputs.length + table.outputs.length + 1; // + annotation

  const moveCell = (event: KeyboardEvent, ruleId: string, column: number) => {
    const ruleIndex = table.rules.findIndex((rule) => rule.id === ruleId);
    let nextColumn = column;
    let nextRule = ruleIndex;
    if (event.key === 'Tab' || event.key === 'ArrowRight') nextColumn += 1;
    else if (event.key === 'ArrowLeft') nextColumn -= 1;
    else if (event.key === 'ArrowDown') nextRule += 1;
    else if (event.key === 'ArrowUp') nextRule -= 1;
    else if (event.key === 'Enter') {
      event.preventDefault();
      setEditingCell({ ruleId, column });
      return;
    } else return;
    event.preventDefault();
    nextColumn = Math.max(0, Math.min(totalColumns - 1, nextColumn));
    nextRule = Math.max(0, Math.min(table.rules.length - 1, nextRule));
    setSelectedCell({ ruleId: table.rules[nextRule].id, column: nextColumn });
  };

  const entryOf = (rule: DecisionRule, column: number): string => {
    if (column < table.inputs.length) return rule.inputEntries[column] ?? '';
    const outputIndex = column - table.inputs.length;
    if (outputIndex < table.outputs.length) return rule.outputEntries[outputIndex] ?? '';
    return rule.annotation ?? '';
  };

  const addRule = () =>
    commit({
      ...table,
      rules: [
        ...table.rules,
        {
          id: nextId('rule'),
          inputEntries: table.inputs.map(() => '-'),
          outputEntries: table.outputs.map(() => ''),
        },
      ],
    });

  const addColumn = (kind: 'input' | 'output') => {
    const column = { id: nextId(kind), label: kind === 'input' ? 'Input' : 'Output', expression: '', typeRef: 'string' };
    commit({
      ...table,
      inputs: kind === 'input' ? [...table.inputs, column] : table.inputs,
      outputs: kind === 'output' ? [...table.outputs, column] : table.outputs,
      rules: table.rules.map((rule) => ({
        ...rule,
        inputEntries: kind === 'input' ? [...rule.inputEntries, '-'] : rule.inputEntries,
        outputEntries: kind === 'output' ? [...rule.outputEntries, ''] : rule.outputEntries,
      })),
    });
  };

  const ruleOp = (ruleId: string, op: 'duplicate' | 'remove' | 'up' | 'down') => {
    const index = table.rules.findIndex((rule) => rule.id === ruleId);
    if (index < 0) return;
    const rules = [...table.rules];
    if (op === 'duplicate') {
      rules.splice(index + 1, 0, { ...rules[index], id: nextId('rule') });
    } else if (op === 'remove') {
      rules.splice(index, 1);
    } else {
      const to = op === 'up' ? index - 1 : index + 1;
      if (to < 0 || to >= rules.length) return;
      [rules[index], rules[to]] = [rules[to], rules[index]];
    }
    commit({ ...table, rules });
  };

  const updateColumn = (
    kind: 'input' | 'output',
    index: number,
    patch: Partial<{ label: string; expression: string; typeRef: string }>,
  ) => {
    const list = kind === 'input' ? table.inputs : table.outputs;
    const next = list.map((column, i) => (i === index ? { ...column, ...patch } : column));
    commit({ ...table, [kind === 'input' ? 'inputs' : 'outputs']: next });
  };

  const removeColumn = (kind: 'input' | 'output', index: number) => {
    if ((kind === 'input' ? table.inputs : table.outputs).length <= 1) return;
    commit({
      ...table,
      inputs: kind === 'input' ? table.inputs.filter((_, i) => i !== index) : table.inputs,
      outputs: kind === 'output' ? table.outputs.filter((_, i) => i !== index) : table.outputs,
      rules: table.rules.map((rule) => ({
        ...rule,
        inputEntries: kind === 'input' ? rule.inputEntries.filter((_, i) => i !== index) : rule.inputEntries,
        outputEntries: kind === 'output' ? rule.outputEntries.filter((_, i) => i !== index) : rule.outputEntries,
      })),
    });
    setHeaderPopover(null);
  };

  const cell = (rule: DecisionRule, column: number, kind: 'input' | 'output' | 'annotation') => {
    const value = entryOf(rule, column);
    const editing = editingCell?.ruleId === rule.id && editingCell.column === column;
    const selected = selectedCell?.ruleId === rule.id && selectedCell.column === column;
    const problem = kind === 'annotation' ? undefined : invalidAt(rule.id, column);
    const ruleIndex = table.rules.findIndex((r) => r.id === rule.id);
    const simIssue = kind === 'annotation' ? undefined : nonSimAt(ruleIndex, column);
    return (
      <td
        key={column}
        data-cell={`${rule.id}:${column}`}
        data-invalid={problem ? true : undefined}
        data-nonsimulable={simIssue ? true : undefined}
        data-cell-selected={selected || undefined}
        className={kind === 'annotation' ? 'btv-dmn-annotation' : undefined}
        title={problem?.message}
        tabIndex={0}
        onClick={() => !readOnly && setSelectedCell({ ruleId: rule.id, column })}
        onDoubleClick={() => !readOnly && setEditingCell({ ruleId: rule.id, column })}
        onKeyDown={(event) => {
          // Keystrokes inside the inline input bubble up to the cell —
          // navigation only applies to the cell itself.
          if (event.target !== event.currentTarget) return;
          if (!readOnly) moveCell(event, rule.id, column);
        }}
      >
        {editing && !readOnly ? (
          <input
            autoFocus
            defaultValue={value}
            aria-label="Editar célula"
            onBlur={(event) => {
              // Unchanged blur must not become a no-op command on the stack.
              if (event.target.value !== value) setEntry(rule.id, column, event.target.value);
              setEditingCell(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              if (event.key === 'Escape') setEditingCell(null);
            }}
          />
        ) : (
          <>
            {problem && <span aria-hidden>▲ </span>}
            {simIssue && (
              <span title={`não-simulável: ${simIssue.reason}`} aria-label="não-simulável">
                ⚠{' '}
              </span>
            )}
            {value}
          </>
        )}
      </td>
    );
  };

  return (
    <section className="btv-dmn-editor" aria-label="Decision table">
      {breadcrumbLevels && breadcrumbLevels.length > 0 && (
        <GovernanceBreadcrumb
          levels={breadcrumbLevels}
          onNavigate={onNavigate ?? (() => {})}
          ariaLabel="Decision navigation"
        />
      )}
      {readOnly && (
        <p className="btv-dmn-editor-banner" role="status">
          🔒 Tabela em versão {diagram.version.status.toUpperCase()} — somente leitura. Editar
          propõe uma nova versão (supersede, padrão do core).
        </p>
      )}
      <div className="btv-dmn-editor-head">
        <strong>{node.label}</strong>
        {onPromote && (
          <button type="button" onClick={onPromote}>
            Promover…
          </button>
        )}
      </div>
      <table className="btv-dmn-table">
        <thead>
          <tr>
            <th className="btv-dmn-hit">
              <button
                type="button"
                aria-label="Hit policy"
                disabled={readOnly}
                onClick={() => setHitMenuOpen((open) => !open)}
              >
                {table.hitPolicy}
              </button>
              {hitMenuOpen && (
                <div className="btv-dmn-hit-menu" role="menu">
                  {(Object.entries(HIT_POLICIES) as [HitPolicy, string][]).map(([key, phrase]) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitem"
                      data-active={key === table.hitPolicy || undefined}
                      onClick={() => {
                        commit({ ...table, hitPolicy: key });
                        setHitMenuOpen(false);
                      }}
                    >
                      <strong>{key}</strong> {phrase}
                    </button>
                  ))}
                </div>
              )}
            </th>
            {table.inputs.map((column, index) => (
              <th
                key={column.id}
                className={index === table.inputs.length - 1 ? 'btv-dmn-input-last' : undefined}
                data-header={`input:${index}`}
              >
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setHeaderPopover({ kind: 'input', index })}
                >
                  {column.label}
                </button>
              </th>
            ))}
            {table.outputs.map((column, index) => (
              <th key={column.id} data-header={`output:${index}`}>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setHeaderPopover({ kind: 'output', index })}
                >
                  {column.label}
                </button>
              </th>
            ))}
            <th className="btv-dmn-annotation">anotação</th>
          </tr>
        </thead>
        <tbody>
          {table.rules.map((rule, ruleIndex) => (
            <tr key={rule.id} data-rule-selected={selectedRule === rule.id || undefined}>
              <td className="btv-dmn-rule-number">
                <button
                  type="button"
                  aria-label={`Regra ${ruleIndex + 1}`}
                  onClick={() => setSelectedRule(selectedRule === rule.id ? null : rule.id)}
                >
                  {ruleIndex + 1}
                </button>
                {selectedRule === rule.id && !readOnly && (
                  <span className="btv-dmn-rule-ops">
                    <button type="button" aria-label="Duplicar regra" onClick={() => ruleOp(rule.id, 'duplicate')}>⧉</button>
                    <button type="button" aria-label="Subir regra" onClick={() => ruleOp(rule.id, 'up')}>↑</button>
                    <button type="button" aria-label="Descer regra" onClick={() => ruleOp(rule.id, 'down')}>↓</button>
                    <button type="button" aria-label="Remover regra" onClick={() => ruleOp(rule.id, 'remove')}>✕</button>
                  </span>
                )}
              </td>
              {table.inputs.map((_, index) => cell(rule, index, 'input'))}
              {table.outputs.map((_, index) => cell(rule, table.inputs.length + index, 'output'))}
              {cell(rule, table.inputs.length + table.outputs.length, 'annotation')}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="btv-dmn-editor-actions">
          <button type="button" onClick={addRule}>+ regra</button>
          <button type="button" onClick={() => addColumn('input')}>+ coluna de input</button>
          <button type="button" onClick={() => addColumn('output')}>+ coluna de output</button>
        </div>
      )}
      {headerPopover && (
        <div className="btv-dmn-header-popover" role="dialog" aria-label="Coluna">
          {(() => {
            const list = headerPopover.kind === 'input' ? table.inputs : table.outputs;
            const column = list[headerPopover.index];
            if (!column) return null;
            return (
              <>
                <label>
                  Nome
                  <input
                    defaultValue={column.label}
                    onBlur={(e) =>
                      e.target.value !== column.label &&
                      updateColumn(headerPopover.kind, headerPopover.index, { label: e.target.value })
                    }
                  />
                </label>
                <label>
                  Tipo
                  <input
                    defaultValue={column.typeRef}
                    onBlur={(e) =>
                      e.target.value !== column.typeRef &&
                      updateColumn(headerPopover.kind, headerPopover.index, { typeRef: e.target.value })
                    }
                  />
                </label>
                <label>
                  Expressão FEEL
                  <input
                    defaultValue={column.expression}
                    onBlur={(e) =>
                      e.target.value !== column.expression &&
                      updateColumn(headerPopover.kind, headerPopover.index, { expression: e.target.value })
                    }
                  />
                </label>
                <div>
                  <button type="button" onClick={() => removeColumn(headerPopover.kind, headerPopover.index)}>
                    Remover coluna
                  </button>
                  <button type="button" onClick={() => setHeaderPopover(null)}>
                    Fechar
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}
