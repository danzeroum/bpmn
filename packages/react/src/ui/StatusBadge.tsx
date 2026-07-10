import type { VersionStatus } from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';

/**
 * Canonical seal labels (Handoff 3 §5 — "usar em TODO o produto"). Labels are
 * presentation; `data-status` is the machine-readable contract. Colors live in
 * styles.css under `[data-status]` so themes can override them. Shared with
 * the VersionTimeline so every seal in the product reads the same.
 */
export const SEAL_LABELS: Record<VersionStatus, string> = {
  draft: 'RASCUNHO',
  test: 'TESTE INTERNO',
  candidate: 'CANDIDATA',
  active: 'ATIVA',
  deprecated: 'DESCONTINUADA',
  retired: 'ARQUIVADA',
};

/**
 * Standalone seal data (Handoff 6 §10.6): screens outside the editor
 * (Biblioteca, Revisão, Ledger Explorer) render the SAME component from
 * explicit data instead of the editor contexts. `meta` is precomputed by the
 * host — engine-derived lines ("aguarda N aprovações") only exist where a
 * lifecycle engine does.
 */
export interface StatusBadgeSeal {
  status: VersionStatus;
  semanticVersion: string;
  meta?: string;
}

export interface StatusBadgeProps {
  /**
   * Publication channel shown in the candidate meta line ("canal: piloto").
   * A registry concept (`Publication.channel`) — the host passes it in;
   * omitted, the segment is dropped.
   */
  channel?: string;
  /**
   * Standalone mode: render this seal directly, requiring no editor context.
   * Omitted, the badge reads the surrounding <BpmnDesigner>/<BpmnViewer>.
   */
  seal?: StatusBadgeSeal;
}

/**
 * Vigência seal (StatusBadge v2, Handoff 2 §B1): status pill + semver + a
 * meta line derived from the version record and the lifecycle engine —
 * "aguarda N aprovações" always reflects the engine config, never a constant.
 */
export function StatusBadge({ channel, seal }: StatusBadgeProps) {
  if (seal) {
    const meta = seal.meta ?? (channel ? `canal: ${channel}` : undefined);
    return <SealMarkup status={seal.status} semanticVersion={seal.semanticVersion} meta={meta} />;
  }
  return <EditorStatusBadge channel={channel} />;
}

function EditorStatusBadge({ channel }: { channel?: string }) {
  const { diagram } = useDiagram();
  const { lifecycleEngine } = useEditorConfig();
  const { status, semanticVersion, approvedBy, effectiveFrom, effectiveUntil } = diagram.version;

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

  return <SealMarkup status={status} semanticVersion={semanticVersion} meta={meta} />;
}

/** The single seal markup both modes share — one component, one table (§10.6). */
function SealMarkup({
  status,
  semanticVersion,
  meta,
}: {
  status: VersionStatus;
  semanticVersion: string;
  meta?: string;
}) {
  const label = SEAL_LABELS[status] ?? SEAL_LABELS.draft;
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
