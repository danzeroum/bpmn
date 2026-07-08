import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
  AuditLedger,
  CommandStack,
  createDefaultRegistry,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { BpmnDesigner, PropertiesPanel } from '@bpmn-react/react';
import {
  createDecisionCommand,
  createDecisionTable,
  DecisionPeek,
  DecisionTableEditor,
  decisionInspectorSection,
  decisionTableOf,
  DMN_NODE_TYPES,
  DMN_SPEC_VERSION,
  dmnPlugin,
  linkDecisionCommand,
  setDecisionTableCommand,
  unlinkDecisionCommand,
  validateDecisionTable,
  type DecisionTable,
} from '../src/index.js';

// No global test setup in this project: unmount between tests explicitly so
// screen-wide queries never see a previous test's tree.
afterEach(cleanup);

const TABLE: DecisionTable = {
  hitPolicy: 'F',
  inputs: [
    { id: 'in1', label: 'Renda', expression: 'renda', typeRef: 'number' },
    { id: 'in2', label: 'Histórico', expression: 'historico', typeRef: 'string' },
  ],
  outputs: [{ id: 'out1', label: 'Resultado', expression: 'resultado', typeRef: 'string' }],
  rules: [
    { id: 'r1', inputEntries: ['>= 8000', '"limpo"'], outputEntries: ['"aprovado"'] },
    { id: 'r2', inputEntries: ['>= 4000', '"limpo"'], outputEntries: ['"análise"'], annotation: 'mesa' },
    { id: 'r3', inputEntries: ['-', '"negativado"'], outputEntries: ['"negado"'] },
  ],
};

/** BPMN task + in-diagram decision — the F-B2 link scenario. */
function linkedDiagram(table: DecisionTable = TABLE): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DMN_NODE_TYPES) registry.register(def);
  const diagram = createDiagram({ name: 'Link demo', id: 'link-demo' });
  diagram.nodes = {
    score: createNode(
      {
        type: 'businessRuleTask',
        id: 'score',
        label: 'Score risk',
        x: 100,
        y: 100,
        properties: { decisionRef: 'risk' },
      },
      registry,
    ),
    risk: createNode(
      {
        type: 'dmn:decision',
        id: 'risk',
        label: 'Aprovar?',
        x: 100,
        y: 320,
        properties: { decisionTable: structuredClone(table) },
      },
      registry,
    ),
  };
  return diagram;
}

describe('validateDecisionTable (§4.2 — célula inválida nunca só cor)', () => {
  it('accepts a balanced table', () => {
    expect(validateDecisionTable(TABLE)).toEqual([]);
  });

  it('flags unbalanced quotes/brackets and empty outputs with column indices', () => {
    const broken: DecisionTable = {
      ...TABLE,
      rules: [
        { id: 'b1', inputEntries: ['[1..5', '"ok"'], outputEntries: [''] },
        { id: 'b2', inputEntries: ['-', '"aberta'], outputEntries: ['f(x))'] },
      ],
    };
    const invalid = validateDecisionTable(broken);
    expect(invalid).toContainEqual({ ruleId: 'b1', column: 0, message: 'Expressão FEEL desbalanceada' });
    expect(invalid).toContainEqual({ ruleId: 'b1', column: 2, message: 'Saída obrigatória' });
    expect(invalid).toContainEqual({ ruleId: 'b2', column: 1, message: 'Expressão FEEL desbalanceada' });
    expect(invalid).toContainEqual({ ruleId: 'b2', column: 2, message: 'Expressão FEEL desbalanceada' });
  });

  it('createDecisionTable starts U with 1 input, 1 output, 1 any-rule', () => {
    const table = createDecisionTable();
    expect(table.hitPolicy).toBe('U');
    expect(table.inputs).toHaveLength(1);
    expect(table.outputs).toHaveLength(1);
    expect(table.rules[0].inputEntries).toEqual(['-']);
    expect(validateDecisionTable(table)).toHaveLength(1); // empty output = born invalid, on purpose
  });

  it('decisionTableOf ignores non-object values', () => {
    expect(decisionTableOf({ properties: { decisionTable: 'nope' } })).toBeUndefined();
    expect(decisionTableOf({ properties: {} })).toBeUndefined();
    expect(decisionTableOf({ properties: { decisionTable: TABLE } })).toEqual(TABLE);
  });
});

describe('link/unlink/create commands (aceite 10.5.2)', () => {
  it('each is ONE undoable command and ONE ledger entry; unlink never deletes the table', async () => {
    const diagram = linkedDiagram();
    delete (diagram.nodes.score.properties as Record<string, unknown>).decisionRef;
    const stack = new CommandStack(diagram);
    const ledger = new AuditLedger();
    ledger.connectCommandStack(stack, { id: 'ana', role: 'editor' });

    stack.execute(linkDecisionCommand('score', 'risk'));
    expect(stack.current.nodes.score.properties.decisionRef).toBe('risk');
    stack.undo(); // ONE step back
    expect(stack.current.nodes.score.properties.decisionRef).toBeUndefined();
    stack.redo();

    stack.execute(unlinkDecisionCommand('score', 'risk'));
    expect(stack.current.nodes.score.properties.decisionRef).toBeUndefined();
    // The decision node and its table survive an unlink, always.
    expect(decisionTableOf(stack.current.nodes.risk)).toBeDefined();
    stack.undo();
    expect(stack.current.nodes.score.properties.decisionRef).toBe('risk');

    await ledger.flush();
    const types = ledger.getEntries().map((entry) => entry.type);
    expect(types).toEqual([
      'DECISION_LINKED',
      'DECISION_LINKED_UNDONE',
      'DECISION_LINKED_REDONE',
      'DECISION_UNLINKED',
      'DECISION_UNLINKED_UNDONE',
    ]);
  });

  it('createDecisionCommand adds node + link atomically (1 command, 1 entry)', async () => {
    const diagram = linkedDiagram();
    delete (diagram.nodes.score.properties as Record<string, unknown>).decisionRef;
    delete diagram.nodes.risk;
    const stack = new CommandStack(diagram);
    const ledger = new AuditLedger();
    ledger.connectCommandStack(stack, { id: 'ana', role: 'editor' });

    const registry = createDefaultRegistry();
    for (const def of DMN_NODE_TYPES) registry.register(def);
    const decision = createNode(
      { type: 'dmn:decision', id: 'nova', label: 'Nova decisão', properties: { decisionTable: createDecisionTable() } },
      registry,
    );
    stack.execute(createDecisionCommand('score', decision));
    expect(stack.current.nodes.nova).toBeDefined();
    expect(stack.current.nodes.score.properties.decisionRef).toBe('nova');

    stack.undo(); // ONE step removes both the node and the link
    expect(stack.current.nodes.nova).toBeUndefined();
    expect(stack.current.nodes.score.properties.decisionRef).toBeUndefined();

    await ledger.flush();
    expect(ledger.getEntries().map((entry) => entry.type)).toEqual([
      'DECISION_CREATED',
      'DECISION_CREATED_UNDONE',
    ]);
  });

  it('setDecisionTableCommand audits as DECISION_TABLE_CHANGED', async () => {
    const stack = new CommandStack(linkedDiagram());
    const ledger = new AuditLedger();
    ledger.connectCommandStack(stack, { id: 'ana', role: 'editor' });
    stack.execute(setDecisionTableCommand('risk', { ...TABLE, hitPolicy: 'U' }));
    expect(decisionTableOf(stack.current.nodes.risk)?.hitPolicy).toBe('U');
    await ledger.flush();
    expect(ledger.getEntries()[0].type).toBe('DECISION_TABLE_CHANGED');
    expect(ledger.getEntries()[0].details.hitPolicy).toBe('U');
  });
});

describe('DecisionTableEditor (§4.2)', () => {
  const mount = (diagram: BpmnDiagram) =>
    render(
      <BpmnDesigner diagram={diagram} plugins={[dmnPlugin]}>
        <DecisionTableEditor decisionId="risk" />
      </BpmnDesigner>,
    );

  it('renders the canonical anatomy: hit cell, double divider, rule numbers, annotation', () => {
    const { container } = mount(linkedDiagram());
    expect(container.querySelector('.btv-dmn-hit button')?.textContent).toBe('F');
    expect(container.querySelector('th.btv-dmn-input-last')?.textContent).toContain('Histórico');
    expect(container.querySelectorAll('.btv-dmn-rule-number')).toHaveLength(3);
    const annotations = container.querySelectorAll('td.btv-dmn-annotation');
    expect(annotations[1].textContent).toBe('mesa');
  });

  it('edits a cell through the shared CommandStack and undoes globally (aceite 10.5.4)', () => {
    const { container } = mount(linkedDiagram());
    const cell = container.querySelector('[data-cell="r1:0"]')!;
    fireEvent.doubleClick(cell);
    const input = container.querySelector('[data-cell="r1:0"] input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: '>= 9000' } });
    fireEvent.blur(input);
    expect(container.querySelector('[data-cell="r1:0"]')?.textContent).toContain('>= 9000');

    // Global undo: the table mutation sits on the SAME stack as the canvas.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-cell="r1:0"]')?.textContent).toContain('>= 8000');
  });

  it('marks invalid cells with ▲ + data-invalid + tooltip (never only color)', () => {
    const broken = linkedDiagram({
      ...TABLE,
      rules: [{ id: 'r1', inputEntries: ['[1..5', '-'], outputEntries: [''] }],
    });
    const { container } = mount(broken);
    const invalid = container.querySelector('[data-cell="r1:0"]')!;
    expect(invalid.getAttribute('data-invalid')).toBe('true');
    expect(invalid.textContent).toContain('▲');
    expect(invalid.getAttribute('title')).toBe('Expressão FEEL desbalanceada');
    expect(container.querySelector('[data-cell="r1:2"]')?.getAttribute('title')).toBe(
      'Saída obrigatória',
    );
  });

  it('changes the hit policy from the menu and closes it via the Esc stack (§11.1)', () => {
    const { container } = mount(linkedDiagram());
    fireEvent.click(container.querySelector('.btv-dmn-hit button')!);
    const menu = container.querySelector('.btv-dmn-hit-menu')!;
    expect(menu).not.toBeNull();
    expect(menu.textContent).toContain('Unique — no overlap, single match');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.btv-dmn-hit-menu')).toBeNull();

    fireEvent.click(container.querySelector('.btv-dmn-hit button')!);
    fireEvent.click(
      [...container.querySelectorAll('.btv-dmn-hit-menu button')].find((button) =>
        button.textContent?.startsWith('U'),
      )!,
    );
    expect(container.querySelector('.btv-dmn-hit button')?.textContent).toBe('U');
  });

  it('adds rules and columns; row ops duplicate/move/remove', () => {
    const { container, getByText } = mount(linkedDiagram());
    fireEvent.click(getByText('+ regra'));
    expect(container.querySelectorAll('.btv-dmn-rule-number')).toHaveLength(4);
    fireEvent.click(getByText('+ coluna de input'));
    expect(container.querySelectorAll('thead th[data-header^="input:"]')).toHaveLength(3);

    fireEvent.click(container.querySelector('.btv-dmn-rule-number button')!); // select rule 1
    fireEvent.click(container.querySelector('[aria-label="Duplicar regra"]')!);
    expect(container.querySelectorAll('.btv-dmn-rule-number')).toHaveLength(5);
    fireEvent.click(container.querySelector('[aria-label="Remover regra"]')!);
    expect(container.querySelectorAll('.btv-dmn-rule-number')).toHaveLength(4);
  });

  it('is read-only outside draft: banner + no editing affordances (aceite 10.5.4)', () => {
    const diagram = linkedDiagram();
    diagram.version.status = 'active';
    const { container } = mount(diagram);
    expect(container.querySelector('.btv-dmn-editor-banner')?.textContent).toContain(
      'somente leitura',
    );
    expect(container.querySelector('.btv-dmn-editor-banner')?.textContent).toContain('supersede');
    const cell = container.querySelector('[data-cell="r1:0"]')!;
    fireEvent.doubleClick(cell);
    expect(container.querySelector('[data-cell="r1:0"] input')).toBeNull();
    expect(container.querySelector('.btv-dmn-editor-actions')).toBeNull();
    expect((container.querySelector('.btv-dmn-hit button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('edits column metadata through the header popover', () => {
    const { container } = mount(linkedDiagram());
    fireEvent.click(container.querySelector('th[data-header="input:0"] button')!);
    const popover = container.querySelector('.btv-dmn-header-popover')!;
    expect(popover).not.toBeNull();
    const nameInput = popover.querySelector('input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Renda anual' } });
    fireEvent.blur(nameInput);
    expect(container.querySelector('th[data-header="input:0"]')?.textContent).toContain(
      'Renda anual',
    );
  });
});

describe('DecisionPeek (aceite 10.5.1)', () => {
  const mount = () => {
    const utils = render(
      <BpmnDesigner diagram={linkedDiagram()} plugins={[dmnPlugin]}>
        <DecisionPeek />
      </BpmnDesigner>,
    );
    return utils;
  };

  it('opens synchronously on selection, as DOM outside the SVG, and shows the summary', () => {
    const { container } = mount();
    expect(container.querySelector('[data-decision-peek]')).toBeNull();

    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    const peek = container.querySelector('[data-decision-peek="risk"]')!;
    expect(peek).not.toBeNull();
    // Zero nodes inserted into the SVG: the peek is an HTML overlay.
    expect(peek.closest('svg')).toBeNull();
    expect(peek.textContent).toContain('Aprovar?');
    expect(peek.textContent).toContain('First · 3 regras · 2→1');
    expect(peek.textContent).toContain('+1 regras…'); // 2 shown of 3
    expect(peek.querySelectorAll('.btv-dmn-peek-rules li')).toHaveLength(2);
  });

  it('Esc closes the peek FIRST and keeps the selection; next Esc clears it (§11.1)', () => {
    const { container } = mount();
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg')!, { button: 0 });
    expect(container.querySelector('[data-decision-peek]')).not.toBeNull();

    const svgCountWithPeek = container.querySelector('svg')!.querySelectorAll('*').length;
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-decision-peek]')).toBeNull();
    // Selection untouched by the peek's dismissal...
    expect(container.querySelector('[data-node-id="score"][data-selected]')).not.toBeNull();
    // ...and the SVG is byte-identical with/without the peek (10.5.1).
    expect(container.querySelector('svg')!.querySelectorAll('*').length).toBe(svgCountWithPeek);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-node-id="score"][data-selected]')).toBeNull();
  });

  it('closes on deselection and re-opens on re-selection after a dismissal', () => {
    const { container } = mount();
    const node = container.querySelector('[data-node-id="score"]')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.keyDown(window, { key: 'Escape' }); // dismiss peek, selection stays
    fireEvent.keyDown(window, { key: 'Escape' }); // clear selection
    expect(container.querySelector('[data-decision-peek]')).toBeNull();

    // Re-selecting the same node re-arms and re-opens the peek.
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    expect(container.querySelector('[data-decision-peek]')).not.toBeNull();
  });

  it('stays closed for nodes without a decisionRef', () => {
    const diagram = linkedDiagram();
    delete (diagram.nodes.score.properties as Record<string, unknown>).decisionRef;
    const { container } = render(
      <BpmnDesigner diagram={diagram} plugins={[dmnPlugin]}>
        <DecisionPeek />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    expect(container.querySelector('[data-decision-peek]')).toBeNull();
  });
});

describe('decisionInspectorSection (§4.3, wireframe 2d)', () => {
  const mountPanel = (diagram: BpmnDiagram) =>
    render(
      <BpmnDesigner diagram={diagram} plugins={[dmnPlugin]}>
        <PropertiesPanel />
      </BpmnDesigner>,
    );

  it('shows the linked card with semver + seal + hit + rule count and spec version (§11.4)', () => {
    const { container } = mountPanel(linkedDiagram());
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    const card = container.querySelector('[data-decision-card="risk"]')!;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Aprovar?');
    expect(card.textContent).toContain('v0.1.0');
    expect(card.textContent).toContain('RASCUNHO');
    expect(card.textContent).toContain('hit F · 3 regras');
    expect(container.querySelector('.btv-dmn-inspector-kicker')?.textContent).toBe(
      `DECISÃO · ${DMN_SPEC_VERSION}`,
    );
  });

  it('desvincular unlinks without deleting the table; search + vincular re-links', () => {
    const { container, getByText, getByLabelText } = mountPanel(linkedDiagram());
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    fireEvent.click(getByText('desvincular'));
    expect(container.querySelector('[data-decision-card]')).toBeNull();
    // Table still on the decision node (10.5.2), glyph still rendered.
    expect(container.querySelector('[data-decision-table-glyph]')).not.toBeNull();

    fireEvent.change(getByLabelText('Buscar decisão'), { target: { value: 'aprovar' } });
    fireEvent.click(getByText('vincular'));
    expect(container.querySelector('[data-decision-card="risk"]')).not.toBeNull();
  });

  it('+ criar nova tabela creates a draft decision and links it in one step', () => {
    const diagram = linkedDiagram();
    delete (diagram.nodes.score.properties as Record<string, unknown>).decisionRef;
    delete diagram.nodes.risk;
    const { container, getByText } = mountPanel(diagram);
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    fireEvent.click(getByText('+ criar nova tabela'));

    const card = container.querySelector('[data-decision-card]')!;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Decisão de Score risk');
    expect(card.textContent).toContain('hit U · 1 regra');

    // One undo removes both the created node and the link.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-decision-card]')).toBeNull();
    expect(container.querySelectorAll('[data-decision-table-glyph]')).toHaveLength(0);
  });

  it('spec version is parameterized, never hardcoded (§11.4)', () => {
    const custom = decisionInspectorSection({ specVersion: 'DMN 1.5' });
    const diagram = linkedDiagram();
    const { container } = render(
      <BpmnDesigner
        diagram={diagram}
        plugins={[{ ...dmnPlugin, inspectorSections: [custom] }]}
      >
        <PropertiesPanel />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    expect(container.querySelector('.btv-dmn-inspector-kicker')?.textContent).toBe(
      'DECISÃO · DMN 1.5',
    );
  });
});

describe('DecisionTableEditor — interações de teclado e colunas (§4.2)', () => {
  const mount = (diagram: BpmnDiagram, props: Record<string, unknown> = {}) =>
    render(
      <BpmnDesigner diagram={diagram} plugins={[dmnPlugin]}>
        <DecisionTableEditor decisionId="risk" {...props} />
      </BpmnDesigner>,
    );

  it('navigates cells with arrows/Tab and enters edit with Enter, Escape cancels', () => {
    const { container } = mount(linkedDiagram());
    const cellAt = (key: string) => container.querySelector(`[data-cell="${key}"]`)!;
    fireEvent.click(cellAt('r1:0'));
    expect(cellAt('r1:0').getAttribute('data-cell-selected')).toBe('true');

    fireEvent.keyDown(cellAt('r1:0'), { key: 'ArrowRight' });
    expect(cellAt('r1:1').getAttribute('data-cell-selected')).toBe('true');
    fireEvent.keyDown(cellAt('r1:1'), { key: 'ArrowDown' });
    expect(cellAt('r2:1').getAttribute('data-cell-selected')).toBe('true');
    fireEvent.keyDown(cellAt('r2:1'), { key: 'ArrowLeft' });
    expect(cellAt('r2:0').getAttribute('data-cell-selected')).toBe('true');
    fireEvent.keyDown(cellAt('r2:0'), { key: 'ArrowUp' });
    expect(cellAt('r1:0').getAttribute('data-cell-selected')).toBe('true');
    fireEvent.keyDown(cellAt('r1:0'), { key: 'Tab' });
    expect(cellAt('r1:1').getAttribute('data-cell-selected')).toBe('true');
    // Clamped at the last column (inputs + outputs + annotation).
    fireEvent.keyDown(cellAt('r1:1'), { key: 'Tab' });
    fireEvent.keyDown(cellAt('r1:2'), { key: 'Tab' });
    fireEvent.keyDown(cellAt('r1:3'), { key: 'Tab' });
    expect(cellAt('r1:3').getAttribute('data-cell-selected')).toBe('true');
    // Other keys leave the selection alone.
    fireEvent.keyDown(cellAt('r1:3'), { key: 'a' });
    expect(cellAt('r1:3').getAttribute('data-cell-selected')).toBe('true');

    // Enter starts inline editing; Escape cancels WITHOUT committing.
    fireEvent.keyDown(cellAt('r1:3'), { key: 'Enter' });
    const input = container.querySelector('[data-cell="r1:3"] input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'descartado' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('[data-cell="r1:3"] input')).toBeNull();
    expect(container.querySelector('[data-cell="r1:3"]')?.textContent).not.toContain('descartado');
  });

  it('adds an output column, moves rules up/down, edits annotation through setEntry', () => {
    const { container, getByText } = mount(linkedDiagram());
    fireEvent.click(getByText('+ coluna de output'));
    expect(container.querySelectorAll('thead th[data-header^="output:"]')).toHaveLength(2);

    // Move rule 1 down, then back up (order = first cell of each row).
    const firstCellText = () =>
      container.querySelector('tbody tr:first-child td[data-cell]')?.textContent;
    const before = firstCellText();
    fireEvent.click(container.querySelector('.btv-dmn-rule-number button')!);
    fireEvent.click(container.querySelector('[aria-label="Descer regra"]')!);
    expect(firstCellText()).not.toBe(before);
    // The ops follow the selected rule to its new row — no re-selection.
    fireEvent.click(container.querySelector('[aria-label="Subir regra"]')!);
    expect(firstCellText()).toBe(before);

    // Annotation column commits through the same command path.
    const annotation = container.querySelectorAll('td.btv-dmn-annotation')[0]!;
    fireEvent.doubleClick(annotation);
    const input = annotation.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'nota' } });
    fireEvent.blur(input);
    expect(container.querySelectorAll('td.btv-dmn-annotation')[0]?.textContent).toBe('nota');
  });

  it('edits typeRef/expression and removes a column via the header popover', () => {
    const { container, getByText } = mount(linkedDiagram());
    fireEvent.click(container.querySelector('th[data-header="input:0"] button')!);
    const popover = container.querySelector('.btv-dmn-header-popover')!;
    const inputs = popover.querySelectorAll('input');
    fireEvent.change(inputs[1], { target: { value: 'integer' } });
    fireEvent.blur(inputs[1]);
    fireEvent.change(inputs[2], { target: { value: 'renda * 12' } });
    fireEvent.blur(inputs[2]);
    fireEvent.click(getByText('Fechar'));
    expect(container.querySelector('.btv-dmn-header-popover')).toBeNull();

    // Remove the first input column: cells shrink by one.
    fireEvent.click(container.querySelector('th[data-header="input:0"] button')!);
    fireEvent.click(getByText('Remover coluna'));
    expect(container.querySelectorAll('thead th[data-header^="input:"]')).toHaveLength(1);

    // Guard: a single remaining output column cannot be removed.
    fireEvent.click(container.querySelector('th[data-header="output:0"] button')!);
    fireEvent.click(getByText('Remover coluna'));
    expect(container.querySelectorAll('thead th[data-header^="output:"]')).toHaveLength(1);
  });

  it('renders the empty state and the Promover… hook', () => {
    const diagram = linkedDiagram();
    delete (diagram.nodes.risk.properties as Record<string, unknown>).decisionTable;
    const { container } = mount(diagram);
    expect(container.querySelector('.btv-dmn-editor-empty')?.textContent).toContain(
      'Nenhuma tabela',
    );
    cleanup();

    const onPromote = vi.fn();
    const { getByText } = mount(linkedDiagram(), { onPromote });
    fireEvent.click(getByText('Promover…'));
    expect(onPromote).toHaveBeenCalledTimes(1);
  });
});

describe('DecisionPeek — resolver do host e footer (§4.3)', () => {
  it('uses resolveDecision and opens the surface from the footer', () => {
    const onOpen = vi.fn();
    const { container, getByText } = render(
      <BpmnDesigner diagram={linkedDiagram()} plugins={[dmnPlugin]}>
        <DecisionPeek
          resolveDecision={(ref) => ({
            ref,
            label: 'Do registry',
            semanticVersion: '2.0.0',
            status: 'active',
            table: TABLE,
          })}
          onOpen={onOpen}
        />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    const peek = container.querySelector('[data-decision-peek="risk"]')!;
    expect(peek.textContent).toContain('Do registry');
    expect(peek.textContent).toContain('v2.0.0');
    expect(peek.textContent).toContain('ATIVA'); // shows the version seal (§10.4)
    fireEvent.click(getByText('editar tabela →'));
    expect(onOpen).toHaveBeenCalledWith('risk');
  });

  it('renders the no-table message when the ref cannot be resolved to a table', () => {
    const diagram = linkedDiagram();
    delete (diagram.nodes.risk.properties as Record<string, unknown>).decisionTable;
    const { container } = render(
      <BpmnDesigner diagram={diagram} plugins={[dmnPlugin]}>
        <DecisionPeek />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    expect(container.querySelector('[data-decision-peek]')?.textContent).toContain(
      'sem tabela resolvida',
    );
  });
});

describe('decisionInspectorSection — ações do host (abrir → / diff)', () => {
  it('wires onOpen and onDiff to the linked card actions', () => {
    const onOpen = vi.fn();
    const onDiff = vi.fn();
    const section = decisionInspectorSection({ onOpen, onDiff });
    const { container, getByText } = render(
      <BpmnDesigner
        diagram={linkedDiagram()}
        plugins={[{ ...dmnPlugin, inspectorSections: [section] }]}
      >
        <PropertiesPanel />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="score"]')!, { button: 0 });
    fireEvent.click(getByText('abrir →'));
    expect(onOpen).toHaveBeenCalledWith('risk');
    fireEvent.click(getByText('diff'));
    expect(onDiff).toHaveBeenCalledWith('risk');
  });
});
