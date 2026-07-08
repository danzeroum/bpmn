import { useEffect, useMemo, useState } from 'react';
import type { AuditEntry } from '@bpmn-react/core';
import { toXES, verifyLedger, type LedgerLike, type VerificationReport } from '@bpmn-react/audit';
import type { VersionRegistry } from '@bpmn-react/registry';
import {
  LEDGER_CATEGORIES,
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

function formatWhen(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

/**
 * TELA 3 — Ledger Explorer (Handoff 6 §6): filter bar + vertical trail
 * (max 720px) + detail column (340px). Read-only: verification, export and
 * navigation only — the chain is never mutated here.
 */
export function LedgerExplorer({ ledger, registry, onAction, onDownload, initialFilter }: LedgerExplorerProps) {
  const [filter, setFilter] = useState<LedgerFilter>(initialFilter ?? {});
  const [selectedSeq, setSelectedSeq] = useState<number>();
  const [report, setReport] = useState<VerificationReport>();

  const all = entriesOf(ledger);
  const { entries, counts } = useMemo(() => filterEntries(all, filter), [all, filter]);
  const selected = entries.find((e) => e.seq === selectedSeq) ?? entries[0];
  const download = onDownload ?? browserDownload;

  useEffect(() => {
    setReport(undefined);
  }, [ledger]);

  const verify = async () => {
    setReport(await verifyLedger(ledger));
  };

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

  return (
    <div className="btv-studio-ledger" data-testid="ledger-explorer">
      <div className="btv-studio-ledger-toolbar">
        <div className="btv-studio-chip-row" aria-label="Filtro por categoria">
          <button
            type="button"
            className="btv-studio-chip"
            aria-pressed={!filter.categories?.length}
            onClick={() => setFilter({ ...filter, categories: [] })}
          >
            Todos <span className="btv-studio-chip-count">{counts.total}</span>
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
              artefato: {filter.artifactId} ✕
            </button>
          )}
        </div>
        <span className="btv-studio-spacer" />
        <button type="button" className="btv-studio-ledger-verify" data-intact={report?.intact} onClick={() => void verify()}>
          {report ? (report.intact ? `✓ Cadeia íntegra (${report.entries}/${report.entries})` : '✕ Cadeia quebrada') : 'Verificar cadeia'}
        </button>
        <button type="button" className="btv-studio-ledger-export" onClick={exportXes}>
          Exportar XES
        </button>
      </div>

      {report && (
        <div className="btv-studio-ledger-banner" data-intact={report.intact} role="status">
          {report.intact ? (
            <>
              <strong>Cadeia íntegra ({report.entries}/{report.entries})</strong>
              <span className="btv-studio-mono">head {headHash}</span>
              <span>SHA-256 · verificado em {formatWhen(report.verifiedAt)}</span>
            </>
          ) : (
            <>
              <strong>Cadeia quebrada na entrada {report.firstBreak?.index}</strong>
              <span>
                Esta entrada e todas as posteriores não são confiáveis — o hash declarado diverge do
                recomputado.
              </span>
            </>
          )}
          <button
            type="button"
            className="btv-studio-link"
            onClick={() => download('VerificationReport.json', JSON.stringify(report, null, 2), 'application/json')}
          >
            baixar VerificationReport.json
          </button>
        </div>
      )}

      <div className="btv-studio-ledger-body">
        <ol
          className="btv-studio-ledger-trail"
          role="listbox"
          aria-label="Trilha do ledger"
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
                  data-seq={entry.seq}
                  onClick={() => setSelectedSeq(entry.seq)}
                >
                  <span className={dotClass(category)} aria-hidden />
                  <span className="btv-studio-ledger-line">
                    <span className={`btv-studio-ledger-type btv-studio-ledger-type-${category}`}>
                      {entry.type}
                    </span>
                    <span className="btv-studio-ledger-title">
                      {entry.details['artifactId'] ? `${entry.details['artifactId']} · ` : ''}
                      {entry.versionId}
                    </span>
                    <span className="btv-studio-ledger-meta">
                      {entry.userId} · {formatWhen(entry.timestamp)} ·{' '}
                      <span className="btv-studio-mono">{entry.hash.slice(0, 12)}…</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {entries.length === 0 && <p className="btv-studio-muted">Nenhum evento nos filtros atuais.</p>}
        </ol>

        {selected && (
          <aside className="btv-studio-ledger-detail" aria-label="Detalhe da entrada">
            <div className="btv-studio-ledger-hashblock btv-studio-mono">
              <div>index: {selected.seq}</div>
              <div>hash: {selected.hash}</div>
              <div>prev: {selected.previousHash || '(gênese)'}</div>
              <div>autor: {selected.userId}</div>
              <div>quando: {formatWhen(selected.timestamp)}</div>
              <div data-testid="entry-trust">
                {report
                  ? untrusted(selected)
                    ? 'não-confiável ✕'
                    : 'íntegra ✓'
                  : 'não verificada'}
              </div>
            </div>
            <section className="btv-studio-ledger-payload">
              <span className="btv-studio-kicker">PAYLOAD</span>
              {describeEntry(selected).map((line) => (
                <p key={line} className="btv-studio-box-line">
                  {line}
                </p>
              ))}
            </section>
            {attestation && (
              <section className="btv-studio-ledger-attestation">
                <span className="btv-studio-kicker">ATTESTATION</span>
                {['xmlHash', 'ledgerHeadHash', 'effectiveFrom'].map((key) =>
                  attestation[key] !== undefined ? (
                    <p key={key} className="btv-studio-box-line btv-studio-mono">
                      {key}: {String(attestation[key])}
                    </p>
                  ) : null,
                )}
                {Array.isArray(attestation['approvers']) && (
                  <p className="btv-studio-box-line">
                    aprovadores:{' '}
                    {(attestation['approvers'] as Array<{ userId?: string } | string>)
                      .map((a) => (typeof a === 'string' ? a : (a.userId ?? '?')))
                      .join(', ')}
                  </p>
                )}
                <button
                  type="button"
                  className="btv-studio-link"
                  onClick={() =>
                    download('attestation.json', JSON.stringify(attestation, null, 2), 'application/json')
                  }
                >
                  baixar attestation.json
                </button>
              </section>
            )}
            {onAction && (
              <div className="btv-studio-ledger-actions">
                <button type="button" onClick={() => onAction({ id: 'diff', entry: selected })}>
                  Ver diff desta mudança
                </button>
                <button type="button" onClick={() => onAction({ id: 'open-designer', entry: selected })}>
                  Abrir versão no Designer (leitura)
                </button>
              </div>
            )}
            <button
              type="button"
              className="btv-studio-link"
              onClick={() => setFilter({ ...filter, artifactId: (selected.details['artifactId'] as string) ?? selected.versionId })}
            >
              filtrar por este artefato
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
