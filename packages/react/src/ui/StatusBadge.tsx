import type { VersionStatus } from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';

/**
 * Canonical seal labels (Handoff 3 §5 — "usar em TODO o produto"). Labels are
 * presentation; `data-status` is the machine-readable contract. Colors live in
 * styles.css under `[data-status]` so themes can override them.
 */
const STATUS_LABELS: Record<VersionStatus, string> = {
  draft: 'RASCUNHO',
  test: 'TESTE INTERNO',
  candidate: 'CANDIDATA',
  active: 'ATIVA',
  deprecated: 'DESCONTINUADA',
  retired: 'ARQUIVADA',
};

export interface StatusBadgeProps {
  /**
   * Publication channel shown in the candidate meta line ("canal: piloto").
   * A registry concept (`Publication.channel`) — the host passes it in;
   * omitted, the segment is dropped.
   */
  channel?: string;
}

/**
 * Vigência seal (StatusBadge v2, Handoff 2 §B1): status pill + semver + a
 * meta line derived from the version record and the lifecycle engine —
 * "aguarda N aprovações" always reflects the engine config, never a constant.
 */
export function StatusBadge({ channel }: StatusBadgeProps) {
  const { diagram } = useDiagram();
  const { lifecycleEngine } = useEditorConfig();
  const { status, semanticVersion, approvedBy, effectiveFrom, effectiveUntil } = diagram.version;
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.draft;

  const distinctRoles = [...new Set(approvedBy.map((a) => a.role))];
  let meta: string | undefined;
  if (status === 'candidate') {
    const waiting = Math.max(0, lifecycleEngine.requiredApprovalRoles - distinctRoles.length);
    const prefix = channel ? `canal: ${channel} · ` : '';
    meta =
      waiting === 0
        ? `${prefix}pronta para ativação`
        : `${prefix}aguarda ${waiting} ${waiting === 1 ? 'aprovação' : 'aprovações'}`;
  } else if (status === 'active') {
    const parts: string[] = [];
    if (effectiveFrom) parts.push(`vigente desde ${formatDate(effectiveFrom)}`);
    if (distinctRoles.length > 0) parts.push(`aprovada por ${distinctRoles.join(', ')}`);
    meta = parts.length > 0 ? parts.join(' · ') : undefined;
  } else if ((status === 'deprecated' || status === 'retired') && effectiveUntil) {
    meta = `vigente até ${formatDate(effectiveUntil)}`;
  }

  return (
    <span
      className="bpmnr-status-badge"
      data-status={status}
      role="status"
      aria-label={`Version ${semanticVersion}, status ${label}`}
    >
      <span className="bpmnr-status-pill">
        <span className="bpmnr-status-dot" aria-hidden />
        {label}
      </span>
      <code className="bpmnr-status-semver">v{semanticVersion}</code>
      {meta && <span className="bpmnr-status-meta">{meta}</span>}
    </span>
  );
}

/** ISO timestamp → dd/mm/aaaa (pt-BR); falls back to the raw date part. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
