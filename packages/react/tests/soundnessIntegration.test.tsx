import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
  type ValidationRule,
} from '@buildtovalue/core';
import { BpmnDesigner, PromotionPanel, Toolbar, PT_BR } from '../src/index.js';

/**
 * Handoff 4 §C2 — the react side of soundness: the PromotionPanel "Soundness"
 * section and the node issue badges. The tests stub SND_* issues through a
 * plain validation rule (the plugin contract) so this package never depends
 * on @buildtovalue/soundness.
 */
function diagramWithJoin(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Trap' });
  diagram.nodes = {
    start: createNode({ type: 'startEvent', id: 'start', label: 'Go', x: 20, y: 20 }),
    join: createNode({ type: 'parallelGateway', id: 'join', label: 'Sync', x: 200, y: 20 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'join' }),
  };
  diagram.version.status = 'candidate';
  diagram.version.changeSummary = 'A perfectly descriptive change summary.';
  return diagram;
}

const sndError: ValidationRule = () => [
  {
    code: 'SND_DEADLOCK_JOIN',
    severity: 'error',
    message: 'AND-join never synchronizes',
    nodeId: 'join',
  },
];

const actor = { id: 'u0', name: 'Rita', role: 'Owner' };

function renderPanel(plugins: { id: string; validationRules?: ValidationRule[] }[]) {
  return render(
    <BpmnDesigner diagram={diagramWithJoin()} plugins={plugins} messages={PT_BR}>
      <PromotionPanel
        open
        onClose={() => {}}
        approvers={[]}
        actor={actor}
        baseline={diagramWithJoin()}
      />
    </BpmnDesigner>,
  );
}

describe('PromotionPanel — Soundness section', () => {
  it('shows a green section when no SND_* errors are reported', () => {
    renderPanel([]);
    const section = document.querySelector('.bpmnr-promotion-soundness')!;
    expect(section).toHaveAttribute('data-satisfied', 'true');
    expect(section.textContent).toContain('Soundness · 0 erros');
    expect(screen.queryByRole('button', { name: 'ver no canvas' })).toBeNull();
  });

  it('turns red with the codes and badges the canvas via "ver no canvas"', () => {
    const { container } = renderPanel([{ id: 'snd', validationRules: [sndError] }]);
    const section = document.querySelector('.bpmnr-promotion-soundness')!;
    expect(section).toHaveAttribute('data-satisfied', 'false');
    expect(section.textContent).toContain('Soundness · 1 erro');
    expect(section.textContent).toContain('SND_DEADLOCK_JOIN');

    fireEvent.click(screen.getByRole('button', { name: 'ver no canvas' }));
    const badge = container.querySelector('[data-node-id="join"] [data-node-issue="error"]');
    expect(badge).toBeInTheDocument();
    // The offending node is also selected for orientation.
    expect(container.querySelector('[data-node-id="join"][data-selected]')).toBeInTheDocument();
  });
});

describe('Toolbar — validation badges (shape-state pendência §5)', () => {
  it('marks offending nodes on Validate and clears them on close', () => {
    const { container } = render(
      <BpmnDesigner
        diagram={diagramWithJoin()}
        plugins={[{ id: 'snd', validationRules: [sndError] }]}
      >
        <Toolbar />
      </BpmnDesigner>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Validate diagram' }));
    expect(container.querySelector('[data-node-id="join"] [data-node-issue="error"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close validation' }));
    expect(container.querySelector('[data-node-issue]')).toBeNull();
  });
});
