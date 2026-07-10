import { useEffect, useMemo, useState } from 'react';
import {
  computeDiff,
  type AuditLedger,
  type BpmnDiagram,
  type LifecycleEngine,
  type UserContext,
} from '@buildtovalue/core';
import type { VersionRegistry } from '@buildtovalue/registry';
import {
  AnchorSeal,
  buildApprovalPayloadFor,
  CanonicalPayloadCard,
  DiffView,
  SignatureBadge,
  StatusBadge,
  useAnchorCycle,
  useT,
} from '@buildtovalue/react';
import {
  signApproval,
  type AnchorAdapter,
  type AnchorHead,
  type CanonicalApprovalPayload,
  type SignedApproval,
  type Signer,
} from '@buildtovalue/identity';
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
  /**
   * C3 (Handoff 9): natural-language explanation of the candidate — READ-ONLY
   * ABSOLUTO: generates no commands and touches no ledger (not even as a
   * recorded query). The only capability without a trail, by design.
   */
  explain?: (diagram: BpmnDiagram) => Promise<string>;
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
  const t = useT();
  const { candidates, engine, ledger, actor, registry, converter, baselineOf, onDecided, onOpenInDesigner, replayAnalysisFor, explain, now, signer, anchor } =
    props;
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [checks, setChecks] = useState<ReviewCheck[]>();
  const [decisions, setDecisions] = useState<Record<string, DecisionResult>>({});
  const [rejecting, setRejecting] = useState(false);
  // C3: read-only explanations by candidate id — no ledger, no commands.
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState(false);
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
      <aside className="btv-studio-queue" aria-label={t('review.queue.aria')}>
        <header className="btv-studio-queue-header">
          {t('review.queue.header', { role: actor.role.toUpperCase() })}
        </header>
        <div
          className="btv-studio-queue-list"
          // A listbox must contain options (a11y, N-8): only take the role when
          // there are requests; the empty state is a plain container + message.
          role={queue.length > 0 ? 'listbox' : undefined}
          aria-label={queue.length > 0 ? t('review.queue.list.aria') : undefined}
          tabIndex={queue.length > 0 ? 0 : undefined}
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
                      ? t('review.queue.sla.target', { days: request.slaDays })
                      : t('review.queue.sla.overdue', { days: -request.slaDays })}
                  </span>
                )}
              </button>
            );
          })}
          {queue.length === 0 && (
            <p className="btv-studio-queue-empty">{t('review.queue.empty')}</p>
          )}
        </div>
      </aside>

      {/* section, not main: StudioShell owns the single top-level <main>
          landmark; a nested main would duplicate it. A nameless section is a
          generic container, not another landmark (a11y, N-8). */}
      <section className="btv-studio-review-area">
        {selected && (
          <>
            <section className="btv-studio-block">
              <span className="btv-studio-kicker">{t('review.request.kicker')}</span>
              <h1 className="btv-studio-title">
                {selected.diagram.name} <code>v{selected.diagram.version.semanticVersion}</code>
              </h1>
              <p className="btv-studio-subtitle">
                {t('review.request.subtitle', {
                  author: selected.diagram.version.createdBy,
                  date: selected.diagram.version.createdAt.slice(0, 10),
                })}
              </p>
              <StatusBadge
                seal={{
                  status: selected.diagram.version.status,
                  semanticVersion: selected.diagram.version.semanticVersion,
                  meta: approvalsProgress(selected),
                }}
              />
              {explain && (
                <div className="btv-studio-explain">
                  <button
                    type="button"
                    data-testid="review-explain"
                    disabled={explaining}
                    onClick={() => {
                      void (async () => {
                        setExplaining(true);
                        try {
                          const text = await explain(selected.diagram);
                          setExplanations((m) => ({ ...m, [selected.diagram.id]: text }));
                        } finally {
                          setExplaining(false);
                        }
                      })();
                    }}
                  >
                    ✦ {t('review.explain')}
                  </button>
                  {explanations[selected.diagram.id] && (
                    <p className="btv-studio-explain-text" data-testid="review-explanation">
                      {explanations[selected.diagram.id]}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="btv-studio-block">
              <span className="btv-studio-kicker">{t('review.changeSummary.kicker')}</span>
              <blockquote className="btv-studio-quote">{selected.diagram.version.changeSummary}</blockquote>
            </section>

            <section className="btv-studio-block">
              <div className="btv-studio-block-head">
                <span className="btv-studio-kicker">
                  {baseline
                    ? t('review.diff.kicker', { version: baseline.version.semanticVersion })
                    : t('review.diff.kickerNoBaseline')}
                </span>
                {onOpenInDesigner && (
                  <button
                    type="button"
                    className="btv-studio-link"
                    onClick={() => onOpenInDesigner(selected.diagram)}
                  >
                    {t('review.openCanvas')} →
                  </button>
                )}
              </div>
              {diff ? (
                <DiffView diff={diff} diagram={selected.diagram} />
              ) : (
                <p className="btv-studio-muted">{t('review.diff.firstVersion')}</p>
              )}
            </section>

            {(() => {
              const analysis = replayAnalysisFor?.(selected.diagram);
              if (!analysis) return null;
              return (
                <section className="btv-studio-block" data-testid="review-replay">
                  <span className="btv-studio-kicker">{t('review.replay.kicker')}</span>
                  <p className="btv-studio-replay-headline" data-replay-headline>
                    {analysis.headline}
                  </p>
                  <div className="btv-studio-replay-meta">
                    {t('review.replay.meta', {
                      fitness: (analysis.fitness * 100).toFixed(1).replace('.', ','),
                      cases: analysis.totalCases.toLocaleString('pt-BR'),
                    })}
                    {analysis.bottleneck
                      ? t('review.replay.bottleneck', { name: analysis.bottleneck })
                      : ''}
                    {analysis.deviation
                      ? t('review.replay.deviation', {
                          count: analysis.deviationCases ?? 0,
                          name: analysis.deviation,
                        })
                      : ''}
                    <br />
                    {t('review.replay.attachedBy', { author: analysis.author })}
                  </div>
                </section>
              );
            })()}

            <section className="btv-studio-block">
              <span className="btv-studio-kicker">{t('review.checks.kicker')}</span>
              <div className="btv-studio-checks" data-testid="review-checks">
                {(checks ?? []).map((check) => (
                  <div key={check.id} className="btv-studio-check" data-ok={check.ok} data-check={check.id}>
                    <span className="btv-studio-check-label">
                      {check.ok ? '✓' : '✕'} {check.label}
                    </span>
                    <span className="btv-studio-check-detail">{check.detail}</span>
                  </div>
                ))}
                {!checks && <p className="btv-studio-muted">{t('review.checks.running')}</p>}
              </div>
            </section>

            {signer && !decision && payloadPreview && (
              <section className="btv-studio-block" data-testid="review-payload">
                <CanonicalPayloadCard payload={payloadPreview} />
              </section>
            )}

            <section className="btv-studio-block" data-testid="review-decision">
              <span className="btv-studio-kicker">{t('review.decision.kicker')}</span>
              {decision ? (
                <div className="btv-studio-decision-done" data-kind={decision.kind}>
                  <strong>
                    {decision.kind === 'approved'
                      ? t('review.decision.approved')
                      : t('review.decision.rejected')}
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
                  <p className="btv-studio-muted">{t('review.decision.immutable')}</p>
                </div>
              ) : (
                <>
                  <p className="btv-studio-decision-context">
                    {selected.approvedRoles.length > 0
                      ? t('review.decision.approvedBy', { roles: selected.approvedRoles.join(', ') })
                      : t('review.decision.noneYet')}{' '}
                    {lastRole && t('review.decision.lastNeeded')}{' '}
                    <strong>{t('review.decision.notAutomatic')}</strong>
                  </p>
                  <div className="btv-studio-decision-buttons">
                    <button
                      type="button"
                      className="btv-studio-approve"
                      data-signing={signer ? true : undefined}
                      onClick={() => void decide('approve')}
                    >
                      {signer ? (
                        <>🔏 {t('review.decision.sign')}</>
                      ) : (
                        t('review.decision.approveAs', { role: actor.role })
                      )}
                    </button>
                    <button
                      type="button"
                      className="btv-studio-reject"
                      aria-expanded={rejecting}
                      onClick={() => setRejecting((r) => !r)}
                    >
                      {t('review.decision.rejectToggle')}
                    </button>
                  </div>
                  {rejecting && (
                    <div className="btv-studio-reject-form">
                      <textarea
                        aria-label={t('review.reject.aria')}
                        placeholder={t('review.reject.placeholder', {
                          min: MIN_REJECTION_REASON_LENGTH,
                        })}
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
                        {t('review.reject.confirm')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
        {!selected && <p className="btv-studio-muted">{t('review.empty')}</p>}
      </section>
    </div>
  );
}
