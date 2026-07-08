import type { VersionStatus } from '@bpmn-react/core';

/**
 * One entry on the timeline. Deliberately a plain, self-contained shape —
 * the component does **not** import `@bpmn-react/registry`, so the React
 * layer stays decoupled from governance storage. A host maps its registry
 * entries (or any version source) to this shape.
 */
export interface VersionTimelineItem {
  id: string;
  semanticVersion: string;
  status: VersionStatus;
  changeSummary?: string;
  /** Approver labels (roles or names) to show as chips. */
  approvers?: string[];
  /** Live publication lane, e.g. "pilot" or "general/prod". */
  channel?: string;
  /** ISO timestamp the version took effect. */
  effectiveFrom?: string;
  /** Marks the currently-selected/active entry. */
  current?: boolean;
}

export interface VersionTimelineProps {
  items: VersionTimelineItem[];
  onSelect?: (id: string) => void;
  /** Newest-first (default) or oldest-first. */
  order?: 'desc' | 'asc';
}

/** Canonical seal colors (Handoff 3 §5) — same tokens as the StatusBadge. */
const STATUS_COLOR: Record<VersionStatus, { bg: string; fg: string }> = {
  draft: { bg: 'var(--bpmnr-status-draft, #faf9f6)', fg: 'var(--bpmnr-status-draft-fg, #44403a)' },
  test: { bg: 'var(--bpmnr-status-test, #e3ecf7)', fg: 'var(--bpmnr-status-test-fg, #33567e)' },
  candidate: { bg: 'var(--bpmnr-status-candidate, #f6edd4)', fg: 'var(--bpmnr-status-candidate-fg, #7a611e)' },
  active: { bg: 'var(--bpmnr-status-active, #dff0e6)', fg: 'var(--bpmnr-status-active-fg, #1a6a54)' },
  deprecated: { bg: 'var(--bpmnr-status-deprecated, #f7e6e0)', fg: 'var(--bpmnr-status-deprecated-fg, #b3372f)' },
  retired: { bg: 'var(--bpmnr-status-retired, #efece6)', fg: 'var(--bpmnr-status-retired-fg, #6f675a)' },
};

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A vertical timeline of diagram versions with status, effective date,
 * approvers and live channel — the visual "seal" of the governance history.
 * Presentational and controlled: it renders the `items` it's given and
 * reports selection through `onSelect`.
 */
export function VersionTimeline({ items, onSelect, order = 'desc' }: VersionTimelineProps) {
  const ordered = order === 'asc' ? items : [...items].reverse();
  return (
    <ol className="bpmnr-timeline" aria-label="Version history">
      {ordered.length === 0 && <li className="bpmnr-timeline-empty">No versions yet</li>}
      {ordered.map((item) => {
        const color = STATUS_COLOR[item.status] ?? STATUS_COLOR.draft;
        const date = formatDate(item.effectiveFrom);
        const interactive = Boolean(onSelect);
        return (
          <li
            key={item.id}
            className="bpmnr-timeline-item"
            data-version-id={item.id}
            data-current={item.current ? 'true' : undefined}
            aria-current={item.current ? 'true' : undefined}
          >
            <span className="bpmnr-timeline-dot" style={{ background: color.fg }} aria-hidden />
            <button
              type="button"
              className="bpmnr-timeline-body"
              disabled={!interactive}
              onClick={interactive ? () => onSelect!(item.id) : undefined}
            >
              <span className="bpmnr-timeline-head">
                <strong>v{item.semanticVersion}</strong>
                <span
                  className="bpmnr-timeline-status"
                  style={{ background: color.bg, color: color.fg }}
                >
                  {item.status}
                </span>
                {item.channel && <span className="bpmnr-timeline-channel">{item.channel}</span>}
                {date && (
                  <span className="bpmnr-timeline-date" title={item.effectiveFrom}>
                    {date}
                  </span>
                )}
              </span>
              {item.changeSummary && (
                <span className="bpmnr-timeline-summary">{item.changeSummary}</span>
              )}
              {item.approvers && item.approvers.length > 0 && (
                <span className="bpmnr-timeline-approvers">
                  {item.approvers.map((approver, index) => (
                    <span key={index} className="bpmnr-timeline-approver">
                      {approver}
                    </span>
                  ))}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
