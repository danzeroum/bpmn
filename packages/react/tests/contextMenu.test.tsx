import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  nodeParentId,
  updateNodeCommand,
  type BpmnDiagram,
} from '@buildtovalue/core';
import type { BpmnPlugin } from '../src/index.js';
import { BpmnDesigner, PT_BR } from '../src/index.js';

/**
 * Handoff 11 N-5 — pluggable context menu: conditional built-ins (edge
 * complete), plugin section via the {id, label, when, run} contract (actions
 * ONLY through commands), full keyboard operation (Shift+F10, arrows, Enter,
 * Esc through the single dismissal stack) and inline edge-label editing.
 */
function diagramWith(manual: boolean): BpmnDiagram {
  const diagram = createDiagram({ name: 'Menu' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }),
  };
  diagram.edges = {
    e: createEdge({
      id: 'e',
      sourceId: 'a',
      targetId: 'b',
      ...(manual
        ? {
            waypoints: [
              { x: 40, y: 30 },
              { x: 200, y: 30 },
              { x: 440, y: 30 },
            ],
            properties: { routeMode: 'manual' },
          }
        : {}),
    }),
  };
  return diagram;
}

function openEdgeMenu(container: HTMLElement) {
  const edge = container.querySelector('[data-edge-id="e"]')!;
  fireEvent.contextMenu(edge, { clientX: 200, clientY: 30 });
  return container.querySelector('[data-testid="context-menu"]');
}

describe('ContextMenu (N-5) — conditional built-ins', () => {
  it('a MANUAL edge offers "Voltar ao automático"; an auto edge does not (when condicional)', () => {
    const manual = render(<BpmnDesigner diagram={diagramWith(true)} messages={PT_BR} />);
    const menu = openEdgeMenu(manual.container)!;
    expect(menu.textContent).toContain('Voltar ao automático');
    expect(menu.textContent).toContain('Adicionar waypoint aqui');
    expect(menu.textContent).toContain('Editar rótulo');
    manual.unmount();

    const auto = render(<BpmnDesigner diagram={diagramWith(false)} messages={PT_BR} />);
    const autoMenu = openEdgeMenu(auto.container)!;
    expect(autoMenu.textContent).not.toContain('Voltar ao automático');
    expect(autoMenu.textContent).toContain('Adicionar waypoint aqui');
  });

  it('"Voltar ao automático" dispatches ONE command (undoable) — never direct mutation', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagramWith(true)} onChange={onChange} />);
    openEdgeMenu(container);
    expect(onChange).not.toHaveBeenCalled(); // opening the menu mutates NOTHING

    fireEvent.click(container.querySelector('[data-menu-item="edge.back-to-auto"]')!);
    expect(onChange).toHaveBeenCalledTimes(1);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.edges.e.properties.routeMode).not.toBe('manual');
    // Menu closed after running.
    expect(container.querySelector('[data-testid="context-menu"]')).toBeNull();
  });

  it('"Adicionar waypoint aqui" inserts the world point and turns the edge manual (one command)', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagramWith(false)} onChange={onChange} />);
    openEdgeMenu(container);
    fireEvent.click(container.querySelector('[data-menu-item="edge.add-waypoint"]')!);

    expect(onChange).toHaveBeenCalledTimes(1);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.edges.e.properties.routeMode).toBe('manual');
    expect(latest.edges.e.waypoints?.some((p) => p.x === 200 && p.y === 30)).toBe(true);
  });

  it('"Editar rótulo" (edge) opens the inline editor; Enter commits via command', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagramWith(true)} onChange={onChange} />);
    openEdgeMenu(container);
    fireEvent.click(container.querySelector('[data-menu-item="edge.edit-label"]')!);

    const input = container.querySelector('[data-edge-label-editor="e"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'sim' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.lastCall![0] as BpmnDiagram).edges.e.label).toBe('sim');
  });
});

describe('ContextMenu (N-5) — plugin section contract', () => {
  const pluginWith = (whenResult: boolean, run = vi.fn()) => {
    const plugin: BpmnPlugin = {
      id: 'demo/extras',
      contextMenuItems: () => [
        { id: 'rename', label: 'Renomear via plugin', when: () => whenResult, run },
      ],
    };
    return { plugin, run };
  };

  it('when() decides presence: true → item under the plugin kicker; false → absent', () => {
    const yes = render(
      <BpmnDesigner diagram={diagramWith(false)} plugins={[pluginWith(true).plugin]} />,
    );
    const menu = openEdgeMenu(yes.container)!;
    expect(menu.textContent).toContain('demo/extras'); // section kicker
    expect(menu.textContent).toContain('Renomear via plugin');
    yes.unmount();

    const no = render(
      <BpmnDesigner diagram={diagramWith(false)} plugins={[pluginWith(false).plugin]} />,
    );
    const noMenu = openEdgeMenu(no.container)!;
    expect(noMenu.textContent).not.toContain('Renomear via plugin');
    expect(noMenu.textContent).not.toContain('demo/extras');
  });

  it('run() receives ONLY the command dispatcher and the change flows through the bus', () => {
    const plugin: BpmnPlugin = {
      id: 'demo/extras',
      contextMenuItems: () => [
        {
          id: 'rename',
          label: 'Renomear via plugin',
          when: (t) => t.kind === 'node',
          run: (t, api) => {
            // The narrow API is the whole surface: {execute} and nothing else.
            expect(Object.keys(api)).toEqual(['execute']);
            api.execute(updateNodeCommand(t.id!, { label: 'Via menu' }));
          },
        },
      ],
    };
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={diagramWith(false)} plugins={[plugin]} onChange={onChange} />,
    );
    const node = container.querySelector('[data-node-id="a"]')!;
    fireEvent.contextMenu(node, { clientX: 60, clientY: 30 });
    fireEvent.click(container.querySelector('[data-menu-item="demo/extras/rename"]')!);

    expect(onChange).toHaveBeenCalledTimes(1); // exactly one command, zero direct mutation
    expect((onChange.mock.lastCall![0] as BpmnDiagram).nodes.a.label).toBe('Via menu');
  });
});

describe('ContextMenu (N-5) — sub-process reparent built-ins (F7)', () => {
  // Expanded sub-process 'sub' (100..500 × 100..400) with one child; a node
  // overlapping it but not yet a child; a node fully outside.
  function reparentDiagram(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Reparent menu' });
    diagram.nodes = {
      sub: createNode({
        type: 'subProcess', id: 'sub', label: 'Fulfil',
        x: 100, y: 100, width: 400, height: 300, properties: { isExpanded: true },
      }),
      inside: createNode({ type: 'task', id: 'inside', label: 'Over', x: 200, y: 200 }),
      child: createNode({
        type: 'task', id: 'child', label: 'Kid', x: 200, y: 300, properties: { parentId: 'sub' },
      }),
      outside: createNode({ type: 'task', id: 'outside', label: 'Far', x: 700, y: 200 }),
    };
    return diagram;
  }

  function openNodeMenu(container: HTMLElement, id: string) {
    fireEvent.contextMenu(container.querySelector(`[data-node-id="${id}"]`)!, {
      clientX: 0, clientY: 0,
    });
    return container.querySelector('[data-testid="context-menu"]')!;
  }

  it('offers "move into" only when a non-child node overlaps an expanded sub-process', () => {
    const { container } = render(<BpmnDesigner diagram={reparentDiagram()} />);
    // Overlapping, not a child → move-into named after the container.
    const overMenu = openNodeMenu(container, 'inside');
    expect(overMenu.querySelector('[data-menu-item="node.move-into-subprocess"]')).not.toBeNull();
    expect(overMenu.textContent).toContain('Fulfil');
    expect(overMenu.querySelector('[data-menu-item="node.remove-from-subprocess"]')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });

    // Fully outside → neither reparent action, just edit-label.
    const outMenu = openNodeMenu(container, 'outside');
    expect(outMenu.querySelector('[data-menu-item="node.move-into-subprocess"]')).toBeNull();
    expect(outMenu.querySelector('[data-menu-item="node.remove-from-subprocess"]')).toBeNull();
  });

  it('offers "remove from" only when the node is a sub-process child (the inverse)', () => {
    const { container } = render(<BpmnDesigner diagram={reparentDiagram()} />);
    const menu = openNodeMenu(container, 'child');
    expect(menu.querySelector('[data-menu-item="node.remove-from-subprocess"]')).not.toBeNull();
    // A child already in its deepest container is not offered "move into".
    expect(menu.querySelector('[data-menu-item="node.move-into-subprocess"]')).toBeNull();
  });

  it('"move into" dispatches ONE command setting parentId; menu closes', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={reparentDiagram()} onChange={onChange} />);
    openNodeMenu(container, 'inside');
    expect(onChange).not.toHaveBeenCalled(); // opening mutates nothing
    fireEvent.click(container.querySelector('[data-menu-item="node.move-into-subprocess"]')!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(nodeParentId((onChange.mock.lastCall![0] as BpmnDiagram).nodes.inside)).toBe('sub');
    expect(container.querySelector('[data-testid="context-menu"]')).toBeNull();
  });

  it('"remove from" dispatches ONE command clearing parentId', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={reparentDiagram()} onChange={onChange} />);
    openNodeMenu(container, 'child');
    fireEvent.click(container.querySelector('[data-menu-item="node.remove-from-subprocess"]')!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(nodeParentId((onChange.mock.lastCall![0] as BpmnDiagram).nodes.child)).toBeUndefined();
  });

  it('is fully keyboard operable (a11y path for the inaccessible drag)', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={reparentDiagram()} onChange={onChange} />);
    // Select the overlapping node, open the menu via keyboard, run move-into.
    fireEvent.pointerDown(container.querySelector('[data-node-id="inside"]')!, {
      button: 0, clientX: 260, clientY: 230,
    });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, {
      button: 0, clientX: 260, clientY: 230,
    });
    fireEvent.keyDown(window, { key: 'F10', shiftKey: true });
    const menu = container.querySelector('[data-testid="context-menu"]')!;
    // Arrow down from edit-label to move-into, then Enter.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(nodeParentId((onChange.mock.lastCall![0] as BpmnDiagram).nodes.inside)).toBe('sub');
  });

  it('never reparents a swimlane container or a boundary event', () => {
    const diagram = reparentDiagram();
    diagram.nodes.pool = createNode({
      type: 'pool', id: 'pool', label: 'Pool', x: 120, y: 120, width: 200, height: 120,
    });
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const menu = openNodeMenu(container, 'pool');
    expect(menu.querySelector('[data-menu-item="node.move-into-subprocess"]')).toBeNull();
    expect(menu.querySelector('[data-menu-item="node.remove-from-subprocess"]')).toBeNull();
  });
});

describe('ContextMenu (N-5) — keyboard + Esc stack', () => {
  it('Shift+F10 opens for the selection; arrows move; Enter runs the active item', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagramWith(true)} onChange={onChange} />);
    // Select the edge, then open via keyboard.
    fireEvent.pointerDown(container.querySelector('[data-edge-id="e"]')!, {
      button: 0,
      clientX: 200,
      clientY: 30,
    });
    fireEvent.keyDown(window, { key: 'F10', shiftKey: true });
    const menu = container.querySelector('[data-testid="context-menu"]')!;
    expect(menu).not.toBeNull();

    // Arrow to the second item ("Adicionar waypoint aqui") and Enter.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect((onChange.mock.lastCall![0] as BpmnDiagram).edges.e.waypoints?.length).toBe(4);
  });

  it('Esc closes the MENU first (dismissal stack) — the selection survives', () => {
    const { container } = render(<BpmnDesigner diagram={diagramWith(true)} />);
    openEdgeMenu(container);
    expect(container.querySelector('[data-testid="context-menu"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-testid="context-menu"]')).toBeNull();
    // Selection is untouched — Esc only popped the top of the stack.
    expect(container.querySelector('[data-edge-id="e"]')?.getAttribute('data-selected')).toBe('true');

    // A second Esc now clears the selection (normal stack behavior).
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-edge-id="e"]')?.getAttribute('data-selected')).toBeNull();
  });
});
