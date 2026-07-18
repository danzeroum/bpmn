import type { Messages } from '../messages.js';

/**
 * Versioning & governance dictionary fragment (Handoff 11 N-6). Covers the
 * version banner/timeline, diff view, governance breadcrumb, and the shared
 * status/signature seals. Keys are namespaced by surface (`version.*`,
 * `diff.*`, `breadcrumb.*`, `status.*`, `signature.*`); the `status.*` seal
 * labels are the single canonical set every governance surface reuses. Plural
 * pairs use `_one` / `_other`.
 */
export const versioning: { en: Messages; ptBR: Messages } = {
  en: {
    // VersionBanner
    'version.banner.aria': 'Version context',
    'version.banner.viewing': 'VIEWING v{version} · read-only',
    'version.banner.closed_one': '{count} element closed in this version',
    'version.banner.closed_other': '{count} elements closed in this version',
    // VersionTimeline
    'version.timeline.aria': 'Version history',
    'version.timeline.empty': 'No versions yet',
    'version.timeline.pinnedRuns_one': '{count} pinned run',
    'version.timeline.pinnedRuns_other': '{count} pinned runs',
    'version.timeline.validityRange': 'effective {from} → {until}',
    'version.timeline.validityFrom': 'effective since {from}',
    // DiffView
    'diff.empty': 'No changes.',
    'diff.aria': 'Diagram changes',
    'diff.nodes': 'Nodes',
    'diff.connections': 'Connections',
    'diff.metadata': 'Metadata',
    'diff.supersededBy': 'superseded by',
    // GovernanceBreadcrumb
    'breadcrumb.aria': 'Governance breadcrumb',
    'breadcrumb.back': 'Back to process',
    // StatusBadge — canonical seal labels (shared across every governance surface)
    'status.draft': 'DRAFT',
    'status.test': 'INTERNAL TEST',
    'status.candidate': 'CANDIDATE',
    'status.in-review': '⟲ IN REVIEW',
    'status.active': 'ACTIVE',
    'status.deprecated': 'DEPRECATED',
    'status.retired': 'ARCHIVED',
    'status.aria': 'Version {version}, status {status}',
    'status.channel': 'channel: {channel}',
    'status.readyToActivate': 'ready for activation',
    'status.awaitingApprovals_one': 'awaiting {count} approval',
    'status.awaitingApprovals_other': 'awaiting {count} approvals',
    'status.effectiveSince': 'effective since {date}',
    'status.approvedBy': 'approved by {roles}',
    'status.effectiveUntil': 'effective until {date}',
    // SignatureBadge
    'signature.valid': 'SIGNED · VERIFIED',
    'signature.legacy': 'NOT SIGNED (LEGACY)',
    'signature.invalid': 'INVALID SIGNATURE',
    'signature.aria': 'Signature: {label}',
    'signature.mismatch': 'expected {expected} · current payload produces {obtained}',
  },
  ptBR: {
    // VersionBanner
    'version.banner.aria': 'Contexto de versão',
    'version.banner.viewing': 'VISUALIZANDO v{version} · somente leitura',
    'version.banner.closed_one': '{count} elemento fechado nesta versão',
    'version.banner.closed_other': '{count} elementos fechados nesta versão',
    // VersionTimeline
    'version.timeline.aria': 'Histórico de versões',
    'version.timeline.empty': 'Nenhuma versão ainda',
    'version.timeline.pinnedRuns_one': '{count} execução presa',
    'version.timeline.pinnedRuns_other': '{count} execuções presas',
    'version.timeline.validityRange': 'vigente {from} → {until}',
    'version.timeline.validityFrom': 'vigente desde {from}',
    // DiffView
    'diff.empty': 'Nenhuma alteração.',
    'diff.aria': 'Alterações do diagrama',
    'diff.nodes': 'Nós',
    'diff.connections': 'Conexões',
    'diff.metadata': 'Metadados',
    'diff.supersededBy': 'substituída por',
    // GovernanceBreadcrumb
    'breadcrumb.aria': 'Trilha de governança',
    'breadcrumb.back': 'Voltar ao processo',
    // StatusBadge — rótulos canônicos do selo (compartilhados por toda superfície de governança)
    'status.draft': 'RASCUNHO',
    'status.test': 'TESTE INTERNO',
    'status.candidate': 'CANDIDATA',
    'status.in-review': '⟲ EM REVISÃO',
    'status.active': 'ATIVA',
    'status.deprecated': 'DESCONTINUADA',
    'status.retired': 'ARQUIVADA',
    'status.aria': 'Versão {version}, status {status}',
    'status.channel': 'canal: {channel}',
    'status.readyToActivate': 'pronta para ativação',
    'status.awaitingApprovals_one': 'aguarda {count} aprovação',
    'status.awaitingApprovals_other': 'aguarda {count} aprovações',
    'status.effectiveSince': 'vigente desde {date}',
    'status.approvedBy': 'aprovada por {roles}',
    'status.effectiveUntil': 'vigente até {date}',
    // SignatureBadge
    'signature.valid': 'ASSINADA · VERIFICADA',
    'signature.legacy': 'NÃO ASSINADA (LEGADO)',
    'signature.invalid': 'ASSINATURA INVÁLIDA',
    'signature.aria': 'Assinatura: {label}',
    'signature.mismatch': 'esperado {expected} · payload atual produz {obtained}',
  },
};
