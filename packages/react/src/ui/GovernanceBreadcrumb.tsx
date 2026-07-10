import type { VersionStatus } from '@buildtovalue/core';
import { useT } from '../i18n/I18nContext.js';

/**
 * One level of the governance breadcrumb (Handoff 5 §10.3): a name plus its
 * governance identity — semver and vigência seal. `id` is what `onNavigate`
 * receives (null conventionally means the root surface).
 */
export interface GovernanceBreadcrumbLevel {
  id: string | null;
  label: string;
  semanticVersion?: string;
  status?: VersionStatus;
}

export interface GovernanceBreadcrumbProps {
  /** Trail from the root to the current level (last = current, not a link). */
  levels: GovernanceBreadcrumbLevel[];
  /** Called with the clicked level's id + index (never the last level). */
  onNavigate: (id: string | null, index: number) => void;
  /** Accessible name of the nav landmark. */
  ariaLabel?: string;
}

/**
 * System component for hierarchical navigation (Handoff 5 §7.6/§10.3): every
 * level carries its semver + StatusBadge seal, so drilling never loses the
 * governance context. One pair of gestures for the whole family — double-
 * click goes down, breadcrumb (or Esc, when nothing else is open) goes up.
 * Serves the expanded sub-process today and the DMN surfaces in F-B2 — one
 * import for both (aceite 10.5.3).
 */
export function GovernanceBreadcrumb({
  levels,
  onNavigate,
  ariaLabel,
}: GovernanceBreadcrumbProps) {
  const t = useT();
  if (levels.length === 0) return null;
  return (
    <nav className="bpmnr-breadcrumb" aria-label={ariaLabel ?? t('breadcrumb.aria')}>
      {levels.map((level, index) => {
        const last = index === levels.length - 1;
        const identity = (
          <>
            {level.label}
            {level.semanticVersion && (
              <span className="bpmnr-breadcrumb-semver">v{level.semanticVersion}</span>
            )}
            {level.status && (
              <span className="bpmnr-breadcrumb-seal" data-status={level.status}>
                {t(`status.${level.status}`)}
              </span>
            )}
          </>
        );
        return (
          <span key={`${level.id ?? 'root'}-${index}`} className="bpmnr-breadcrumb-item">
            {index > 0 && (
              <span className="bpmnr-breadcrumb-sep" aria-hidden="true">
                ›
              </span>
            )}
            {last ? (
              <span className="bpmnr-breadcrumb-current" aria-current="page">
                {identity}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(level.id, index)}
                aria-label={index === 0 ? t('breadcrumb.back') : undefined}
              >
                {identity}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
