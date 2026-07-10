import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, BpmnViewer, CLOSED_HATCH_PATTERN_ID, PT_BR } from '../src/index.js';

/** Sample with two closed nodes (one closed in the loaded version). */
function snapshotDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Snapshot' });
  const v = diagram.version.id;
  diagram.nodes = {
    alive: createNode({ type: 'task', id: 'alive', label: 'Alive', x: 60, y: 40 }),
    gone: createNode({ type: 'task', id: 'gone', label: 'Gone', x: 60, y: 180 }),
    old: createNode({ type: 'userTask', id: 'old', label: 'Old', x: 300, y: 180 }),
  };
  diagram.nodes.gone = { ...diagram.nodes.gone, removedInVersion: v };
  diagram.nodes.old = { ...diagram.nodes.old, removedInVersion: 'ver_hist0abc123' };
  return diagram;
}

describe('elemento fechado — variante 5b mitigada (Handoff 5 §5)', () => {
  it('closed nodes carry the desaturating wash + the SHARED 45° hatch (1 def, N uses)', () => {
    const { container } = render(<BpmnDesigner diagram={snapshotDiagram()} />);
    // One pattern definition per SVG…
    expect(container.querySelectorAll(`pattern#${CLOSED_HATCH_PATTERN_ID}`)).toHaveLength(1);
    // …used by every closed node, never by open ones.
    const hatches = container.querySelectorAll('[data-node-closed-hatch]');
    expect(hatches).toHaveLength(2);
    expect(container.querySelector('[data-node-id="alive"] [data-node-closed-hatch]')).toBeNull();
    expect(
      container.querySelector(`[data-node-id="gone"] rect[fill="url(#${CLOSED_HATCH_PATTERN_ID})"]`),
    ).toBeInTheDocument();
    // Desaturation: paper wash + reduced group opacity, not color alone.
    const gone = container.querySelector('[data-node-id="gone"]')!;
    expect(gone.getAttribute('data-node-closed')).toBe('true');
    expect(gone.getAttribute('opacity')).toBe('0.75');
  });

  it('renders the FECHADO seal ONLY on hover/selection (aceite 10.5.6)', () => {
    const { container } = render(<BpmnDesigner diagram={snapshotDiagram()} />);
    expect(container.querySelector('[data-closed-seal]')).toBeNull();

    // Selection shows it — with the semver when closed in the loaded version.
    fireEvent.pointerDown(container.querySelector('[data-node-id="gone"]')!, { button: 0 });
    const seal = container.querySelector('[data-node-id="gone"] [data-closed-seal]')!;
    expect(seal).toBeInTheDocument();
    expect(seal.textContent).toBe('FECHADO v0.1.0');
    fireEvent.keyDown(window, { key: 'Escape' }); // clear selection
    expect(container.querySelector('[data-closed-seal]')).toBeNull();

    // Hover shows it; leaving hides it again.
    fireEvent.pointerEnter(container.querySelector('[data-node-id="gone"]')!);
    expect(container.querySelector('[data-closed-seal]')).toBeInTheDocument();
    fireEvent.pointerLeave(container.querySelector('[data-node-id="gone"]')!);
    expect(container.querySelector('[data-closed-seal]')).toBeNull();

    // Open nodes never grow a seal, hovered or selected.
    fireEvent.pointerEnter(container.querySelector('[data-node-id="alive"]')!);
    fireEvent.pointerDown(container.querySelector('[data-node-id="alive"]')!, { button: 0 });
    expect(container.querySelector('[data-closed-seal]')).toBeNull();
  });

  it('falls back to the closing version id when it is not the loaded version', () => {
    const { container } = render(<BpmnDesigner diagram={snapshotDiagram()} />);
    fireEvent.pointerEnter(container.querySelector('[data-node-id="old"]')!);
    expect(container.querySelector('[data-closed-seal]')?.textContent).toBe('FECHADO #ver_his');
  });
});

describe('banner de versão (aceite 10.5.6)', () => {
  it('does not render on an editable draft', () => {
    const { container } = render(<BpmnDesigner diagram={snapshotDiagram()} />);
    expect(container.querySelector('[data-version-banner]')).toBeNull();
  });

  it('renders in read-only views with version, lock and closed count', () => {
    const { container } = render(<BpmnViewer diagram={snapshotDiagram()} messages={PT_BR} />);
    const banner = container.querySelector('[data-version-banner]')!;
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('VISUALIZANDO v0.1.0');
    expect(banner.textContent).toContain('somente leitura');
    expect(banner.textContent).toContain('2 elementos fechados nesta versão');
  });

  it('renders for superseded versions even in the editor, with singular grammar', () => {
    const diagram = snapshotDiagram();
    diagram.version = { ...diagram.version, status: 'deprecated', semanticVersion: '0.2.0' };
    delete diagram.nodes.old;
    const { container } = render(<BpmnDesigner diagram={diagram} messages={PT_BR} />);
    const banner = container.querySelector('[data-version-banner]')!;
    expect(banner.getAttribute('data-version-banner')).toBe('deprecated');
    expect(banner.textContent).toContain('VISUALIZANDO v0.2.0');
    expect(banner.textContent).toContain('1 elemento fechado nesta versão');
  });

  it('omits the closed clause when the version closes nothing', () => {
    const diagram = snapshotDiagram();
    diagram.nodes = { alive: diagram.nodes.alive };
    const { container } = render(<BpmnViewer diagram={diagram} />);
    expect(container.querySelector('[data-version-banner]')?.textContent).not.toContain(
      'fechado',
    );
  });
});
