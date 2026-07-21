import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { BpmnPlugin } from '../src/index.js';
import { BpmnDesigner, KEYBOARD_SHORTCUT_CATALOG, PT_BR } from '../src/index.js';

/**
 * Handoff 15 §2f — Ctrl/Cmd+K palette: NO list of its own (both-directions
 * sweep against the registries), when() against the REAL selection context,
 * execução sempre via execute, Esc na pilha única, roles listbox/option; the
 * "?" cheatsheet is generated from the same aggregate + the declared shortcut
 * catalog (anti-drift sweep over the handler source); empty state teaches and
 * loads a GOVERNED example, disappearing at the first element.
 */
function baseDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Palette' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'Analisar pedido', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }),
  };
  diagram.edges = { e: createEdge({ id: 'e', sourceId: 'a', targetId: 'b' }) };
  return diagram;
}

const selectNode = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

const openPalette = () => fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

const renderedIds = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-cmdk-item]')].map((el) =>
    el.getAttribute('data-cmdk-item'),
  );

describe('CommandPalette (§2f)', () => {
  it('⌘K abre com role listbox/option; read-only permanece inerte', () => {
    const editable = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    openPalette();
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    const listbox = screen.getByRole('listbox');
    expect(listbox.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    editable.unmount();

    render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} readOnly />);
    openPalette();
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('varredura nas DUAS direções: linhas renderizadas ≡ agregado dos registros', () => {
    const plugin: BpmnPlugin = {
      id: 'demo',
      contextMenuItems: () => [
        { id: 'menu-item', label: 'Ação de menu', run: vi.fn() },
        { id: 'never', label: 'Nunca', when: () => false, run: vi.fn() },
      ],
      contextPadItems: () => [
        { id: 'pad-item', label: 'Ação de pad', glyph: '⚡', run: vi.fn() },
        // Same id in menu AND pad → dedupes to the menu entry.
        { id: 'menu-item', label: 'Duplicada', glyph: 'x', run: vi.fn() },
      ],
    };
    const { container } = render(
      <BpmnDesigner diagram={baseDiagram()} messages={PT_BR} plugins={[plugin]} />,
    );
    selectNode(container, 'a');
    openPalette();
    const ids = renderedIds(container);
    // Direção 1 — nada além dos registros: seleção (built-ins do menu),
    // plugins (menu + pad, when() respeitado, dedupe por id) e globais.
    const expected = [
      'node.edit-label',
      'node.copy',
      'node.duplicate',
      'node.delete',
      'demo/menu-item',
      'demo/pad-item',
      'global.undo', // absent: nothing to undo yet
      'global.redo', // absent: nothing to redo
      'global.zoom-in',
      'global.zoom-out',
      'global.fit',
      'global.snap-toggle',
      'global.arrange',
      'global.select-all',
      'global.find',
      'global.cheatsheet',
      'global.export-xml',
      'global.export-json',
      'global.export-svg',
      'global.export-png',
      // #154: a lane (composta — snap+tiling ao corpo do pool) entra também.
      'palette.insert.lane',
      // Handoff 17 ES-2 (reforço 8): itens COMPOSTOS da paleta entram pelo
      // registro paletteInsertCommands — mesma fábrica do clique da paleta.
      'palette.insert.eventSubprocess',
      // Handoff 18 §5b: o boundary de escalação (composto) também entra.
      'palette.insert.escalationBoundary',
      // Handoff 19 §6b: o par de compensação (composto) também entra.
      'palette.insert.compensationPair',
    ].filter((id) => id !== 'global.undo' && id !== 'global.redo');
    // Direção 2 — tudo dos registros presente, mesma ordem de agregação.
    expect(ids).toEqual(expected);
    expect(ids).not.toContain('demo/never');
  });

  it('zero comando hardcoded fora dos registros (varredura do fonte)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '../src/ui/CommandPalette.tsx'), 'utf8');
    // The palette never defines an entry: no string-literal ids and no
    // label/run fields of its own — rows come only from the imported builders.
    expect(source).not.toMatch(/\bid:\s*'/);
    expect(source).not.toMatch(/\blabel:\s*t\(/);
    expect(source).not.toMatch(/\brun:\s*\(\)/);
  });

  it('when() usa o contexto REAL: item só-de-nó some sem seleção de nó', () => {
    const plugin: BpmnPlugin = {
      id: 'demo',
      contextMenuItems: () => [
        { id: 'nodes-only', label: 'Só nós', when: (t) => t.kind === 'node', run: vi.fn() },
      ],
    };
    const { container } = render(
      <BpmnDesigner diagram={baseDiagram()} messages={PT_BR} plugins={[plugin]} />,
    );
    openPalette();
    expect(renderedIds(container)).not.toContain('demo/nodes-only');
    fireEvent.keyDown(window, { key: 'Escape' });
    selectNode(container, 'a');
    openPalette();
    expect(renderedIds(container)).toContain('demo/nodes-only');
  });

  it('fuzzy + Enter executa VIA COMANDO (undoable), fecha a palette', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={baseDiagram()} messages={PT_BR} onChange={onChange} />,
    );
    selectNode(container, 'a');
    openPalette();
    const input = screen.getByLabelText('Buscar comandos');
    fireEvent.change(input, { target: { value: 'duplic' } });
    const ids = renderedIds(container);
    expect(ids[0]).toBe('node.duplicate');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(Object.keys(latest.nodes)).toHaveLength(3); // duplicated via command
    expect(screen.queryByTestId('command-palette')).toBeNull();
    // Undo desfaz — prova de que passou pelo command stack.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(Object.keys((onChange.mock.lastCall![0] as BpmnDiagram).nodes)).toHaveLength(2);
  });

  it('Esc fecha a palette pela pilha única ANTES de limpar a seleção', () => {
    const { container } = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    selectNode(container, 'a');
    openPalette();
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('command-palette')).toBeNull();
    // Seleção sobreviveu — só a superfície do topo saiu.
    expect(container.querySelector('[data-node-id="a"][data-selected]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-node-id="a"][data-selected]')).toBeNull();
  });
});

describe('Cheatsheet "?" (§2f) — anti-drift por construção', () => {
  it('"?" abre; atalhos = catálogo declarado; comandos = o MESMO agregado da palette', () => {
    const { container } = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    fireEvent.keyDown(window, { key: '?' });
    const sheet = screen.getByTestId('cheatsheet');
    expect(sheet).toBeInTheDocument();
    const shortcutIds = [...sheet.querySelectorAll('[data-shortcut]')].map((el) =>
      el.getAttribute('data-shortcut'),
    );
    expect(shortcutIds).toEqual(KEYBOARD_SHORTCUT_CATALOG.map((entry) => entry.id));
    // A coluna de comandos é o agregado da palette (canvas target aqui).
    const commandIds = [...sheet.querySelectorAll('[data-command]')].map((el) =>
      el.getAttribute('data-command'),
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    openPalette();
    expect(renderedIds(container)).toEqual(commandIds);
  });

  it('varredura anti-drift: toda tecla tratada no handler está declarada no catálogo', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '../src/gestures/useKeyboardShortcuts.ts'), 'utf8');
    const body = source.slice(source.indexOf('export function useKeyboardShortcuts'));
    const literals = new Set<string>();
    for (const match of body.matchAll(/event\.key === '([^']+)'/g)) literals.add(match[1]);
    for (const match of body.matchAll(/event\.key\.toLowerCase\(\) === '([^']+)'/g))
      literals.add(match[1]);
    for (const match of body.matchAll(/\b(Arrow(?:Up|Down|Left|Right))\b/g)) literals.add(match[1]);
    expect(literals.size).toBeGreaterThan(10);
    const declared = new Set(KEYBOARD_SHORTCUT_CATALOG.flatMap((entry) => [...entry.matches]));
    const undeclaredKeys = [...literals].filter((key) => !declared.has(key));
    expect(undeclaredKeys).toEqual([]);
  });

  it('cheatsheet fecha pela pilha única', () => {
    render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('cheatsheet')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('cheatsheet')).toBeNull();
  });
});

describe('Estado vazio (§2f)', () => {
  it('aparece vazio, some ao primeiro elemento (exemplo governado) e volta ao esvaziar', () => {
    const empty = createDiagram({ name: 'Vazio' });
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={empty} messages={PT_BR} onChange={onChange} />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\/⌘\+K/)).toBeInTheDocument(); // ensina a palette
    // 1 clique → diagrama GOVERNADO: versão/status reais, não um sample solto.
    fireEvent.click(screen.getByTestId('empty-state-example'));
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect(container.querySelectorAll('[data-node-id]').length).toBe(3);
    const badge = container.querySelector('.bpmnr-status-badge');
    expect(badge?.getAttribute('data-status') ?? 'draft').toBe('draft');
    // Esvaziar de novo (⌘A + Delete) → o estado vazio VOLTA.
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('read-only nunca mostra o estado vazio (não há o que ensinar a editar)', () => {
    render(<BpmnDesigner diagram={createDiagram({ name: 'Vazio' })} messages={PT_BR} readOnly />);
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });
});
