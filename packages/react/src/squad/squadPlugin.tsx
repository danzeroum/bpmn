import {
  requiresDownstreamGate,
  type AutonomyLevel,
  type ContextContract,
  type SquadEdgeKind,
  type SquadManifest,
} from '@buildtovalue/agentflow';
import type { BpmnNode } from '@buildtovalue/core';
import type { BpmnPlugin, EdgeStyle } from '../plugins/types.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Squad Lane SL-9 — the squad plugin. It registers the six collaboration edge
 * styles (distinguishable WITHOUT color: distinct marker + dash per kind; the
 * `collaboration` override thickens them in the Colaboração view) and the Wave-3
 * Memória/Governança inspector tab for a squad member (agentTask). No new canvas
 * — just a plugin over the existing editor.
 */

const STROKE = 'var(--bpmnr-stroke, #44403a)';
const REST = 1.3;
const EMPHASIS = 2.4;

/** The six squad edge styles, keyed by `edge.type` = the kind. Each is distinct
 * by marker + dash alone (no color); the toggle thickens them (Colaboração). */
export const SQUAD_EDGE_STYLES: Record<SquadEdgeKind, EdgeStyle> = {
  delegar: { stroke: STROKE, strokeWidth: REST, marker: 'filled', collaboration: { strokeWidth: EMPHASIS } },
  'enviar-contexto': { stroke: STROKE, strokeWidth: REST, marker: 'open', dash: '6,4', collaboration: { strokeWidth: EMPHASIS } },
  'solicitar-revisao': { stroke: STROKE, strokeWidth: REST, marker: 'disc', collaboration: { strokeWidth: EMPHASIS } },
  escalar: { stroke: STROKE, strokeWidth: REST, marker: 'double-chevron', collaboration: { strokeWidth: EMPHASIS } },
  consolidar: { stroke: STROKE, strokeWidth: REST, marker: 'filled', dash: '2,4', collaboration: { strokeWidth: EMPHASIS } },
  fallback: { stroke: STROKE, strokeWidth: REST, marker: 'open', dash: '1,4', collaboration: { strokeWidth: EMPHASIS } },
};

/** A decorative marker glyph per kind for the legend (aria-hidden — the button's
 * accessible name is the localized kind, never the glyph). */
export const SQUAD_EDGE_GLYPH: Record<SquadEdgeKind, string> = {
  delegar: '▸',
  'enviar-contexto': '⇢',
  'solicitar-revisao': '◦▸',
  escalar: '»',
  consolidar: '▪▸',
  fallback: '⇠',
};

/** The Wave-3 (O3) Memória/Governança tab for a squad member (agentTask). */
function SquadGovernance({
  node,
  manifest,
  contract,
}: {
  node: BpmnNode;
  manifest: SquadManifest;
  contract?: ContextContract;
}) {
  const t = useT();
  const role = node.id;
  const member = manifest.members.find((m) => m.role === role);
  const autonomy = typeof node.properties.autonomyLevel === 'number' ? node.properties.autonomyLevel : undefined;
  const needsGate = autonomy !== undefined && requiresDownstreamGate(autonomy as AutonomyLevel);
  const memoryKeys = (contract?.keys ?? []).filter(
    (k) =>
      k.forbidden !== true &&
      (k.owner === role || (k.writers ?? []).includes(role) || (k.readers ?? []).includes(role) || (k.readers ?? []).includes('*')),
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }} data-agent-tabpanel="governanca">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: 1.6, color: 'var(--bpmnr-btv-gold, #9a7b1e)' }}>
        {t('squad.governance.title')}
      </div>
      <Row label={t('squad.governance.role')} value={role} />
      {member?.personaRef && <Row label={t('squad.governance.persona')} value={member.personaRef} />}
      <Row label={t('squad.governance.autonomy')} value={autonomy === undefined ? '—' : String(autonomy)} />
      <Row label={t('squad.governance.gate')} value={needsGate ? t('squad.governance.gateRequired') : t('squad.governance.gateOptional')} />
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: 1.6, color: 'var(--bpmnr-btv-gold, #9a7b1e)', marginTop: 4 }}>
        {t('squad.memory.title')}
      </div>
      {contract === undefined ? (
        <div style={{ fontSize: 10, color: 'var(--bpmnr-text-muted)' }}>{t('squad.memory.noContract')}</div>
      ) : memoryKeys.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--bpmnr-text-muted)' }}>{t('squad.memory.none')}</div>
      ) : (
        memoryKeys.map((k) => (
          <Row
            key={k.key}
            label={k.key}
            value={`${k.owner === role ? t('squad.memory.owner') : (k.writers ?? []).includes(role) ? t('squad.memory.writer') : t('squad.memory.reader')}${k.purpose ? ` · ${k.purpose}` : ''}`}
          />
        ))
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--bpmnr-text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Builds the squad plugin. `governanceLabel` is the (already localized) tab
 * title, resolved by the host/SquadStudio since the plugin is created outside
 * the i18n provider. */
export function createSquadPlugin(options: {
  manifest: SquadManifest;
  contextContract?: ContextContract;
  governanceLabel: string;
}): BpmnPlugin {
  const { manifest, contextContract, governanceLabel } = options;
  return {
    id: 'squad',
    edgeStyles: SQUAD_EDGE_STYLES,
    inspectorSections: [
      {
        id: 'squad-governance',
        appliesTo: (node) => node.type === 'agentTask',
        tab: { id: 'governanca', label: governanceLabel },
        component: ({ node }) => <SquadGovernance node={node} manifest={manifest} contract={contextContract} />,
      },
    ],
  };
}
