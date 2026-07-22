import {
  readinessState,
  type AgentWorkflow,
  type ReadinessContext,
  type ReadinessState,
} from '@buildtovalue/agentflow';
import { useT } from '../i18n/I18nContext.js';

/**
 * Squad Lane SL-13 — the readiness badge. It is the ONE way any surface paints
 * an agent's/squad's readiness, and it derives the state SOLELY from the pure
 * `readinessState()` (cerca §2.11 — painting a state in the UI is prohibited;
 * card, badge and tooltip all read the same function). A component that computed
 * its own state would diverge from this badge — the guard test compares the two
 * across every state, so a home-grown derivation breaks the build.
 *
 * The four DERIVED states are the frontend ceiling. The host states `executando`
 * / `erro-de-integracao` are NEVER derived here — they show only when the host
 * INFORMS them via `hostStatus` (a real provider running the spec). Without it,
 * `apto-para-integracao` never becomes `executando` (acceptance §10.7).
 */
export type HostRuntimeStatus = 'executando' | 'erro-de-integracao';

export interface ReadinessBadgeProps {
  workflow: AgentWorkflow;
  context: ReadinessContext;
  /** OPTIONAL host-informed runtime status. Present → shown (host authority);
   * absent → the derived `readinessState` (the badge never invents a host state). */
  hostStatus?: HostRuntimeStatus;
}

/** The gold ladder — later states are "more ready". Purely for the visual tier;
 * the LABEL is localized and the STATE is always the readinessState() value. */
const TIER: Record<ReadinessState, number> = {
  rascunho: 0,
  validado: 1,
  'simulado-com-evidencia': 2,
  'apto-para-integracao': 3,
};

export function ReadinessBadge({ workflow, context, hostStatus }: ReadinessBadgeProps) {
  const t = useT();
  // SINGLE source: the derived state is ALWAYS readinessState(). Host runtime
  // status is a separate, host-authoritative overlay — never a derivation.
  const derived = readinessState(workflow, context);
  const shown: ReadinessState | HostRuntimeStatus = hostStatus ?? derived;
  const isHost = hostStatus !== undefined;
  const label = t(`readiness.${shown}`);
  return (
    <span
      style={badgeStyle(shown, isHost)}
      data-readiness={shown}
      data-readiness-derived={derived}
      data-readiness-host={isHost || undefined}
      aria-label={t('readiness.aria', { state: label })}
    >
      {label}
    </span>
  );
}

function badgeStyle(state: ReadinessState | HostRuntimeStatus, isHost: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.4,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid',
    whiteSpace: 'nowrap',
  };
  if (state === 'erro-de-integracao') {
    return { ...base, color: '#7a1e1e', background: '#fdf1f1', borderColor: '#e8aeae' };
  }
  if (state === 'executando' || isHost) {
    // host runtime — a distinct blue, never the gold "ready" tiers
    return { ...base, color: '#1e4f7a', background: '#f1f7fd', borderColor: '#aecfe8' };
  }
  const tier = TIER[state as ReadinessState];
  const gold = tier >= 3;
  return {
    ...base,
    color: gold ? '#5a4708' : 'var(--bpmnr-text-muted, #6b655c)',
    background: gold ? '#fbf6e6' : 'var(--bpmnr-fill-subtle, #f6f4ef)',
    borderColor: gold ? '#d9c48a' : 'var(--bpmnr-border, #e2ddd3)',
  };
}
