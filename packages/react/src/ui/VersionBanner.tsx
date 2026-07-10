import { useCanvasState } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Fixed top-left canvas banner (Handoff 5 §5, 5b mitigada; aceite 10.5.6):
 * "🔒 VISUALIZANDO vX.Y · somente leitura · N elementos fechados nesta
 * versão". Present whenever the surface is NOT the editable active line —
 * a read-only view (BpmnViewer / host snapshot view) or a superseded
 * version (deprecated/retired). The per-element seal is hover/selection
 * only, so this banner is the always-visible version context.
 */
export function VersionBanner() {
  const t = useT();
  const { diagram } = useDiagram();
  const readOnly = useCanvasState((s) => s.readOnly);
  const { status, semanticVersion } = diagram.version;
  const superseded = status === 'deprecated' || status === 'retired';
  if (!readOnly && !superseded) return null;

  const closedCount =
    Object.values(diagram.nodes).filter((node) => node.removedInVersion !== undefined).length +
    Object.values(diagram.edges).filter((edge) => edge.removedInVersion !== undefined).length;

  return (
    // role="note": persistent context, not a live region — the StatusBadge
    // already owns the single role="status" of the editor chrome.
    <div
      className="bpmnr-version-banner"
      role="note"
      aria-label={t('version.banner.aria')}
      data-version-banner={status}
    >
      <span aria-hidden>🔒</span> {t('version.banner.viewing', { version: semanticVersion })}
      {closedCount > 0 && ` · ${t('version.banner.closed', { count: closedCount })}`}
    </div>
  );
}
