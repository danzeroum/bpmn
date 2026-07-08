import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeDiff,
  type AuditEntry,
  type AuditLedger,
  type BpmnDiagram,
  type LifecycleEngine,
  type PromotionGate,
  type UserContext,
  type VersionStatus,
} from '@bpmn-react/core';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { DiffView } from './DiffView.js';

export interface PromotionApprover {
  actor: UserContext;
  /** Display name for the role button (defaults to the actor's role). */
  label?: string;
}

export interface PromotionPanelProps {
  open: boolean;
  onClose: () => void;
  /** Who can approve in this UI — one button per role (host decides). */
  approvers: PromotionApprover[];
  /** Who performs the promotion itself. */
  actor: UserContext;
  /** Baseline for the embedded diff (typically the previously active snapshot). */
  baseline: BpmnDiagram;
  /** Currently active version, for the side-effects warning. */
  previousActive?: { semanticVersion: string; runsPinned?: number };
  /** When provided, activation appends a VERSION_ACTIVATED entry and the toast shows its hash. */
  ledger?: AuditLedger;
  onActivated?: (result: { diagram: BpmnDiagram; ledgerEntry?: AuditEntry }) => void;
}

/**
 * Formal promotion flow (Handoff 2 §B2): gate checklist + embedded diff +
 * per-role approvals + side-effects warning + activation toast. The UI only
 * REFLECTS the core state machine — gates come from `evaluateGates`,
 * transitions from `allowedTargets`, and the activation goes through
 * `promote()`, which re-enforces everything.
 */
export function PromotionPanel({
  open,
  onClose,
  approvers,
  actor,
  baseline,
  previousActive,
  ledger,
  onActivated,
}: PromotionPanelProps) {
  const { diagram, replaceDiagram } = useDiagram();
  const { lifecycleEngine, validationEngine, emitEditorEvent } = useEditorConfig();
  const canvasStore = useCanvasStore();
  const [gates, setGates] = useState<PromotionGate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const version = diagram.version;
  const diff = useMemo(() => computeDiff(baseline, diagram), [baseline, diagram]);
  const trail = useMemo(() => lifecycleTrail(lifecycleEngine), [lifecycleEngine]);
  // Soundness section (Handoff 4 §C2): the SND_* issues the host's
  // validation engine reports (registered via the soundness plugin). Errors
  // also block activation through the promotion gate — this section explains
  // WHY and points at the offending elements.
  const soundnessErrors = useMemo(
    () =>
      open
        ? validationEngine
            .validate(diagram)
            .issues.filter((issue) => issue.code.startsWith('SND_') && issue.severity === 'error')
        : [],
    [open, validationEngine, diagram],
  );

  const showOnCanvas = () => {
    const badges: Record<string, { severity: 'error' | 'warning'; code?: string }> = {};
    for (const issue of soundnessErrors) {
      // Edge-anchored issues badge the edge's source node.
      const nodeId = issue.nodeId ?? (issue.edgeId ? diagram.edges[issue.edgeId]?.sourceId : undefined);
      if (nodeId) badges[nodeId] = { severity: 'error', code: issue.code };
    }
    canvasStore.setState({ issueBadges: badges, selectedIds: Object.keys(badges) });
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    let stale = false;
    void lifecycleEngine
      .evaluateGates({ diagram, target: 'active', actor, reason: version.changeSummary, diff })
      .then((result) => {
        if (!stale) setGates(result);
      });
    return () => {
      stale = true;
    };
  }, [open, lifecycleEngine, diagram, actor, version.changeSummary, diff]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const canActivate = gates !== null && gates.every((gate) => gate.satisfied) && !busy;

  const approve = (approver: PromotionApprover) => {
    try {
      setError(null);
      replaceDiagram(
        lifecycleEngine.approve(
          diagram,
          approver.actor,
          `Aprovação formal como ${approver.label ?? approver.actor.role}`,
        ),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      const promoted = await lifecycleEngine.promote({
        diagram,
        target: 'active',
        actor,
        reason: version.changeSummary,
        diff,
      });
      replaceDiagram(promoted);
      let entry: AuditEntry | undefined;
      if (ledger) {
        entry = await ledger.append({
          type: 'VERSION_ACTIVATED',
          userId: actor.id,
          versionId: promoted.version.id,
          details: {
            semanticVersion: promoted.version.semanticVersion,
            ...(previousActive ? { supersedes: previousActive.semanticVersion } : {}),
          },
        });
      }
      const parts = [`v${promoted.version.semanticVersion} ativa`];
      if (previousActive) parts.push(`v${previousActive.semanticVersion} → descontinuada`);
      if (entry) parts.push(`ledger #${entry.hash.slice(0, 7)} gravado`);
      setToast(parts.join(' · '));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
      emitEditorEvent('promotion.completed', {
        semanticVersion: promoted.version.semanticVersion,
        status: promoted.version.status,
        ...(entry ? { ledgerHash: entry.hash } : {}),
      });
      onActivated?.({ diagram: promoted, ledgerEntry: entry });
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="bpmnr-promotion-overlay">
          <section
            className="bpmnr-promotion"
            role="dialog"
            aria-modal="true"
            aria-label={`Ativar v${version.semanticVersion}`}
          >
            <header>
              <p className="bpmnr-promotion-kicker">PROMOÇÃO FORMAL · STATE MACHINE DO CORE</p>
              <h2>Ativar v{version.semanticVersion}</h2>
              <p className="bpmnr-promotion-trail">
                {trail.map((step, index) => (
                  <span key={step} data-current={step === version.status || undefined}>
                    {index > 0 && ' → '}
                    {step === 'active' ? <strong>{step}</strong> : step}
                  </span>
                ))}
              </p>
            </header>

            {gates === null && <p className="bpmnr-promotion-pending">verificando gates…</p>}

            {gates?.map((gate) => (
              <div key={gate.id} className="bpmnr-promotion-gate" data-satisfied={gate.satisfied}>
                <span aria-hidden>{gate.satisfied ? '✓' : '○'}</span>
                <div>
                  <strong>
                    {gate.label}
                    {gate.id === 'approvals' && ` (${gate.current}/${gate.required})`}
                  </strong>
                  {!gate.satisfied && <p className="bpmnr-promotion-detail">{gate.detail}</p>}
                  {gate.id === 'change-summary' && (
                    <textarea
                      className="bpmnr-promotion-summary"
                      aria-label="change_summary"
                      rows={2}
                      defaultValue={version.changeSummary}
                      placeholder={`Descreva a mudança (mín. ${lifecycleEngine.requiredChangeSummaryLength} caracteres)`}
                      onBlur={(event) => {
                        const value = event.target.value;
                        if (value === version.changeSummary) return;
                        // Same immutable pattern as engine.approve: a new
                        // version record — gates re-evaluate automatically.
                        replaceDiagram({
                          ...diagram,
                          version: { ...version, changeSummary: value },
                        });
                      }}
                    />
                  )}
                  {gate.id === 'approvals' && (
                    <div className="bpmnr-promotion-approvers">
                      {approvers.map((approver) => {
                        const approved = version.approvedBy.some(
                          (a) => a.userId === approver.actor.id,
                        );
                        const label = approver.label ?? approver.actor.role;
                        return (
                          <button
                            key={approver.actor.id}
                            type="button"
                            data-approved={approved}
                            disabled={approved}
                            onClick={() => approve(approver)}
                          >
                            {approved ? `✓ ${label} aprovou` : `Aprovar como ${label}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div
              className="bpmnr-promotion-gate bpmnr-promotion-soundness"
              data-satisfied={soundnessErrors.length === 0}
            >
              <span aria-hidden>{soundnessErrors.length === 0 ? '✓' : '○'}</span>
              <div>
                <strong>
                  Soundness ·{' '}
                  {soundnessErrors.length === 0
                    ? '0 erros'
                    : `${soundnessErrors.length} erro(s)`}
                </strong>
                {soundnessErrors.length > 0 && (
                  <>
                    <ul className="bpmnr-promotion-soundness-codes">
                      {[...new Set(soundnessErrors.map((issue) => issue.code))].map((code) => (
                        <li key={code}>
                          <code>{code}</code>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={showOnCanvas}>
                      ver no canvas
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bpmnr-promotion-diff">
              <strong>Diff vs baseline</strong>
              <DiffView diff={diff} diagram={diagram} />
            </div>

            <p className="bpmnr-promotion-warning">
              Ao ativar:{' '}
              {previousActive
                ? `v${previousActive.semanticVersion} passa a Descontinuada (effective_until = hoje) · ${
                    previousActive.runsPinned !== undefined
                      ? `${previousActive.runsPinned} execuções em andamento permanecem presas à v${previousActive.semanticVersion}`
                      : `execuções em andamento permanecem presas à v${previousActive.semanticVersion}`
                  } · `
                : 'execuções em andamento permanecem presas às versões em que nasceram · '}
              promoção gravada no ledger hash-chained.
            </p>

            {error && (
              <p className="bpmnr-promotion-error" role="alert">
                {error}
              </p>
            )}

            <footer>
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="bpmnr-promotion-activate"
                disabled={!canActivate}
                onClick={() => void activate()}
              >
                Ativar v{version.semanticVersion}
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="bpmnr-toast" role="status">
          <span aria-hidden>✓</span> {toast}
        </div>
      )}
    </>
  );
}

/**
 * Walks the engine's transition table from 'draft' towards 'active' (first
 * unvisited target each step) so the header trail reflects custom transition
 * matrices instead of a hardcoded draft → test → candidate → active.
 */
function lifecycleTrail(engine: LifecycleEngine): VersionStatus[] {
  const trail: VersionStatus[] = ['draft'];
  const seen = new Set<VersionStatus>(trail);
  let current: VersionStatus = 'draft';
  while (current !== 'active') {
    const next: VersionStatus | undefined = engine
      .allowedTargets(current)
      .find((target) => !seen.has(target));
    if (!next) break;
    trail.push(next);
    seen.add(next);
    current = next;
  }
  return trail;
}
