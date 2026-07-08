import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AuditLedger,
  createDiagram,
  createNode,
  type BpmnDiagram,
  type UserContext,
} from '@bpmn-react/core';
import type { BpmnPlugin, PromotionPanelProps } from '../src/index.js';
import { BpmnDesigner, PromotionPanel } from '../src/index.js';

const owner: UserContext = { id: 'u-owner', role: 'owner' };
const compliance: UserContext = { id: 'u-comp', role: 'compliance' };
const ops: UserContext = { id: 'u-ops', role: 'operations' };

function candidateDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Promo flow' });
  diagram.nodes = { t1: createNode({ type: 'task', id: 't1', label: 'Work', x: 40, y: 40 }) };
  diagram.version.status = 'candidate';
  diagram.version.semanticVersion = '2.1.0';
  diagram.version.changeSummary = 'A change summary long enough for promotion.';
  return diagram;
}

function renderPanel(
  diagram: BpmnDiagram,
  props: Partial<PromotionPanelProps> = {},
  plugins?: BpmnPlugin[],
) {
  const baseline = structuredClone(diagram);
  return render(
    <BpmnDesigner diagram={diagram} plugins={plugins}>
      <PromotionPanel
        open
        onClose={() => {}}
        actor={owner}
        approvers={[
          { actor: owner, label: 'Owner' },
          { actor: compliance, label: 'Compliance' },
        ]}
        baseline={baseline}
        {...props}
      />
    </BpmnDesigner>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PromotionPanel — gates reflect the core state machine', () => {
  it('renders the engine quorum, blocks activation, and unblocks after distinct-role approvals', async () => {
    renderPanel(candidateDiagram());
    const dialog = await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(dialog).toHaveTextContent('(0/2)'));
    const activate = screen.getByRole('button', { name: 'Ativar v2.1.0' });
    expect(activate).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar como Owner' }));
    await waitFor(() => expect(dialog).toHaveTextContent('(1/2)'));
    expect(screen.getByRole('button', { name: '✓ Owner aprovou' })).toBeDisabled();
    expect(activate).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar como Compliance' }));
    await waitFor(() => expect(dialog).toHaveTextContent('(2/2)'));
    await waitFor(() => expect(activate).toBeEnabled());
  });

  it('derives the quorum from a plugin lifecycleConfig (never hardcoded)', async () => {
    renderPanel(candidateDiagram(), {}, [
      { id: 'test/quorum', lifecycleConfig: { minApprovalRoles: 3 } },
    ]);
    const dialog = await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(dialog).toHaveTextContent('(0/3)'));
  });

  it("surfaces the core's change-summary gate message verbatim", async () => {
    const diagram = candidateDiagram();
    diagram.version.changeSummary = 'curto';
    renderPanel(diagram);
    const dialog = await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    await waitFor(() =>
      expect(dialog).toHaveTextContent(
        'Promotion to active requires a change summary of at least 20 characters',
      ),
    );
  });

  it('reports an unreachable target through the transition gate (custom matrix)', async () => {
    renderPanel(candidateDiagram(), {}, [
      {
        id: 'test/no-active',
        lifecycleConfig: {
          transitions: {
            draft: ['test'],
            test: ['candidate'],
            candidate: ['test'],
            active: [],
            deprecated: [],
            retired: [],
          },
        },
      },
    ]);
    const dialog = await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(dialog).toHaveTextContent('Invalid transition: candidate → active'));
  });

  it('activates through promote(), writes the ledger, toasts the hash, and auto-dismisses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const ledger = new AuditLedger();
    const onActivated = vi.fn();
    const onClose = vi.fn();
    let diagram = candidateDiagram();
    // Quorum met up front: the panel opens ready to activate.
    diagram = { ...diagram, version: { ...diagram.version, approvedBy: [
      { userId: owner.id, role: owner.role, approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
      { userId: ops.id, role: ops.role, approvedAt: '2026-07-07T11:00:00Z', reason: 'ok' },
    ] } };
    renderPanel(diagram, {
      ledger,
      onActivated,
      onClose,
      previousActive: { semanticVersion: '2.0.0', runsPinned: 3 },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    // Side effects are announced before activation.
    expect(dialog).toHaveTextContent('v2.0.0 passa a Descontinuada');
    expect(dialog).toHaveTextContent('3 execuções em andamento permanecem presas à v2.0.0');

    const activate = screen.getByRole('button', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(activate).toBeEnabled());
    fireEvent.click(activate);

    const toast = await screen.findByText(/ledger #[0-9a-f]{7} gravado/);
    expect(toast).toHaveTextContent('v2.1.0 ativa · v2.0.0 → descontinuada');
    expect(onActivated).toHaveBeenCalledTimes(1);
    const result = onActivated.mock.calls[0][0];
    expect(result.diagram.version.status).toBe('active');
    expect(result.ledgerEntry.type).toBe('VERSION_ACTIVATED');
    expect(onClose).toHaveBeenCalled();

    // Auto-dismiss after 6s.
    vi.advanceTimersByTime(6100);
    await waitFor(() => expect(screen.queryByText(/ledger #/)).toBeNull());
  });
});
