import { useMemo } from 'react';
import {
  SQUAD_EDGE_KINDS,
  type ContextContract,
  type SquadEdgeKind,
  type SquadManifest,
} from '@buildtovalue/agentflow';
import { BpmnDesigner } from '../BpmnDesigner.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useT } from '../i18n/I18nContext.js';
import { EN } from '../i18n/en.js';
import { translate, type Messages } from '../i18n/messages.js';
import { buildSquadDiagram } from './squadDiagram.js';
import { createSquadPlugin, SQUAD_EDGE_GLYPH } from './squadPlugin.js';

/**
 * Squad Studio (Squad Lane SL-9) — a SquadManifest rendered as a STANDARD BPMN
 * diagram by instantiating the existing editor with a squad plugin (never a new
 * canvas/fork; zoom/pan/keyboard navigation/inspection are reused). The manifest
 * is the source of truth; the diagram is its DETERMINISTIC projection.
 *
 * The diagram is READ-ONLY on purpose (structural view). A projection with no
 * write-back must not accept mutation gestures (drag/connect/delete), or an edit
 * would vanish on the next projection — silent loss, which the doctrine forbids.
 * Squad editing happens via the manifest UI; the full manifest↔diagram round-trip
 * (edits mapped back to manifest commands) is a registered pendência, not SL-9.
 * Read-only keeps every INSPECTION affordance alive: the perspective toggle, the
 * keyboard-navigable legend, roving keyboard focus over nodes/edges (which drives
 * the aria-live edge announce), selection-free navigation, and the governance tab.
 *
 * Chrome (toggle, legend, edge announce, manifest/ctx panel) mounts as a child,
 * INSIDE the editor's providers, so it reads the same store.
 */
export interface SquadStudioProps {
  manifest: SquadManifest;
  contextContract?: ContextContract;
  messages?: Messages;
  /** Optional host-injected member currency (candidata/obsoleta) — powers the
   * coordinated-promotion warning; absent → no warning (degradable). */
  staleMembers?: readonly string[];
}

export function SquadStudio({ manifest, contextContract, messages, staleMembers }: SquadStudioProps) {
  const diagram = useMemo(() => buildSquadDiagram(manifest), [manifest]);
  const governanceLabel = translate(messages ?? EN, EN, 'squad.tab.governance');
  const plugins = useMemo(
    () => [createSquadPlugin({ manifest, contextContract, governanceLabel })],
    [manifest, contextContract, governanceLabel],
  );
  return (
    <BpmnDesigner diagram={diagram} plugins={plugins} messages={messages} readOnly>
      <SquadChrome manifest={manifest} contextContract={contextContract} staleMembers={staleMembers} />
    </BpmnDesigner>
  );
}

/** Toggle + legend + edge announce + manifest/ctx panel — all reading the shared
 * store, so the perspective toggle never disturbs selection/undo. */
function SquadChrome({
  manifest,
  contextContract,
  staleMembers,
}: {
  manifest: SquadManifest;
  contextContract?: ContextContract;
  staleMembers?: readonly string[];
}) {
  const t = useT();
  const store = useCanvasStore();
  const viewMode = useCanvasState((s) => s.viewMode);
  const focusedElementId = useCanvasState((s) => s.focusedElementId);
  const { diagram } = useDiagram();

  // Edge-focus announcement: when a squad edge is focused, name kind + from → to.
  const focusedEdge = focusedElementId ? diagram.edges[focusedElementId] : undefined;
  const announce = focusedEdge
    ? t('squad.edge.announce', {
        kind: t(`squad.edge.${focusedEdge.type}`),
        from: focusedEdge.sourceId,
        to: focusedEdge.targetId,
      })
    : '';

  const stale = new Set(staleMembers ?? []);
  const staleRoles = manifest.members.filter((m) => stale.has(m.agentRef)).map((m) => m.role);

  return (
    <aside style={panel} aria-label={t('squad.panel.aria')}>
      {/* Estrutura ↔ Colaboração — swaps only the renderer (one store key). */}
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label={t('squad.view.aria')}>
        {(['estrutura', 'colaboracao'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            data-view-mode={mode}
            onClick={() => store.setState({ viewMode: mode })}
            style={toggleBtn(viewMode === mode)}
          >
            {t(`squad.view.${mode}`)}
          </button>
        ))}
      </div>

      {/* The always-present, keyboard-navigable legend for the six edges. */}
      <div style={eyebrow}>{t('squad.legend.title')}</div>
      <div role="group" aria-label={t('squad.legend.title')} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SQUAD_EDGE_KINDS.map((kind: SquadEdgeKind) => (
          <button key={kind} type="button" style={legendItem} data-legend-kind={kind}>
            <span aria-hidden style={{ fontFamily: 'ui-monospace, monospace', width: 20 }}>{SQUAD_EDGE_GLYPH[kind]}</span>
            <span>{t(`squad.edge.${kind}`)}</span>
          </button>
        ))}
      </div>

      {/* Manifest + context contract (the right panel, §8-06). */}
      <div style={eyebrow}>{t('squad.manifest.title')}</div>
      <Row label={t('squad.manifest.dynamic')} value={manifest.dynamic} />
      <Row label={t('squad.manifest.members')} value={String(manifest.members.length)} />
      <Row label={t('squad.manifest.contract')} value={manifest.contextContractRef} />
      {contextContract && <Row label={t('squad.manifest.contractKeys')} value={String(contextContract.keys.length)} />}

      {staleRoles.length > 0 && (
        <div style={warn} role="status" data-squad-stale>
          {t('squad.stale.warning', { roles: staleRoles.join(', ') })}
        </div>
      )}

      {/* Visually-hidden live region — announces the focused edge to a SR. */}
      <div aria-live="polite" style={srOnly} data-squad-announce>
        {announce}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
      <span style={{ color: 'var(--bpmnr-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{value}</span>
    </div>
  );
}

const panel: React.CSSProperties = { position: 'absolute', top: 12, right: 12, width: 236, background: 'var(--bpmnr-fill, #fff)', border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' };
const toggleBtn = (active: boolean): React.CSSProperties => ({ flex: 1, minHeight: 30, border: '1px solid var(--bpmnr-border, #e2ddd3)', background: active ? 'var(--bpmnr-btv-gold, #9a7b1e)' : 'transparent', color: active ? '#fff' : 'var(--bpmnr-text, #2e2a26)', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: active ? 600 : 400 });
const legendItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: 11, padding: '2px 4px' };
const eyebrow: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: 1.6, color: 'var(--bpmnr-btv-gold, #9a7b1e)', marginTop: 4 };
const warn: React.CSSProperties = { fontSize: 10, color: '#7a611e', background: '#fdfaf1', border: '1px solid #e8d9ae', borderRadius: 7, padding: '6px 8px', lineHeight: 1.5 };
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 };
