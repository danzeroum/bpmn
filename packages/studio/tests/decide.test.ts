import { describe, expect, it } from 'vitest';
import { AuditLedger, LifecycleEngine, type UserContext } from '@buildtovalue/core';
import type { SignedApproval } from '@buildtovalue/identity';
import { REVIEW_CHANGES_REQUESTED_TYPE } from '@buildtovalue/adapters-bpmn';
import {
  APPROVAL_RECORDED,
  PROMOTION_REJECTED,
  approvePromotion,
  rejectPromotion,
  requestChanges,
} from '../src/index.js';
import { candidateDiagram } from './fixtures.js';

const actor: UserContext = { id: 'bruna', role: 'process-owner', name: 'Bruna' };

const signedApproval: SignedApproval = {
  payload: {
    diagramId: 'onboarding',
    version: '2.0.0',
    xmlHash: 'h',
    ledgerHead: '',
    decision: 'approve',
    role: 'process-owner',
  },
  signature: 'YmFzZTY0c2ln',
  signer: { subject: 'bruna@x', role: 'process-owner', publicKeyFingerprint: 'ed25519:fp' },
  signedAt: '2026-07-09T00:00:00.000Z',
};

describe('approvePromotion — aprovar ≠ ativar (§5/§11)', () => {
  it('records the approval on the diagram AND in the ledger, without activating', async () => {
    const engine = new LifecycleEngine();
    const ledger = new AuditLedger();
    const diagram = candidateDiagram();
    const result = await approvePromotion({ engine, ledger, diagram, actor });
    expect(result.kind).toBe('approved');
    expect(result.diagram.version.approvedBy).toHaveLength(1);
    expect(result.diagram.version.approvedBy[0]).toMatchObject({ userId: 'bruna', role: 'process-owner' });
    // approving NEVER activates — separação solicitante/aprovador
    expect(result.diagram.version.status).toBe('candidate');
    expect(result.ledgerEntry.type).toBe(APPROVAL_RECORDED);
    expect(result.ledgerEntry.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.ledgerEntry.details).toMatchObject({ role: 'process-owner', artifactId: 'onboarding' });
    // original diagram untouched (immutable copy)
    expect(diagram.version.approvedBy).toHaveLength(0);
  });

  it('persists an injected signature in the ledger entry details (Handoff 8 I-2)', async () => {
    const ledger = new AuditLedger();
    const result = await approvePromotion({
      engine: new LifecycleEngine(),
      ledger,
      diagram: candidateDiagram(),
      actor,
      signedApproval,
    });
    expect(result.ledgerEntry.details).toMatchObject({ signedApproval });
  });

  it('omits the signature key entirely when none is injected (legacy path)', async () => {
    const ledger = new AuditLedger();
    const result = await approvePromotion({
      engine: new LifecycleEngine(),
      ledger,
      diagram: candidateDiagram(),
      actor,
    });
    expect(result.ledgerEntry.details).not.toHaveProperty('signedApproval');
  });

  it('double approval is vetoed by the engine, not the UI', async () => {
    const engine = new LifecycleEngine();
    const ledger = new AuditLedger();
    const diagram = candidateDiagram({
      approvedBy: [{ userId: 'bruna', role: 'process-owner', approvedAt: '2026-07-01T00:00:00.000Z', reason: 'ok' }],
    });
    await expect(approvePromotion({ engine, ledger, diagram, actor })).rejects.toThrow();
    expect(ledger.getEntries()).toHaveLength(0);
  });
});

describe('requestChanges — pedir mudanças pela state machine (§2e)', () => {
  it('transiciona candidate → in-review pelo core e grava REVIEW_CHANGES_REQUESTED', async () => {
    const engine = new LifecycleEngine();
    const ledger = new AuditLedger();
    const diagram = candidateDiagram();
    const result = await requestChanges({
      engine,
      ledger,
      diagram,
      actor,
      justification: '  Cobrir o passo manual durante a transição.  ',
      threadRefs: ['th1', 'th2'],
    });
    expect(result.kind).toBe('changes-requested');
    // The NEW in-review version chains to the candidate (never mutated).
    expect(result.diagram.version.status).toBe('in-review');
    expect(result.diagram.version.parentVersionId).toBe(diagram.version.id);
    expect(diagram.version.status).toBe('candidate');
    expect(result.ledgerEntry.type).toBe(REVIEW_CHANGES_REQUESTED_TYPE);
    expect(result.ledgerEntry.versionId).toBe(diagram.version.id);
    expect(result.ledgerEntry.details).toMatchObject({
      artifactId: 'onboarding',
      role: 'process-owner',
      justification: 'Cobrir o passo manual durante a transição.',
      threadRefs: ['th1', 'th2'],
    });
    expect((await ledger.verify()).valid).toBe(true);
  });

  it('justificativa curta não transiciona nem toca o ledger', async () => {
    const engine = new LifecycleEngine();
    const ledger = new AuditLedger();
    await expect(
      requestChanges({ engine, ledger, diagram: candidateDiagram(), actor, justification: 'curta' }),
    ).rejects.toThrow(/ao menos 10 caracteres/);
    expect(ledger.getEntries()).toHaveLength(0);
  });

  it('persiste o pedido assinado nos details; sem assinatura a chave não existe', async () => {
    const engine = new LifecycleEngine();
    const ledger = new AuditLedger();
    const signedRequest = {
      payload: { decision: 'request-changes' },
      signature: 'c2ln',
      signer: { subject: 'bruna@x' },
      signedAt: '2026-07-17T00:00:00.000Z',
    };
    const signed = await requestChanges({
      engine,
      ledger,
      diagram: candidateDiagram(),
      actor,
      justification: 'Cobrir o passo manual durante a transição.',
      signedRequest,
    });
    expect(signed.ledgerEntry.details).toMatchObject({ signedRequest, threadRefs: [] });
    const legacy = await requestChanges({
      engine,
      ledger,
      diagram: candidateDiagram({ versionId: 'onb-v9' }),
      actor,
      justification: 'Sem assinatura, caminho legado declarado.',
    });
    expect(legacy.ledgerEntry.details).not.toHaveProperty('signedRequest');
  });

  it('rejectPromotion segue intacto como rejeição dura: nenhuma transição de status (decisão 3 da V-0)', async () => {
    const ledger = new AuditLedger();
    const diagram = candidateDiagram();
    const result = await rejectPromotion({
      ledger,
      diagram,
      actor,
      reason: 'O diff remove a validação manual sem contingência.',
    });
    // The hard path writes the ledger entry and leaves the status machine
    // alone — exactly as before §2e.
    expect(result.kind).toBe('rejected');
    expect(result.diagram).toBe(diagram);
    expect(result.diagram.version.status).toBe('candidate');
    expect(result.ledgerEntry.type).toBe(PROMOTION_REJECTED);
  });
});

describe('rejectPromotion — justificativa obrigatória vira ledger (§5)', () => {
  it('requires at least 10 characters and appends nothing on failure', async () => {
    const ledger = new AuditLedger();
    await expect(
      rejectPromotion({ ledger, diagram: candidateDiagram(), actor, reason: '  curto  ' }),
    ).rejects.toThrow(/ao menos 10 caracteres/);
    expect(ledger.getEntries()).toHaveLength(0);
  });

  it('writes PROMOTION_REJECTED with the trimmed reason and role', async () => {
    const ledger = new AuditLedger();
    const result = await rejectPromotion({
      ledger,
      diagram: candidateDiagram(),
      actor,
      reason: '  O diff remove a validação de CPF sem justificativa.  ',
    });
    expect(result.kind).toBe('rejected');
    expect(result.ledgerEntry.type).toBe(PROMOTION_REJECTED);
    expect(result.ledgerEntry.details).toMatchObject({
      reason: 'O diff remove a validação de CPF sem justificativa.',
      role: 'process-owner',
    });
    expect(result.ledgerEntry.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
