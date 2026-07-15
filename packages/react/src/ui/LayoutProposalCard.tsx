import { useCallback, useEffect } from 'react';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { reducedMotion } from '../canvas/viewport.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Auto-layout proposal card (Handoff 14 §1e, cerca §1.7 — nothing silent):
 * "Arrumar" only PROPOSES. While this card is open the canvas shows dashed
 * ghosts at the target positions (LayoutPreviewOverlay); Aplicar executes the
 * ONE composite (moves + rigid 📍 translations) and plays a 160ms crossfade
 * of the old positions (reduced-motion → none); Recusar — or Esc via the
 * dismissal stack — discards it and NOTHING changes. A proposal computed
 * against a diagram that has since changed is discarded automatically.
 */
export function LayoutProposalCard() {
  const { diagram, execute } = useDiagram();
  const store = useCanvasStore();
  const proposal = useCanvasState((s) => s.layoutProposal);
  const t = useT();

  const refuse = useCallback(() => store.setState({ layoutProposal: null }), [store]);
  useDismissal('layout-proposal', proposal !== null, refuse);

  // Stale guard: any command/undo while the card is open invalidates the
  // computed positions — discard rather than apply against the wrong base.
  useEffect(() => {
    if (proposal && proposal.baseDiagram !== diagram) refuse();
  }, [proposal, diagram, refuse]);

  if (!proposal) return null;

  const apply = () => {
    execute(proposal.command);
    store.setState({
      layoutProposal: null,
      ...(reducedMotion()
        ? {}
        : {
            layoutSettle: {
              ghosts: proposal.moved.map((m) => ({
                id: m.id,
                x: m.from.x,
                y: m.from.y,
                width: m.width,
                height: m.height,
              })),
              token: Date.now(),
            },
          }),
    });
  };

  return (
    <div
      className="bpmnr-layout-card"
      role="dialog"
      aria-label={t('layout.title')}
      data-testid="layout-proposal"
    >
      <strong>
        {/* i18n-exempt — the proposal spark glyph stays literal */}✦ {t('layout.title')}
      </strong>
      <p className="bpmnr-layout-card-counts" data-testid="layout-counts">
        {t('layout.moved', { count: proposal.moved.length })}
        {' · '}
        {t('layout.rerouted', { count: proposal.reroutedCount })}
        {' · '}
        {t('layout.manual', { count: proposal.manualCount })}
      </p>
      <div className="bpmnr-layout-card-actions">
        <button type="button" data-testid="layout-apply" onClick={apply}>
          {t('layout.apply')}
        </button>
        <button type="button" data-testid="layout-refuse" onClick={refuse}>
          {t('layout.refuse')}
        </button>
      </div>
    </div>
  );
}
