import { useMemo, useRef, useState } from 'react';
import type { FactKind, SquadFact, SquadSimResult } from '@buildtovalue/agentflow';
import { useT } from '../i18n/I18nContext.js';

/**
 * Squad Lane SL-10 — the squad fact trail (D1). Renders a {@link SquadSimResult}
 * as an ordered `intencao → acao → io → decisao → evidencia` list, each fact
 * labeled with its provenance (`fixture` vs `evidencia-declarada`, E6) and its
 * masked I/O. It is:
 *
 *   · VIRTUALIZED with its OWN windowing (E8 — no react-window): a fixed row
 *     height + a scroll spacer means only the visible slice (+ overscan) mounts,
 *     so a 10k-fact trail scrolls smoothly with a bounded DOM.
 *   · FILTERABLE by agent / kind / error (the fact fields are flat).
 *   · STEP-ABLE (D8): step mode walks the filtered facts one at a time and shows
 *     the shared-context snapshot AT that step (`fact.contextAfter`, already masked).
 *
 * It renders the honest artifact and never invents: masking, provenance and the
 * context snapshot all come straight from the headless `simulateSquad`.
 */
export interface SquadTrailProps {
  result: SquadSimResult;
  /** Scroll viewport height in px (default 320). */
  height?: number;
}

const ROW_H = 30;
const OVERSCAN = 4;
const KINDS: readonly FactKind[] = ['intencao', 'acao', 'io', 'decisao', 'evidencia', 'parada'];

export function SquadTrail({ result, height = 320 }: SquadTrailProps) {
  const t = useT();
  const [agent, setAgent] = useState<string>('');
  const [kind, setKind] = useState<string>('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const agents = useMemo(() => [...new Set(result.facts.map((f) => f.agent))], [result.facts]);

  const filtered = useMemo(
    () =>
      result.facts.filter(
        (f) =>
          (agent === '' || f.agent === agent) &&
          (kind === '' || f.kind === kind) &&
          (!errorsOnly || f.error === true),
      ),
    [result.facts, agent, kind, errorsOnly],
  );

  // Keep the step cursor inside the filtered range.
  const clampedStep = Math.min(stepIndex, Math.max(0, filtered.length - 1));
  const current: SquadFact | undefined = stepMode ? filtered[clampedStep] : undefined;

  // Own windowing: derive the visible slice from scrollTop + viewport height.
  const total = filtered.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const visibleCount = Math.ceil(height / ROW_H) + OVERSCAN * 2;
  const end = Math.min(total, start + visibleCount);
  const slice = filtered.slice(start, end);

  const goStep = (next: number): void => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setStepIndex(clamped);
    // scroll the stepped row into the window (no scrollIntoView — set scrollTop).
    // `scrollTo` is optional-called: it is absent under jsdom, so guard the method
    // itself (not just the ref) to stay a no-op there while working in a browser.
    const viewport = viewportRef.current;
    if (viewport?.scrollTo) viewport.scrollTo({ top: Math.max(0, clamped * ROW_H - height / 2) });
    else if (viewport) viewport.scrollTop = Math.max(0, clamped * ROW_H - height / 2);
  };

  return (
    <section style={panel} aria-label={t('squad.trail.aria')} data-squad-trail>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={title}>{t('squad.trail.title')}</span>
        <label style={ctl}>
          <span style={srOnly}>{t('squad.trail.filterAgent')}</span>
          <select value={agent} onChange={(e) => setAgent(e.target.value)} data-trail-filter-agent style={select}>
            <option value="">{t('squad.trail.allAgents')}</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label style={ctl}>
          <span style={srOnly}>{t('squad.trail.filterKind')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} data-trail-filter-kind style={select}>
            <option value="">{t('squad.trail.allKinds')}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`squad.trail.kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label style={ctl}>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} data-trail-errors-only />
          {t('squad.trail.errorsOnly')}
        </label>
        <label style={{ ...ctl, marginLeft: 'auto' }}>
          <input type="checkbox" checked={stepMode} onChange={(e) => setStepMode(e.target.checked)} data-trail-step-mode />
          {t('squad.trail.stepMode')}
        </label>
      </div>

      {stepMode && (
        <div style={stepBar} data-trail-stepbar>
          <button type="button" style={stepBtn} onClick={() => goStep(clampedStep - 1)} aria-label={t('squad.trail.prev')}>
            ‹
          </button>
          <span style={{ fontSize: 11 }} data-trail-step-label>
            {t('squad.trail.step', { n: total === 0 ? 0 : clampedStep + 1, total })}
          </span>
          <button type="button" style={stepBtn} onClick={() => goStep(clampedStep + 1)} aria-label={t('squad.trail.next')}>
            ›
          </button>
        </div>
      )}

      {total === 0 ? (
        <div style={empty}>{t('squad.trail.empty')}</div>
      ) : (
        <div
          ref={viewportRef}
          style={{ ...viewport, height }}
          onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          data-trail-viewport
        >
          {/* Spacer preserves the full scroll height while only the slice mounts. */}
          <div style={{ height: total * ROW_H, position: 'relative' }} data-trail-rendered={slice.length}>
            {slice.map((f, i) => {
              const idx = start + i;
              const active = stepMode && idx === clampedStep;
              return (
                <div
                  key={f.step}
                  style={{ ...row, top: idx * ROW_H, ...(active ? rowActive : null), ...(f.error ? rowError : null) }}
                  data-fact-step={f.step}
                  data-fact-agent={f.agent}
                  data-fact-kind={f.kind}
                  data-fact-error={f.error || undefined}
                >
                  {/* Provenance badge. `evidencia-declarada` is host-ASSERTED,
                      not verified — it gets a distinct caution treatment (amber
                      + dashed + a ⚑ flag + a "NOT verified" title) so it can
                      never be misread as verified evidence (a check/green state
                      SL-11 introduces). `fixture` stays neutral. */}
                  {f.source === 'evidencia-declarada' ? (
                    <span
                      style={{ ...badge, ...badgeDeclared }}
                      data-fact-source={f.source}
                      data-unverified
                      title={t('squad.trail.source.declaredHint')}
                    >
                      <span aria-hidden>⚑ </span>
                      {t('squad.trail.source.evidencia-declarada')}
                    </span>
                  ) : (
                    <span style={badge} data-fact-source={f.source} title={t('squad.trail.source.fixtureHint')}>
                      {t('squad.trail.source.fixture')}
                    </span>
                  )}
                  <span style={kindBadge}>{t(`squad.trail.kind.${f.kind}`)}</span>
                  <span style={agentCell}>{f.agent}</span>
                  <span style={msgCell} title={f.message}>
                    {f.message}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stepMode && current && (
        <div style={ctxPanel} data-trail-context>
          <div style={title}>{t('squad.trail.context')}</div>
          {current.io?.output && (
            <pre style={pre} data-trail-io>
              {t('squad.trail.output')}: {JSON.stringify(current.io.output)}
            </pre>
          )}
          {current.contextAfter && Object.keys(current.contextAfter).length > 0 ? (
            <pre style={pre} data-trail-ctx-json>
              {JSON.stringify(current.contextAfter)}
            </pre>
          ) : (
            <div style={empty}>{t('squad.trail.contextEmpty')}</div>
          )}
        </div>
      )}
    </section>
  );
}

const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 10, padding: 10, background: 'var(--bpmnr-fill, #fff)' };
const title: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: 1.6, color: 'var(--bpmnr-btv-gold, #9a7b1e)' };
const ctl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 };
const select: React.CSSProperties = { fontSize: 11, padding: '2px 4px', border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 6, background: 'transparent', color: 'inherit' };
const viewport: React.CSSProperties = { overflowY: 'auto', border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 8, position: 'relative' };
const row: React.CSSProperties = { position: 'absolute', left: 0, right: 0, height: ROW_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', fontSize: 11, borderBottom: '1px solid var(--bpmnr-border-subtle, #f0ece3)', boxSizing: 'border-box' };
const rowActive: React.CSSProperties = { background: 'var(--bpmnr-selection, #fdf6e3)', outline: '2px solid var(--bpmnr-btv-gold, #9a7b1e)', outlineOffset: -2 };
const rowError: React.CSSProperties = { color: '#7a1e1e' };
const badge: React.CSSProperties = { fontSize: 8, letterSpacing: 0.6, textTransform: 'uppercase', border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 4, padding: '1px 4px', color: 'var(--bpmnr-text-muted)', whiteSpace: 'nowrap' };
// Declared-but-UNVERIFIED: a caution treatment, deliberately never a check/green.
const badgeDeclared: React.CSSProperties = { border: '1px dashed #c9971e', color: '#7a611e', background: '#fdfaf1' };
const kindBadge: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 9, width: 56, color: 'var(--bpmnr-text-muted)' };
const agentCell: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 10, width: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const msgCell: React.CSSProperties = { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const stepBar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const stepBtn: React.CSSProperties = { minWidth: 28, minHeight: 26, border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 6, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14 };
const ctxPanel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 8, padding: 8 };
const pre: React.CSSProperties = { margin: 0, fontSize: 10, fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' };
const empty: React.CSSProperties = { fontSize: 10, color: 'var(--bpmnr-text-muted)', padding: 4 };
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 };
