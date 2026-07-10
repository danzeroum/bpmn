import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AuditLedger,
  createDiagram,
  createNode,
  type BpmnDiagram,
  type UserContext,
} from '@buildtovalue/core';
import {
  buildApprovalPayload,
  signApproval,
  type SignedApproval,
  type Signer,
} from '@buildtovalue/identity';
import type { BpmnPlugin, PromotionPanelProps } from '../src/index.js';
import { BpmnDesigner, PromotionPanel } from '../src/index.js';

/** A host-style Signer with a keypair generated in the TEST (never in the lib). */
async function makeSigner(subject: string, role: string) {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const signer: Signer = {
    identity: { subject, role, publicKeyFingerprint: `ed25519:${subject}` },
    sign: async (payload) =>
      new Uint8Array(await crypto.subtle.sign('Ed25519', pair.privateKey, new Uint8Array(payload))),
  };
  return { signer, publicKey };
}

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

  it('collects the changelog in a textarea and re-evaluates the gate on commit', async () => {
    const diagram = candidateDiagram();
    diagram.version.changeSummary = 'curto';
    renderPanel(diagram);
    const dialog = await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(dialog).toHaveTextContent('change summary of at least 20'));

    const textarea = screen.getByLabelText('change_summary');
    fireEvent.change(textarea, {
      target: { value: 'Uma descrição de mudança suficientemente longa.' },
    });
    fireEvent.blur(textarea);

    await waitFor(() =>
      expect(dialog).not.toHaveTextContent('change summary of at least 20'),
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
    const onEditorEvent = vi.fn();
    let diagram = candidateDiagram();
    // Quorum met up front: the panel opens ready to activate.
    diagram = { ...diagram, version: { ...diagram.version, approvedBy: [
      { userId: owner.id, role: owner.role, approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
      { userId: ops.id, role: ops.role, approvedAt: '2026-07-07T11:00:00Z', reason: 'ok' },
    ] } };
    renderPanel(
      diagram,
      {
        ledger,
        onActivated,
        onClose,
        previousActive: { semanticVersion: '2.0.0', runsPinned: 3 },
      },
      [{ id: 'obs/capture', onEditorEvent }],
    );

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
    // Observability: the promotion emits a completed event with the hash.
    expect(onEditorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'promotion.completed',
        meta: expect.objectContaining({ semanticVersion: '2.1.0', status: 'active' }),
      }),
    );

    // Auto-dismiss after 6s.
    vi.advanceTimersByTime(6100);
    await waitFor(() => expect(screen.queryByText(/ledger #/)).toBeNull());
  });
});

describe('PromotionPanel — optional coverage card (Handoff 7A-3, OFF by default)', () => {
  it('shows no coverage card unless the coverage prop is provided', async () => {
    const { container } = renderPanel(candidateDiagram());
    await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    expect(container.querySelector('[data-sim-coverage-gate]')).toBeNull();
  });

  it('renders a below-threshold coverage card when the gate is enabled', async () => {
    const { container } = renderPanel(candidateDiagram(), {
      coverage: { covered: 1, total: 3, minCoverage: 0.8 },
    });
    await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    const card = container.querySelector('[data-sim-coverage-gate]');
    expect(card).toBeTruthy();
    expect(card).toHaveTextContent('Cobertura de caminhos · 1/3 · mín 80%');
    expect(card).toHaveTextContent('33% exercitado');
    expect(card?.getAttribute('data-satisfied')).toBe('false');
  });

  it('marks the coverage card satisfied at/above the threshold', async () => {
    const { container } = renderPanel(candidateDiagram(), {
      coverage: { covered: 3, total: 3, minCoverage: 0.8 },
    });
    await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    expect(container.querySelector('[data-sim-coverage-gate]')?.getAttribute('data-satisfied')).toBe(
      'true',
    );
  });
});

describe('PromotionPanel — identity signing (Handoff 8 I-2)', () => {
  it('shows the canonical payload before signing, then signs and shows the verified badge', async () => {
    const { signer, publicKey } = await makeSigner('marta@x', 'owner');
    const onApprovalSigned = vi.fn();
    renderPanel(candidateDiagram(), {
      signerFor: (a) => (a.actor.id === owner.id ? signer : undefined),
      resolvePublicKey: () => publicKey,
      onApprovalSigned,
    });
    await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });

    // Payload canônico visível ANTES de assinar (§4).
    const payloadCard = await screen.findByTestId('canonical-payload');
    expect(payloadCard).toHaveTextContent('O QUE VOCÊ ESTÁ ASSINANDO');
    const signBtn = await screen.findByRole('button', {
      name: '🔏 Assinar aprovação como Owner',
    });

    fireEvent.click(signBtn);

    await waitFor(() => expect(onApprovalSigned).toHaveBeenCalledTimes(1));
    const signed: SignedApproval = onApprovalSigned.mock.calls[0][0];
    expect(signed.payload.role).toBe('owner');
    expect(signed.signer.subject).toBe('marta@x');
    // The verified badge replaces the button.
    await waitFor(() => expect(screen.getByText('ASSINADA · VERIFICADA')).toBeInTheDocument());
  });

  it('renders an invalid badge for a recorded signature that no longer verifies', async () => {
    const { signer, publicKey } = await makeSigner('marta@x', 'compliance');
    const payload = buildApprovalPayload({
      diagramId: 'x',
      version: '2.1.0',
      xmlHash: 'h',
      ledgerHead: '',
      decision: 'approve',
      role: 'compliance',
    });
    const signed = await signApproval(signer, payload, '2026-07-09T00:00:00.000Z');
    // Tamper the payload after signing → verification must fail.
    const tampered: SignedApproval = {
      ...signed,
      payload: { ...signed.payload, xmlHash: 'tampered' },
    };
    let diagram = candidateDiagram();
    diagram = {
      ...diagram,
      version: {
        ...diagram.version,
        approvedBy: [
          { userId: compliance.id, role: 'compliance', approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
        ],
      },
    };
    renderPanel(diagram, { signedApprovals: [tampered], resolvePublicKey: () => publicKey });
    await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(screen.getByText('ASSINATURA INVÁLIDA')).toBeInTheDocument());
  });

  it('without identity props, keeps the plain approve button and shows no signature badge', async () => {
    let diagram = candidateDiagram();
    diagram = {
      ...diagram,
      version: {
        ...diagram.version,
        approvedBy: [
          { userId: owner.id, role: 'owner', approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
        ],
      },
    };
    const { container } = renderPanel(diagram);
    await screen.findByRole('dialog', { name: 'Ativar v2.1.0' });
    expect(screen.getByRole('button', { name: '✓ Owner aprovou' })).toBeDisabled();
    expect(container.querySelector('.bpmnr-signature-badge')).toBeNull();
  });
});
