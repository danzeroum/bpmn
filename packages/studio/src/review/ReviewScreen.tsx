import { useEffect, useMemo, useState } from 'react';
import {
  computeDiff,
  type AuditLedger,
  type BpmnDiagram,
  type LifecycleEngine,
  type UserContext,
} from '@bpmn-react/core';
import type { VersionRegistry } from '@bpmn-react/registry';
import {
  AnchorSeal,
  buildApprovalPayloadFor,
  CanonicalPayloadCard,
  DiffView,
  SignatureBadge,
  StatusBadge,
  useAnchorCycle,
} from '@bpmn-react/react';
import {
  signApproval,
  type AnchorAdapter,
  type AnchorHead,
  type CanonicalApprovalPayload,
  type SignedApproval,
  type Signer,
} from '@bpmn-react/identity';
import { approvalsProgress, pendingPromotions, type PromotionRequest } from './queue.js';
import { runReviewChecks, type ReviewCheck } from './checks.js';
import {
  approvePromotion,
  rejectPromotion,
  MIN_REJECTION_REASON_LENGTH,
  type DecisionResult,
} from './decide.js';

export interface ReviewScreenProps {
  /** Live candidate diagrams — the solicitante's working set, host-owned. */
  candidates: readonly BpmnDiagram[];
  engine: LifecycleEngine;
  ledger: AuditLedger;
  actor: UserContext;
  /** Resolves call-activity references for the Dependências card. */
  registry?: VersionRegistry;
  /** Host-configured XML exporter for the Conformidade card. */
  converter?: { toXml(diagram: BpmnDiagram): string };
  /** Baseline for the diff block (e.g. the active version); absent → first version. */
  baselineOf?: (diagram: BpmnDiagram) => BpmnDiagram | undefined;
  /** Notifies the host so it persists the approval / reacts to the rejection. */
  onDecided?: (result: DecisionResult) => void;
  /** Renders the "abrir no canvas →" link when provided (read-only Designer). */
  onOpenInDesigner?: (diagram: BpmnDiagram) => void;
  /**
   * Replay analysis attached to a candidate's promotion (Handoff 7B-3, host
   * injection — usually `latestReplayAnalysis` over the ledger). When it returns
   * a value, the review shows an "ANÁLISE DE REPLAY" block; absent → no block.
   */
  replayAnalysisFor?: (diagram: BpmnDiagram) => ReviewReplayAnalysis | undefined;
  now?: () => string;
  /**
   * Identity signing (Handoff 8 I-2, host injection — cerca §1.1: the host owns
   * the key). When present, "Aprovar como {papel}" becomes the 🔏 signing flow:
   * the canonical payload is shown before signing, the signature is recorded in
   * the ledger entry, and the confirmation shows the fingerprint + verified
   * badge. Absent → current behavior + "não assinada" badge.
   */
  signer?: Signer;
  /**
   * External anchor adapter (Handoff 8 I-3, host injection). When present, a
   * signed approval's chain head is anchored after the decision: the seal shows
   * the pending→ancorada cycle with retry (cerca §1.3 — never regresses). Absent
   * → "sem âncora configurada" for signed approvals (§1.4).
   */
  anchor?: AnchorAdapter;
}

/** The attached replay analysis the Approver Review renders (structural). */
export interface ReviewReplayAnalysis {
  headline: string;
  fitness: number;
  totalCases: number;
  analyzedVersion: string;
  bottleneck?: string;
  deviation?: string;
  deviationCases?: number;
  author: string;
  timestamp: string;
}

/** `ed25519:#0b9a…f21c` — short signature fingerprint for the verified badge. */
function signatureFingerprintOf(signed: SignedApproval): string {
  const s = signed.signature;
  return `ed25519:#${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * TELA 2 — Revisão do Aprovador (Handoff 6 §5): queue on the left (296px),
 * review area in the middle (max 820px). Read-only absoluto — the only
 * commands are the two governance decisions, both immutable ledger entries.
 * Approving NEVER activates (§11): a solicitante executa a promoção final.
 */
export function ReviewScreen(props: ReviewScreenProps) {
  const { candidates, engine, ledger, actor, registry, converter, baselineOf, onDecided, onOpenInDesigner, replayAnalysisFor, now, signer, anchor } =
    props;
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [checks, setChecks] = useState<ReviewCheck[]>();
  const [decisions, setDecisions] = useState<Record<string, DecisionResult>>({});
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [payloadPreview, setPayloadPreview] = useState<CanonicalApprovalPayload>();

  useEffect(() => {
    let alive = true;
    void pendingPromotions({ candidates, engine, user: actor, ...(now ? { now } : {}) }).then((next) => {
      if (!alive) return;
      setRequests(next);
    });
    return () => {
      alive = false;
    };
  }, [candidates, engine, actor, now]);

  const queue = useMemo(
    () => requests.filter((r) => !decisions[r.diagram.version.id]),
    [requests, decisions],
  );
  const selected =
    queue.find((r) => r.diagram.version.id === selectedId) ??
    requests.find((r) => r.diagram.version.id === selectedId) ??
    queue[0];
  const decision = selected ? decisions[selected.diagram.version.id] : undefined;

  useEffect(() => {
    if (!selected) {
      setChecks(undefined);
      return;
    }
    let alive = true;
    setChecks(undefined);
    void runReviewChecks({
      diagram: selected.diagram,
      ledger,
      ...(registry ? { registry } : {}),
      ...(converter ? { converter } : {}),
      ...(now ? { now } : {}),
    }).then((next) => {
      if (alive) setChecks(next);
    });
    return () => {
      alive = false;
    };
  }, [selected?.diagram.version.id, ledger, registry, converter, now]);

  // Canonical payload shown BEFORE signing (§4.3) — only when a signer is wired.
  useEffect(() => {
    if (!selected || !signer) {
      setPayloadPreview(undefined);
      return;
    }
    let alive = true;
    void buildApprovalPayloadFor({
      diagram: selected.diagram,
      ledger,
      decision: 'approve',
      role: actor.role,
      ...(converter ? { toXml: (d: BpmnDiagram) => converter.toXml(d) } : {}),
    }).then((p) => {
      if (alive) setPayloadPreview(p);
    });
    return () => {
      alive = false;
    };
  }, [selected?.diagram.version.id, signer, ledger, actor.role, converter]);

  // Anchor the chain head of a *signed* approval (Handoff 8 I-3). Memoized so
  // the cycle re-runs only when the decision changes, not every render.
  const anchorHead = useMemo<AnchorHead | undefined>(() => {
    if (decision?.kind !== 'approved') return undefined;
    const signed = (decision.ledgerEntry.details as { signedApproval?: SignedApproval }).signedApproval;
    if (!signed) return undefined;
    return { hash: decision.ledgerEntry.hash, seq: decision.ledgerEntry.seq };
  }, [decision]);
  const anchorCycle = useAnchorCycle(anchor, anchorHead);

  const moveSelection = (delta: number) => {
    if (queue.length === 0) return;
    const index = queue.findIndex((r) => r.diagram.version.id === selected?.diagram.version.id);
    const next = queue[Math.min(queue.length - 1, Math.max(0, index + delta))];
    setSelectedId(next.diagram.version.id);
    setRejecting(false);
    setReason('');
  };

  const decide = async (kind: 'approve' | 'reject') => {
    if (!selected) return;
    let result: DecisionResult;
    if (kind === 'approve') {
      let signedApproval: SignedApproval | undefined;
      if (signer) {
        const payload = await buildApprovalPayloadFor({
          diagram: selected.diagram,
          ledger,
          decision: 'approve',
          role: actor.role,
          ...(converter ? { toXml: (d: BpmnDiagram) => converter.toXml(d) } : {}),
        });
        signedApproval = await signApproval(
          signer,
          payload,
          now ? now() : new Date().toISOString(),
        );
      }
      result = await approvePromotion({
        engine,
        ledger,
        diagram: selected.diagram,
        actor,
        ...(signedApproval ? { signedApproval } : {}),
      });
    } else {
      result = await rejectPromotion({ ledger, diagram: selected.diagram, actor, reason });
    }
    setDecisions((prev) => ({ ...prev, [selected.diagram.version.id]: result }));
    // Pin the decided request so the confirmation card stays visible after
    // the item leaves the queue.
    setSelectedId(selected.diagram.version.id);
    setRejecting(false);
    setReason('');
    onDecided?.(result);
  };

  const baseline = selected && baselineOf ? baselineOf(selected.diagram) : undefined;
  const diff = useMemo(
    () => (selected && baseline ? computeDiff(baseline, selected.diagram) : undefined),
    [baseline, selected?.diagram],
  );
  const lastRole = selected?.approvals
    ? (selected.approvals.current ?? 0) + 1 >= (selected.approvals.required ?? 0)
    : false;

  return (
    <div className="btv-studio-review" data-testid="review-screen">
      <aside className="btv-studio-queue" aria-label="Fila de aprovação">
        <header className="btv-studio-queue-header">
          FILA DE APROVAÇÃO · SEU PAPEL: {actor.role.toUpperCase()}
        </header>
        <div
          className="btv-studio-queue-list"
          role="listbox"
          aria-label="Pedidos de promoção pendentes"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              moveSelection(1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              moveSelection(-1);
            }
          }}
        >
          {queue.map((request) => {
            const { version } = request.diagram;
            const isSelected = version.id === selected?.diagram.version.id;
            return (
              <button
                key={version.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="btv-studio-queue-item"
                data-selected={isSelected || undefined}
                onClick={() => {
                  setSelectedId(version.id);
                  setRejecting(false);
                  setReason('');
                }}
              >
                <span className="btv-studio-queue-name">
                  {request.diagram.name} <code>v{version.semanticVersion}</code>
                </span>
                <StatusBadge
                  seal={{
                    status: version.status,
                    semanticVersion: version.semanticVersion,
                    meta: approvalsProgress(request),
                  }}
                />
                {request.slaDays !== undefined && (
                  <span className="btv-studio-queue-sla" data-urgent={request.slaDays < 3 || undefined}>
                    {request.slaDays >= 0
                      ? `ativação alvo em ${request.slaDays}d`
                      : `alvo vencido há ${-request.slaDays}d`}
                  </span>
                )}
              </button>
            );
          })}
          {queue.length === 0 && (
            <p className="btv-studio-queue-empty">Nenhum pedido aguardando a sua aprovação.</p>
          )}
        </div>
      </aside>

      <main className="btv-studio-review-area">
        {selected && (
          <>
            <section className="btv-studio-block">
              <span className="btv-studio-kicker">PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE</span>
              <h1 className="btv-studio-title">
                {selected.diagram.name} <code>v{selected.diagram.version.semanticVersion}</code>
              </h1>
              <p className="btv-studio-subtitle">
                solicitado por {selected.diagram.version.createdBy} ·{' '}
                {selected.diagram.version.createdAt.slice(0, 10)}
              </p>
              <StatusBadge
                seal={{
                  status: selected.diagram.version.status,
                  semanticVersion: selected.diagram.version.semanticVersion,
                  meta: approvalsProgress(selected),
                }}
              />
            </section>

            <section className="btv-studio-block">
              <span className="btv-studio-kicker">CHANGE SUMMARY (DA SOLICITANTE)</span>
              <blockquote className="btv-studio-quote">{selected.diagram.version.changeSummary}</blockquote>
            </section>

            <section className="btv-studio-block">
              <div className="btv-studio-block-head">
                <span className="btv-studio-kicker">
                  {baseline ? `DIFF VS V${baseline.version.semanticVersion}` : 'DIFF'}
                </span>
                {onOpenInDesigner && (
                  <button
                    type="button"
                    className="btv-studio-link"
                    onClick={() => onOpenInDesigner(selected.diagram)}
                  >
                    abrir no canvas →
                  </button>
                )}
              </div>
              {diff ? (
                <DiffView diff={diff} diagram={selected.diagram} />
              ) : (
                <p className="btv-studio-muted">Primeira versão — não há baseline para comparar.</p>
              )}
            </section>

            {(() => {
              const analysis = replayAnalysisFor?.(selected.diagram);
              if (!analysis) return null;
              return (
                <section className="btv-studio-block" data-testid="review-replay">
                  <span className="btv-studio-kicker">ANÁLISE DE REPLAY (ANEXADA)</span>
                  <p className="btv-studio-replay-headline" data-replay-headline>
                    {analysis.headline}
                  </p>
                  <div className="btv-studio-replay-meta">
                    fitness {(analysis.fitness * 100).toFixed(1).replace('.', ',')}% ·{' '}
                    {analysis.totalCases.toLocaleString('pt-BR')} casos
                    {analysis.bottleneck ? ` · gargalo "${analysis.bottleneck}"` : ''}
                    {analysis.deviation
                      ? ` · ${analysis.deviationCases ?? 0} desvios em "${analysis.deviation}"`
                      : ''}
                    <br />
                    anexado por {analysis.author}
                  </div>
                </section>
              );
            })()}

            <section className="btv-studio-block">
              <span className="btv-studio-kicker">VERIFICAÇÕES AUTOMÁTICAS</span>
              <div className="btv-studio-checks" data-testid="review-checks">
                {(checks ?? []).map((check) => (
                  <div key={check.id} className="btv-studio-check" data-ok={check.ok} data-check={check.id}>
                    <span className="btv-studio-check-label">
                      {check.ok ? '✓' : '✕'} {check.label}
                    </span>
                    <span className="btv-studio-check-detail">{check.detail}</span>
                  </div>
                ))}
                {!checks && <p className="btv-studio-muted">Executando verificações…</p>}
              </div>
            </section>

            {signer && !decision && payloadPreview && (
              <section className="btv-studio-block" data-testid="review-payload">
                <CanonicalPayloadCard payload={payloadPreview} />
              </section>
            )}

            <section className="btv-studio-block" data-testid="review-decision">
              <span className="btv-studio-kicker">SUA DECISÃO</span>
              {decision ? (
                <div className="btv-studio-decision-done" data-kind={decision.kind}>
                  <strong>
                    {decision.kind === 'approved'
                      ? 'Aprovação registrada no ledger'
                      : 'Rejeição registrada no ledger'}
                  </strong>
                  <code className="btv-studio-mono">{decision.ledgerEntry.hash}</code>
                  {decision.kind === 'approved' &&
                    (() => {
                      const signed = (
                        decision.ledgerEntry.details as { signedApproval?: SignedApproval }
                      ).signedApproval;
                      return signed ? (
                        <SignatureBadge
                          state="valid"
                          signer={signed.signer}
                          signatureFingerprint={signatureFingerprintOf(signed)}
                        />
                      ) : (
                        <SignatureBadge state="legacy" />
                      );
                    })()}
                  {anchorHead && (
                    <AnchorSeal
                      state={anchorCycle.state}
                      adapterId={anchor?.id}
                      head={anchorHead.hash}
                      onRetry={anchorCycle.retry}
                      retrying={anchorCycle.retrying}
                    />
                  )}
                  <p className="btv-studio-muted">
                    Decisão imutável — corrigir exige um novo ciclo de promoção.
                  </p>
                </div>
              ) : (
                <>
                  <p className="btv-studio-decision-context">
                    {selected.approvedRoles.length > 0
                      ? `Já aprovaram: ${selected.approvedRoles.join(', ')}.`
                      : 'Nenhuma aprovação registrada ainda.'}{' '}
                    {lastRole && 'A sua é a última aprovação necessária.'}{' '}
                    <strong>
                      A ativação NÃO é automática — a solicitante executa a promoção final.
                    </strong>
                  </p>
                  <div className="btv-studio-decision-buttons">
                    <button
                      type="button"
                      className="btv-studio-approve"
                      data-signing={signer ? true : undefined}
                      onClick={() => void decide('approve')}
                    >
                      {signer ? '🔏 Assinar aprovação com minha chave' : `Aprovar como ${actor.role}`}
                    </button>
                    <button
                      type="button"
                      className="btv-studio-reject"
                      aria-expanded={rejecting}
                      onClick={() => setRejecting((r) => !r)}
                    >
                      Rejeitar com justificativa…
                    </button>
                  </div>
                  {rejecting && (
                    <div className="btv-studio-reject-form">
                      <textarea
                        aria-label="Justificativa da rejeição"
                        placeholder={`Justificativa obrigatória (mín. ${MIN_REJECTION_REASON_LENGTH} caracteres) — vira entrada de ledger`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                      <button
                        type="button"
                        className="btv-studio-reject-confirm"
                        disabled={reason.trim().length < MIN_REJECTION_REASON_LENGTH}
                        onClick={() => void decide('reject')}
                      >
                        Confirmar rejeição
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
        {!selected && <p className="btv-studio-muted">Selecione um pedido na fila.</p>}
      </main>
    </div>
  );
}
