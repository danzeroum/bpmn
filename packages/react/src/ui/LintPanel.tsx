import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compositeCommand, generateId, nodeParentId } from '@buildtovalue/core';
import {
  fixCommandFor,
  lintFindings,
  LINT_PROFILES,
  type LintFinding,
  type LintProfile,
} from '@buildtovalue/lint';
import {
  buildPlan,
  parseProposal,
  validateProposal,
  COPILOT_FIX_PROMPT,
  type AIProvider,
} from '@buildtovalue/copilot';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { panViewportTo } from '../canvas/viewport.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';
import type { NodeIssueBadge } from '../state/canvasStore.js';

/**
 * Lint panel (Handoff 14 §1d): a resizable bottom dock listing every finding
 * of the active lint profiles, grouped by rule. Etiquette AND engine-readiness
 * (executability) findings share this ONE surface — the source tag tells them
 * apart. Clicking a row selects the element and pans to it with the SAME
 * animated pan as the search bar; Esc closes via the single dismissal stack.
 *
 * Fixes: a rule's mechanical quick-fix ("corrigir") executes ONE undoable
 * command; "corrigir todos" folds every available fix into ONE composite.
 * Findings without a mechanical fix show "✦ sugerir correção" instead —
 * routed through the copilot's C5 pipeline (same whitelist, integral
 * rejection, atomic composite) — and only when the host injected an
 * `AIProvider`, mirroring the CopilotPanel gate.
 *
 * While the dock is open its findings mirror onto the canvas as issue badges
 * (`[data-node-issue]` — already stripped from exports by TRANSIENT_SELECTORS,
 * the "export mid-gesture" rule); closing clears them.
 */
export interface LintPanelProps {
  /** HOST-injected transport for "✦ sugerir correção". Absent → no ✦ button. */
  provider?: AIProvider;
  /** Rule sets to run. Default: the shipped etiquette + engine profiles. */
  profiles?: LintProfile[];
  /** Initial dock height in px (resizable by the user). */
  initialHeight?: number;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 560;

function findingKey(finding: LintFinding, index: number): string {
  return `${finding.code}:${finding.nodeId ?? finding.edgeId ?? index}`;
}

export function LintPanel({ provider, profiles = LINT_PROFILES, initialHeight = 240 }: LintPanelProps) {
  const { diagram, execute } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const open = useCanvasState((s) => s.lintOpen);
  const readOnly = useCanvasState((s) => s.readOnly);
  const t = useT();
  const [height, setHeight] = useState(initialHeight);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const panRaf = useRef<number | null>(null);
  const conversationId = useRef(generateId());
  const resizeOrigin = useRef<{ y: number; height: number } | null>(null);

  const close = useCallback(() => store.setState({ lintOpen: false }), [store]);
  useDismissal('lint', open, close);

  const findings = useMemo(
    () => (open ? lintFindings(diagram, profiles) : []),
    [open, diagram, profiles],
  );
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const fixable = useMemo(() => findings.filter((f) => f.fixable), [findings]);

  // Grouped by rule (§1d) — insertion order keeps profile order stable.
  const groups = useMemo(() => {
    const byRule = new Map<string, LintFinding[]>();
    for (const finding of findings) {
      const bucket = byRule.get(finding.ruleId) ?? [];
      bucket.push(finding);
      byRule.set(finding.ruleId, bucket);
    }
    return [...byRule.entries()];
  }, [findings]);

  // N-3: every (re)computation of the issue set is a validation.changed.
  useEffect(() => {
    if (!open) return;
    config.emitEditorEvent('validation.changed', {
      errors,
      warnings,
      codes: [...new Set(findings.map((f) => f.code))],
    });
  }, [open, findings, errors, warnings, config]);

  // Mirror findings as canvas badges while open; the panel OWNS issueBadges
  // for its lifetime (same field Validate populates — last surface wins).
  useEffect(() => {
    if (!open) return;
    const badges: Record<string, NodeIssueBadge> = {};
    for (const finding of findings) {
      if (!finding.nodeId) continue;
      if (finding.severity !== 'error' && finding.severity !== 'warning') continue;
      const existing = badges[finding.nodeId];
      if (existing?.severity === 'error') continue; // keep the worst severity
      badges[finding.nodeId] = { severity: finding.severity, code: finding.code };
    }
    store.setState({ issueBadges: badges });
    return () => store.setState({ issueBadges: {} });
  }, [open, findings, store]);

  const goTo = useCallback(
    (finding: LintFinding) => {
      const id = finding.nodeId ?? finding.edgeId;
      if (!id) return;
      const { viewport, drillId } = store.getState();
      if (finding.nodeId) {
        const node = diagram.nodes[finding.nodeId];
        if (!node) return;
        const scope = nodeParentId(node) ?? null;
        store.setState({
          selectedIds: [id],
          focusedElementId: id,
          ...(drillId !== scope ? { drillId: scope } : {}),
        });
        panViewportTo(
          store,
          node.x + node.width / 2 - viewport.width / 2,
          node.y + node.height / 2 - viewport.height / 2,
          panRaf,
        );
      } else {
        const edge = diagram.edges[finding.edgeId!];
        const source = edge ? diagram.nodes[edge.sourceId] : undefined;
        store.setState({ selectedIds: [id] });
        if (source) {
          panViewportTo(
            store,
            source.x - viewport.width / 2,
            source.y - viewport.height / 2,
            panRaf,
          );
        }
      }
    },
    [diagram, store],
  );

  const applyFix = useCallback(
    (finding: LintFinding) => {
      const command = fixCommandFor(diagram, finding, profiles);
      if (command) execute(command);
    },
    [diagram, execute, profiles],
  );

  const applyAllFixes = useCallback(() => {
    // ONE composite (§1d): a single undo reverts the whole sweep.
    const commands = fixable
      .map((finding) => fixCommandFor(diagram, finding, profiles))
      .filter((command): command is NonNullable<typeof command> => command !== null);
    if (commands.length === 0) return;
    execute(
      commands.length === 1 ? commands[0] : compositeCommand('Fix all lint issues', commands),
    );
  }, [diagram, execute, fixable, profiles]);

  const suggest = useCallback(
    async (finding: LintFinding, key: string) => {
      if (!provider || busyKey) return;
      setBusyKey(key);
      setSuggestError(null);
      try {
        // C5: the SAME pipeline as the copilot panel — whitelist validation,
        // integral rejection, ONE atomic composite; only the ask differs.
        const context = JSON.stringify({
          nodes: Object.values(diagram.nodes).map((n) => ({ id: n.id, type: n.type, label: n.label })),
          edges: Object.values(diagram.edges).map((e) => ({ id: e.id, sourceId: e.sourceId, targetId: e.targetId })),
        });
        const raw = await provider.complete({
          system: COPILOT_FIX_PROMPT.system,
          messages: [
            {
              role: 'user',
              content:
                `Corrija o problema de lint ${finding.code} em '${finding.nodeId ?? finding.edgeId ?? '?'}': ` +
                `${finding.message}\n\nEstado atual do diagrama: ${context}`,
            },
          ],
        });
        const parsed = parseProposal(raw);
        if ('error' in parsed) {
          setSuggestError(t('lint.invalidProposal', { error: parsed.error }));
          return;
        }
        const verdict = validateProposal(diagram, parsed.proposal);
        if (!verdict.ok) {
          setSuggestError(t('lint.rejectedProposal'));
          return;
        }
        const plan = buildPlan(diagram, parsed.proposal, {
          providerId: provider.id,
          conversationId: conversationId.current,
        });
        execute(plan.command);
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, diagram, execute, provider, t],
  );

  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeOrigin.current = { y: event.clientY, height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = resizeOrigin.current;
    if (!origin) return;
    const next = origin.height + (origin.y - event.clientY);
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)));
  };
  const onResizePointerUp = () => {
    resizeOrigin.current = null;
  };

  if (!open) {
    return (
      <button
        type="button"
        className="bpmnr-lint-toggle"
        data-testid="lint-toggle"
        aria-label={t('lint.toggleAria')}
        onClick={() => store.setState({ lintOpen: true })}
      >
        {/* i18n-exempt — severity glyph, not prose */}
        <span aria-hidden="true">⚠</span> {t('lint.title')}
      </button>
    );
  }

  return (
    <section
      className="bpmnr-lint"
      data-testid="lint-panel"
      role="region"
      aria-label={t('lint.title')}
      style={{ height }}
    >
      <div
        className="bpmnr-lint-resize"
        data-lint-resize
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('lint.resizeAria')}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
      <header className="bpmnr-lint-header">
        <strong>{t('lint.title')}</strong>
        <span className="bpmnr-lint-pill" data-lint-count="errors" data-empty={errors === 0}>
          {t('lint.errors', { count: errors })}
        </span>
        <span className="bpmnr-lint-pill" data-lint-count="warnings" data-empty={warnings === 0}>
          {t('lint.warnings', { count: warnings })}
        </span>
        <span className="bpmnr-lint-policy" data-testid="lint-policy">
          {t('lint.policy')}{' '}
          {profiles.map((profile) => (
            <code key={profile.id}>
              {profile.id}@{profile.version} {/* i18n-exempt — status glyph */}●{' '}
              {t('lint.active')}
            </code>
          ))}
        </span>
        {!readOnly && fixable.length > 0 && (
          <button
            type="button"
            className="bpmnr-lint-fix-all"
            data-testid="lint-fix-all"
            onClick={applyAllFixes}
          >
            {t('lint.fixAll', { count: fixable.length })}
          </button>
        )}
        <button type="button" onClick={close} aria-label={t('lint.close')}>
          ✕
        </button>
      </header>
      <div className="bpmnr-lint-body">
        {suggestError && (
          <p className="bpmnr-lint-error" data-testid="lint-suggest-error" role="alert">
            {suggestError}
          </p>
        )}
        {findings.length === 0 && <p className="bpmnr-lint-empty">{t('lint.empty')}</p>}
        {groups.map(([ruleId, ruleFindings]) => (
          <div key={ruleId} className="bpmnr-lint-group" data-lint-group={ruleId}>
            <h4 className="bpmnr-lint-group-title">
              <code>{ruleId}</code>
              <span>{ruleFindings.length}</span>
            </h4>
            <ul>
              {ruleFindings.map((finding, index) => {
                const key = findingKey(finding, index);
                return (
                  <li key={key} data-lint-row={finding.nodeId ?? finding.edgeId ?? ''}>
                    <button
                      type="button"
                      className="bpmnr-lint-row-main"
                      data-lint-goto
                      onClick={() => goTo(finding)}
                    >
                      <span
                        className="bpmnr-lint-dot"
                        data-severity={finding.severity}
                        aria-hidden="true"
                      />
                      <code className="bpmnr-lint-code">{finding.code}</code>
                      <span className="bpmnr-lint-message">{finding.message}</span>
                      <span className="bpmnr-lint-source" data-lint-source={finding.source}>
                        {finding.source === 'etiquette'
                          ? t('lint.sourceEtiquette')
                          : t('lint.sourceEngine')}
                      </span>
                    </button>
                    {!readOnly && finding.fixable && (
                      <button
                        type="button"
                        className="bpmnr-lint-fix"
                        data-lint-fix
                        onClick={() => applyFix(finding)}
                      >
                        {t('lint.fix')}
                      </button>
                    )}
                    {!readOnly && !finding.fixable && provider && (
                      <button
                        type="button"
                        className="bpmnr-lint-suggest"
                        data-lint-suggest
                        disabled={busyKey !== null}
                        onClick={() => void suggest(finding, key)}
                      >
                        {/* i18n-exempt — the copilot spark glyph stays literal */}✦{' '}
                        {t('lint.suggest')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
