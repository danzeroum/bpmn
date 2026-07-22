import { useEffect, useMemo, useState } from 'react';
import type { AuditEntry } from '@buildtovalue/core';
import { useT } from '@buildtovalue/react';
import { toXES, verifyLedger, type LedgerLike, type VerificationReport } from '@buildtovalue/audit';
import { parseLedgerAnswer, type LedgerQueryResult } from '@buildtovalue/copilot';
import type { AnchorAdapter, AnchorReceipt } from '@buildtovalue/identity';
import type { VersionRegistry } from '@buildtovalue/registry';
import {
  LEDGER_CATEGORIES,
  aiAuthorOf,
  categorizeEntry,
  describeEntry,
  filterEntries,
  type LedgerCategory,
  type LedgerFilter,
} from './categorize.js';

export interface LedgerAction {
  id: 'diff' | 'open-designer';
  entry: AuditEntry;
}

export interface LedgerExplorerProps {
  ledger: LedgerLike;
  /** Enriches the XES export with registered/published events. */
  registry?: VersionRegistry;
  /** "Ver diff desta mudança" / "Abrir versão no Designer (leitura)" — host resolves. */
  onAction?: (action: LedgerAction) => void;
  /** Download seam (VerificationReport.json / attestation.json / .xes); default: browser download. */
  onDownload?: (filename: string, content: string, mime: string) => void;
  initialFilter?: LedgerFilter;
  /**
   * C6 (Handoff 9): host-injected copilot transport for the ledger query box.
   * Read-only like C3 — neither the question nor the answer touches the
   * chain. The raw completion goes through `parseLedgerAnswer`: EVERY
   * citation must resolve to a real entry hash (clickable, opens the entry)
   * or the panel says "não encontrei registro" — never an invented answer.
   */
  query?: (question: string) => Promise<string>;
  /**
   * N-4 (Handoff 11): the EXTERNAL anchor dimension of "Verificar cadeia".
   * `verifyLedger` (is the local chain self-consistent?) and the anchor
   * verification (does the head match the externally recorded one?) are
   * INDEPENDENT results — the banners render them as separate statements
   * and never fuse them. Absent → explorer unchanged.
   */
  anchor?: {
    adapter: AnchorAdapter;
    /** The host-persisted receipt to re-verify; absent → "pendente". */
    receipt?: AnchorReceipt;
    /** Fires after "Retentar âncora" produces a fresh receipt (host persists). */
    onAnchored?: (receipt: AnchorReceipt) => void;
  };
}

/** N-4: the anchor verification outcome shown by its own banner. */
interface AnchorOutcome {
  status: 'anchored' | 'pending' | 'mismatch';
  receipt?: AnchorReceipt;
}

function browserDownload(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function entriesOf(ledger: LedgerLike): readonly AuditEntry[] {
  return 'getEntries' in ledger ? ledger.getEntries() : ledger.entries;
}

/** Attestation payload carried by activation/attestation entries (§6). */
function attestationOf(entry: AuditEntry): Record<string, unknown> | undefined {
  const inline = entry.details['attestation'];
  if (inline && typeof inline === 'object') return inline as Record<string, unknown>;
  if (entry.details['xmlHash'] !== undefined) return entry.details;
  return undefined;
}

/** The squad EvidenceBundle carried by an `EVIDENCE_BUNDLE` entry (SL-11). Reads
 * the mandatory governance refs + the masked fact count for the dedicated panel;
 * `undefined` for any other entry (so the section only renders for evidence). */
interface EvidenceView {
  maskingPolicyRef: string;
  policyRefs: string[];
  decisionRuleRefs: string[];
  factCount: number;
  complete: boolean;
  blocked: boolean;
}
function evidenceOf(entry: AuditEntry): EvidenceView | undefined {
  if (entry.type !== 'EVIDENCE_BUNDLE') return undefined;
  const d = entry.details;
  const maskingPolicyRef = typeof d['maskingPolicyRef'] === 'string' ? (d['maskingPolicyRef'] as string) : '';
  if (maskingPolicyRef === '') return undefined; // never render evidence with no named masking policy
  return {
    maskingPolicyRef,
    policyRefs: Array.isArray(d['policyRefs']) ? (d['policyRefs'] as string[]) : [],
    decisionRuleRefs: Array.isArray(d['decisionRuleRefs']) ? (d['decisionRuleRefs'] as string[]) : [],
    factCount: Array.isArray(d['facts']) ? (d['facts'] as unknown[]).length : 0,
    complete: d['complete'] === true,
    blocked: d['blocked'] != null,
  };
}

function formatWhen(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

/**
 * TELA 3 — Ledger Explorer (Handoff 6 §6): filter bar + vertical trail
 * (max 720px) + detail column (340px). Read-only: verification, export and
 * navigation only — the chain is never mutated here.
 */
export function LedgerExplorer({ ledger, registry, onAction, onDownload, initialFilter, query, anchor }: LedgerExplorerProps) {
  const t = useT();
  const [filter, setFilter] = useState<LedgerFilter>(initialFilter ?? {});
  const [selectedSeq, setSelectedSeq] = useState<number>();
  const [report, setReport] = useState<VerificationReport>();
  // N-4 anchor state — independent from the chain report above.
  const [anchorResult, setAnchorResult] = useState<AnchorOutcome>();
  const [anchorRetrying, setAnchorRetrying] = useState(false);
  // C6 — ledger query state: pure component state, never appended anywhere.
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [queryResult, setQueryResult] = useState<LedgerQueryResult>();

  const all = entriesOf(ledger);
  const { entries, counts } = useMemo(() => filterEntries(all, filter), [all, filter]);
  const selected = entries.find((e) => e.seq === selectedSeq) ?? entries[0];
  const download = onDownload ?? browserDownload;

  const askLedger = async () => {
    if (!query || asking || question.trim() === '') return;
    setAsking(true);
    try {
      const raw = await query(question.trim());
      // The citability golden rule runs LOCALLY over the REAL entry hashes.
      setQueryResult(parseLedgerAnswer(raw, all.map((entry) => entry.hash)));
    } catch (cause) {
      setQueryResult({ ok: false, reason: (cause as Error).message });
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    setReport(undefined);
    setAnchorResult(undefined);
  }, [ledger]);

  const verifyAnchor = async (receipt?: AnchorReceipt): Promise<AnchorOutcome> => {
    const head = all[all.length - 1];
    if (!anchor || !receipt || !head) return { status: 'pending', ...(receipt ? { receipt } : {}) };
    const status = await anchor.adapter.verify(receipt, head.hash);
    // 'unavailable' (transport down) is NOT a verdict: stay pendente —
    // retry, never regress (H8 §1.3).
    return { status: status === 'unavailable' ? 'pending' : status, receipt };
  };

  const verify = async () => {
    // Two INDEPENDENT verifications, two independent banners (N-4): the
    // chain report never fuses with the anchor outcome.
    setReport(await verifyLedger(ledger));
    if (anchor) setAnchorResult(await verifyAnchor(anchor.receipt));
  };

  const retryAnchor = async () => {
    const head = all[all.length - 1];
    if (!anchor || !head || anchorRetrying) return;
    setAnchorRetrying(true);
    try {
      const receipt = await anchor.adapter.anchor({ hash: head.hash, seq: head.seq });
      anchor.onAnchored?.(receipt);
      setAnchorResult(await verifyAnchor(receipt));
    } catch {
      // Transport down: stay 'pendente' (retry, never regress).
    } finally {
      setAnchorRetrying(false);
    }
  };

  /**
   * Under CADEIA ≠ ÂNCORA the anchored head asserted entry #seq — the local
   * entry there provably diverges, and everything after it stands on an
   * unverified base: mark #seq and every later entry as não-confiável.
   */
  const anchorUntrusted = (entry: AuditEntry): boolean =>
    anchorResult?.status === 'mismatch' &&
    entry.seq >= (anchorResult.receipt?.head.seq ?? Number.POSITIVE_INFINITY);

  const exportXes = () => {
    const xes = toXES({ entries: [...entries] }, registry ? { registry } : {});
    download('ledger-export.xes', xes, 'application/xml');
  };

  const untrusted = (entry: AuditEntry): boolean =>
    report !== undefined && !report.intact && entry.seq >= (report.firstBreak?.index ?? 0);

  const headHash = all.length > 0 ? all[all.length - 1].hash : '';
  const toggleCategory = (category: LedgerCategory) => {
    const current = new Set(filter.categories ?? []);
    if (current.has(category)) current.delete(category);
    else current.add(category);
    setFilter({ ...filter, categories: [...current] });
  };

  const dotClass = (category: LedgerCategory) => `btv-studio-ledger-dot btv-studio-ledger-dot-${category}`;
  const attestation = selected ? attestationOf(selected) : undefined;
  const evidence = selected ? evidenceOf(selected) : undefined;

  return (
    <div className="btv-studio-ledger" data-testid="ledger-explorer">
      <div className="btv-studio-ledger-toolbar">
        <div className="btv-studio-chip-row" aria-label={t('ledger.filter.aria')}>
          <button
            type="button"
            className="btv-studio-chip"
            aria-pressed={!filter.categories?.length}
            onClick={() => setFilter({ ...filter, categories: [] })}
          >
            {t('ledger.filter.all')} <span className="btv-studio-chip-count">{counts.total}</span>
          </button>
          {LEDGER_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className="btv-studio-chip"
              data-category={category.id}
              aria-pressed={filter.categories?.includes(category.id) ?? false}
              onClick={() => toggleCategory(category.id)}
            >
              {category.label} <span className="btv-studio-chip-count">{counts[category.id]}</span>
            </button>
          ))}
          {filter.artifactId && (
            <button
              type="button"
              className="btv-studio-chip btv-studio-chip-context"
              onClick={() => setFilter({ ...filter, artifactId: undefined } as LedgerFilter)}
            >
              {t('ledger.filter.artifact', { id: filter.artifactId })} ✕
            </button>
          )}
        </div>
        <span className="btv-studio-spacer" />
        <button type="button" className="btv-studio-ledger-verify" data-intact={report?.intact} onClick={() => void verify()}>
          {report
            ? report.intact
              ? `✓ ${t('ledger.verify.intact', { total: report.entries })}`
              : `✕ ${t('ledger.verify.broken')}`
            : t('ledger.verify.action')}
        </button>
        <button type="button" className="btv-studio-ledger-export" onClick={exportXes}>
          {t('ledger.export.xes')}
        </button>
      </div>

      {report && (
        <div className="btv-studio-ledger-banner" data-intact={report.intact} role="status">
          {report.intact ? (
            <>
              <strong>{t('ledger.verify.intact', { total: report.entries })}</strong>
              <span className="btv-studio-mono">{t('ledger.banner.head', { hash: headHash })}</span>
              <span>{t('ledger.banner.verifiedAt', { when: formatWhen(report.verifiedAt) })}</span>
            </>
          ) : (
            <>
              <strong>{t('ledger.banner.broken', { index: report.firstBreak?.index ?? '' })}</strong>
              <span>{t('ledger.banner.brokenDetail')}</span>
            </>
          )}
          <button
            type="button"
            className="btv-studio-link"
            onClick={() => download('VerificationReport.json', JSON.stringify(report, null, 2), 'application/json')}
          >
            {t('ledger.download.report')}
          </button>
        </div>
      )}

      {anchorResult && (
        <div
          className="btv-studio-ledger-anchor"
          data-anchor-state={anchorResult.status}
          data-testid="anchor-banner"
          role="status"
        >
          {anchorResult.status === 'anchored' && (
            <>
              <strong>{t('ledger.anchor.anchored')}</strong>
              <span>
                {t('ledger.anchor.anchoredDetail', {
                  adapter: anchorResult.receipt!.adapterId,
                  when: formatWhen(anchorResult.receipt!.anchoredAt),
                })}
              </span>
              <span className="btv-studio-mono">{headHash.slice(0, 12)}…</span>
            </>
          )}
          {anchorResult.status === 'pending' && (
            <>
              <strong>{t('ledger.anchor.pending')}</strong>
              <span>{t('ledger.anchor.pendingDetail')}</span>
              <button
                type="button"
                className="btv-studio-ledger-retry-anchor"
                disabled={anchorRetrying}
                onClick={() => void retryAnchor()}
              >
                {anchorRetrying ? t('ledger.anchor.anchoring') : t('ledger.anchor.retry')}
              </button>
            </>
          )}
          {anchorResult.status === 'mismatch' && (
            <>
              <strong>{t('ledger.anchor.mismatch')}</strong>
              <span className="btv-studio-mono">
                {t('ledger.anchor.mismatchHashes', {
                  local: headHash.slice(0, 12),
                  anchored: anchorResult.receipt!.head.hash.slice(0, 12),
                })}
              </span>
              <span>
                {t('ledger.anchor.mismatchDetail', { seq: anchorResult.receipt!.head.seq })}
              </span>
            </>
          )}
        </div>
      )}

      {query && (
        <div className="btv-studio-ledger-query" data-testid="ledger-query">
          <input
            aria-label={t('ledger.query.aria')}
            data-testid="ledger-query-input"
            value={question}
            placeholder={t('ledger.query.placeholder')}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void askLedger();
            }}
          />
          <button
            type="button"
            data-testid="ledger-query-ask"
            disabled={asking || question.trim() === ''}
            onClick={() => void askLedger()}
          >
            ✦ {t('ledger.query.ask')}
          </button>
          {queryResult &&
            (queryResult.ok ? (
              <div className="btv-studio-ledger-answer" data-testid="ledger-query-answer">
                <p>{queryResult.answer}</p>
                <div className="btv-studio-ledger-citations">
                  {queryResult.citations.map((hash) => {
                    const entry = all.find((e) => e.hash === hash);
                    return (
                      <button
                        key={hash}
                        type="button"
                        className="btv-studio-ledger-citation btv-studio-mono"
                        data-testid="ledger-query-citation"
                        onClick={() => entry && setSelectedSeq(entry.seq)}
                      >
                        #{hash.slice(0, 12)}…{entry ? ` · ${entry.type}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="btv-studio-ledger-answer" data-testid="ledger-query-norecord">
                {t('ledger.query.noRecord')}
                <span className="btv-studio-muted"> · {queryResult.reason}</span>
              </div>
            ))}
        </div>
      )}

      <div className="btv-studio-ledger-body">
        {entries.length === 0 && (
          <p className="btv-studio-muted">{t('ledger.trail.empty')}</p>
        )}
        {entries.length > 0 && (
        <ol
          className="btv-studio-ledger-trail"
          // A listbox must contain options and a list only <li> children (a11y,
          // N-8): the whole <ol> renders only when the trail has entries; the
          // empty state is the plain <p> above.
          role="listbox"
          aria-label={t('ledger.trail.aria')}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const index = entries.findIndex((entry) => entry.seq === selected?.seq);
            const next = entries[Math.min(entries.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))];
            if (next) setSelectedSeq(next.seq);
          }}
        >
          {entries.map((entry) => {
            const category = categorizeEntry(entry);
            const isSelected = entry.seq === selected?.seq;
            return (
              <li key={entry.seq}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className="btv-studio-ledger-entry"
                  data-selected={isSelected || undefined}
                  data-untrusted={untrusted(entry) || undefined}
                  data-anchor-untrusted={anchorUntrusted(entry) || undefined}
                  data-seq={entry.seq}
                  onClick={() => setSelectedSeq(entry.seq)}
                >
                  <span className={dotClass(category)} aria-hidden />
                  <span className="btv-studio-ledger-line">
                    <span className={`btv-studio-ledger-type btv-studio-ledger-type-${category}`}>
                      {entry.type}
                    </span>
                    {aiAuthorOf(entry) && (
                      <span className="btv-studio-ledger-ai" data-testid="ledger-ai-seal">
                        ✦ {aiAuthorOf(entry)}
                      </span>
                    )}
                    <span className="btv-studio-ledger-title">
                      {entry.details['artifactId'] ? `${entry.details['artifactId']} · ` : ''}
                      {entry.versionId}
                    </span>
                    <span className="btv-studio-ledger-meta">
                      {entry.userId} · {formatWhen(entry.timestamp)} ·{' '}
                      <span className="btv-studio-mono">{entry.hash.slice(0, 12)}…</span>
                      {anchorUntrusted(entry) && (
                        <span className="btv-studio-ledger-untrusted-flag"> · {t('ledger.trail.untrusted')}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        )}

        {selected && (
          <aside className="btv-studio-ledger-detail" aria-label={t('ledger.detail.aria')}>
            <div className="btv-studio-ledger-hashblock btv-studio-mono">
              <div>{t('ledger.detail.index', { seq: selected.seq })}</div>
              <div>{t('ledger.detail.hash', { hash: selected.hash })}</div>
              <div>
                {t('ledger.detail.prev', {
                  hash: selected.previousHash || t('ledger.detail.genesis'),
                })}
              </div>
              <div>{t('ledger.detail.author', { author: selected.userId })}</div>
              <div>{t('ledger.detail.when', { when: formatWhen(selected.timestamp) })}</div>
              <div data-testid="entry-trust">
                {report
                  ? untrusted(selected)
                    ? `${t('ledger.detail.trust.untrusted')} ✕`
                    : `${t('ledger.detail.trust.intact')} ✓`
                  : t('ledger.detail.trust.unverified')}
              </div>
            </div>
            <section className="btv-studio-ledger-payload">
              <span className="btv-studio-kicker">{t('ledger.detail.payload')}</span>
              {describeEntry(selected).map((line) => (
                <p key={line} className="btv-studio-box-line">
                  {line}
                </p>
              ))}
            </section>
            {attestation && (
              <section className="btv-studio-ledger-attestation">
                <span className="btv-studio-kicker">{t('ledger.detail.attestation')}</span>
                {['xmlHash', 'ledgerHeadHash', 'effectiveFrom'].map((key) =>
                  attestation[key] !== undefined ? (
                    <p key={key} className="btv-studio-box-line btv-studio-mono">
                      {key}: {String(attestation[key])}
                    </p>
                  ) : null,
                )}
                {Array.isArray(attestation['approvers']) && (
                  <p className="btv-studio-box-line">
                    {t('ledger.detail.approvers', {
                      list: (attestation['approvers'] as Array<{ userId?: string } | string>)
                        .map((a) => (typeof a === 'string' ? a : (a.userId ?? '?')))
                        .join(', '),
                    })}
                  </p>
                )}
                <button
                  type="button"
                  className="btv-studio-link"
                  onClick={() =>
                    download('attestation.json', JSON.stringify(attestation, null, 2), 'application/json')
                  }
                >
                  {t('ledger.download.attestation')}
                </button>
              </section>
            )}
            {evidence && (
              <section className="btv-studio-ledger-evidence" data-evidence-bundle>
                <span className="btv-studio-kicker">{t('ledger.detail.evidence')}</span>
                {/* The three governance refs are the point — a bundle that hid its
                    masking policy would not have rendered (evidenceOf returns undefined). */}
                <p className="btv-studio-box-line btv-studio-mono" data-evidence-masking>
                  {t('ledger.detail.evidence.masking', { ref: evidence.maskingPolicyRef })}
                </p>
                <p className="btv-studio-box-line">
                  {t('ledger.detail.evidence.policies', { list: evidence.policyRefs.join(', ') || '—' })}
                </p>
                <p className="btv-studio-box-line">
                  {t('ledger.detail.evidence.decisionRules', { list: evidence.decisionRuleRefs.join(', ') || '—' })}
                </p>
                <p className="btv-studio-box-line">
                  {t('ledger.detail.evidence.facts', { count: evidence.factCount })}
                  {' · '}
                  {evidence.blocked
                    ? t('ledger.detail.evidence.blocked')
                    : evidence.complete
                      ? t('ledger.detail.evidence.complete')
                      : t('ledger.detail.evidence.incomplete')}
                </p>
                <button
                  type="button"
                  className="btv-studio-link"
                  onClick={() =>
                    download('evidence-bundle.json', JSON.stringify(selected.details, null, 2), 'application/json')
                  }
                >
                  {t('ledger.download.evidence')}
                </button>
              </section>
            )}
            {onAction && (
              <div className="btv-studio-ledger-actions">
                <button type="button" onClick={() => onAction({ id: 'diff', entry: selected })}>
                  {t('ledger.action.diff')}
                </button>
                <button type="button" onClick={() => onAction({ id: 'open-designer', entry: selected })}>
                  {t('ledger.action.openDesigner')}
                </button>
              </div>
            )}
            <button
              type="button"
              className="btv-studio-link"
              onClick={() => setFilter({ ...filter, artifactId: (selected.details['artifactId'] as string) ?? selected.versionId })}
            >
              {t('ledger.action.filterArtifact')}
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
