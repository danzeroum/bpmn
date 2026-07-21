import type { ArtifactAction, ArtifactDetail, ArtifactRef } from '@buildtovalue/library';
import { I18nProvider, StatusBadge, useT, type Messages } from '@buildtovalue/react';

export interface ArtifactDrawerProps {
  detail: ArtifactDetail;
  onAction: (ref: ArtifactRef, action: ArtifactAction) => void;
  onClose: () => void;
  /** i18n dictionary (#151) — prop wins, then ancestor provider, then English. */
  messages?: Messages;
}

/** ISO timestamp → dd/mm/aaaa (pt-BR); falls back to the raw date part. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

/**
 * Detail drawer (Handoff 3 §5 / Handoff 6 §4): kicker, name, seal, then
 * ONLY the sections the adapter provided — optional fields → optional UI,
 * never "N/A". Actions are descriptors the host resolves (§3.2); the drawer
 * renders buttons and mutates nothing.
 */
export function ArtifactDrawer({ messages, ...props }: ArtifactDrawerProps) {
  const body = <ArtifactDrawerBody {...props} />;
  return messages !== undefined ? <I18nProvider messages={messages}>{body}</I18nProvider> : body;
}

function ArtifactDrawerBody({ detail, onAction, onClose }: Omit<ArtifactDrawerProps, 'messages'>) {
  const t = useT();
  const hasVigencia = detail.effectiveFrom || detail.effectiveUntil;
  const hasAprovacao = (detail.approvers?.length ?? 0) > 0 || detail.changeSummary;
  return (
    <aside className="btv-lib-drawer" aria-label={t('library.drawer.aria', { name: detail.name })}>
      <div className="btv-lib-drawer-head">
        <span className="btv-lib-kicker">{t('library.drawer.kicker', { type: detail.typeLabel })}</span>
        <button
          type="button"
          className="btv-lib-drawer-close"
          onClick={onClose}
          aria-label={t('library.drawer.closeAria')}
        >
          ✕
        </button>
      </div>
      <h2 className="btv-lib-drawer-name">{detail.name}</h2>
      <div className="btv-lib-drawer-seal">
        <StatusBadge seal={{ status: detail.status, semanticVersion: detail.version }} channel={detail.channel} />
      </div>

      {(hasVigencia || hasAprovacao) && (
        <section className="btv-lib-box">
          {detail.effectiveFrom && (
            <p className="btv-lib-box-line">
              <strong>{t('library.drawer.effective')}</strong>{' '}
              {t('library.drawer.effectiveSince', { date: formatDate(detail.effectiveFrom) })}
              {detail.effectiveUntil
                ? ` ${t('library.drawer.effectiveUntil', { date: formatDate(detail.effectiveUntil) })}`
                : ''}
            </p>
          )}
          {!detail.effectiveFrom && detail.effectiveUntil && (
            <p className="btv-lib-box-line">
              <strong>{t('library.drawer.effective')}</strong>{' '}
              {t('library.drawer.effectiveUntil', { date: formatDate(detail.effectiveUntil) })}
            </p>
          )}
          {(detail.approvers?.length ?? 0) > 0 && (
            <p className="btv-lib-box-line">
              <strong>{t('library.drawer.approval')}</strong> {detail.approvers!.join(', ')}
            </p>
          )}
          {detail.changeSummary && <blockquote className="btv-lib-quote">{detail.changeSummary}</blockquote>}
        </section>
      )}

      {detail.provenance && (
        <section className="btv-lib-box btv-lib-provenance">
          <span className="btv-lib-kicker">{t('library.drawer.provenance')}</span>
          <p className="btv-lib-box-line btv-lib-mono">{detail.provenance.ledgerHash}</p>
          <p className="btv-lib-box-line">
            {detail.provenance.author} · {formatDate(detail.provenance.createdAt)}
          </p>
        </section>
      )}

      {detail.versions.length > 0 && (
        <section className="btv-lib-box">
          <span className="btv-lib-kicker">{t('library.drawer.versions')}</span>
          <ol className="btv-lib-timeline">
            {detail.versions.map((entry) => (
              <li key={`${entry.version}-${entry.timestamp ?? ''}`} className="btv-lib-timeline-item">
                <span className="btv-lib-timeline-dot" data-status={entry.status} aria-hidden />
                <code className="btv-lib-mono">v{entry.version}</code>
                <span className="btv-lib-timeline-note">
                  {entry.note}
                  {entry.timestamp ? ` · ${formatDate(entry.timestamp)}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {detail.actions.length > 0 && (
        <div className="btv-lib-actions">
          {detail.actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className={index === 0 ? 'btv-lib-action btv-lib-action-primary' : 'btv-lib-action'}
              data-action={action.id}
              onClick={() => onAction(detail.ref, action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
