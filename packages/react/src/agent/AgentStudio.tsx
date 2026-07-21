import { useEffect, useRef, useReducer, useState } from 'react';
import {
  AUTONOMY_SCALE,
  DEFAULT_TEMPLATE_ID,
  formatRef,
  minCoherentLevel,
  normalizeSchema,
  promptVariables,
  requiresDownstreamGate,
  simulate,
  TEMPLATES,
  toRef,
  validateGraph,
  type AgentNode,
  type AgentWorkflow,
  type Fixtures,
  type NodeType,
  type SchemaShape,
  type SimulationState,
  type ToolContract,
  type ValidationIssue,
} from '@buildtovalue/agentflow';
import { useDismissal } from '../gestures/useDismissal.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';
import { BlockedDecisionNotice } from '../simulation/DecisionInputCard.js';
import { proposeErrorBoundaryCommand } from './agentBoundary.js';
import type { ToolProvider } from './toolProvider.js';
import type { PromptProvider } from './promptProvider.js';
import { hasQuickFix, quickFixFor } from './quickFix.js';
import {
  addNode,
  agentEditorReducer,
  initEditorState,
  layoutWorkflow,
  removeNode,
  toggleDecorator,
  updateNodeConfig,
  type EditResult,
} from './agentEditor.js';

/** A finished agent-simulation session handed to the host for the ledger (§7). */
export interface AgentSimulationRecord {
  workflowRef: string;
  steps: number;
  complete: boolean;
  blocked?: { nodeId: string; reason: string };
  author: string;
  timestamp: string;
}

/** Reduced-motion detection (SSR/jsdom-safe) — same signal as the H7 simulator. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mq ? mq.matches : false;
}

function hasErrorBoundary(wf: AgentWorkflow): boolean {
  return wf.nodes.some((n) => (n.decorators ?? []).some((d) => d.type === 'errorBoundary'));
}

export interface AgentStudioProps {
  /** Whether the modal is open (registers on the Esc dismissal stack). */
  open: boolean;
  /** The sub-workflow being edited (source of truth: the Library). */
  workflow: AgentWorkflow;
  /** Versioned ref shown in the header, e.g. `agnt-rsch@2.1.0`. */
  workflowRef?: string;
  /** Lifecycle seal text (already localized by the host), e.g. `CANDIDATA`. */
  lifecycleStatus?: string;
  /** The BPMN node label the Studio was opened from. */
  openedFrom?: string;
  /** Persist the edited sub-workflow to the Library (never the XML — §1.1). */
  onSave: (workflow: AgentWorkflow) => void;
  /** Close the modal (Esc routes here before any Designer dismissal). */
  onClose: () => void;
  /** The macro agentTask node id — enables the error-boundary proposal (§5). */
  agentTaskId?: string;
  /** Per-node mock fixtures for the simulation (§7); default empty → the
   * decision blocks honestly on absent structured output. */
  simulationFixtures?: Fixtures;
  /** Record a finished simulation session to the ledger (§7). Button hidden
   * when absent. `author`/`timestamp` come from the host (clock-free). */
  onRecordSimulation?: (record: AgentSimulationRecord) => void;
  author?: string;
  timestamp?: string;
  /**
   * Squad Lane SL-2 — resolves `tool:*@semver` bindings to their contracts and
   * (optionally) lists the bindable catalog for the inspector selector. Absent
   * → the tool binding degrades to a typed text field; the graph still
   * validates, just without contract-aware checks (cerca §1.7/§2.4).
   */
  toolProvider?: ToolProvider;
  /**
   * Squad Lane SL-7 — resolves an llm node's `promptRef` to its body text (from
   * the Library btv:prompt artifact) for the coverage validator, and persists
   * edits back to the artifact via `save`. Absent → no coverage validator;
   * present without `save` → read-only (never the AgentWorkflow — cerca §2.4).
   */
  promptProvider?: PromptProvider;
}

const NODE_TYPES: { type: NodeType; labelKey: string; descKey: string; icon: string }[] = [
  { type: 'llm', labelKey: 'agent.node.llm', descKey: 'agent.node.llm.desc', icon: '🧠' },
  { type: 'tool', labelKey: 'agent.node.tool', descKey: 'agent.node.tool.desc', icon: '🛠' },
  { type: 'decision', labelKey: 'agent.node.decision', descKey: 'agent.node.decision.desc', icon: '◆' },
];

const EDGE_STROKE: Record<string, string> = {
  toolCall: 'var(--bpmnr-agent-tool, #2f6e94)',
  data: 'var(--bpmnr-stroke, #44403a)',
  delegate: 'var(--bpmnr-agent-delegate, #7a4f9a)',
};

/**
 * Agent Studio (Handoff 12 A-4) — the modal sub-workflow editor over the
 * Designer. Its edit history is an ISOLATED stack (undo here never touches the
 * BPMN diagram behind it); every edit emits the matching N-3 catalog event
 * from inside the modal (never a silent hole in the bus); every string is
 * localized; Esc closes the modal via the single dismissal stack before any
 * Designer dismissal.
 */
export function AgentStudio(props: AgentStudioProps) {
  const {
    open,
    workflow,
    workflowRef,
    lifecycleStatus,
    openedFrom,
    onSave,
    onClose,
    agentTaskId,
    simulationFixtures,
    onRecordSimulation,
    author,
    timestamp,
    toolProvider,
    promptProvider,
  } = props;
  const t = useT();
  const { emitEditorEvent } = useEditorConfig();
  const { diagram, execute } = useDiagram();
  const [state, dispatch] = useReducer(agentEditorReducer, workflow, initEditorState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sim, setSim] = useState<SimulationState | null>(null);
  const [simStep, setSimStep] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [boundaryResolved, setBoundaryResolved] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useDismissal('agent-studio', open, onClose);

  // Reset the isolated history whenever a different sub-workflow is opened.
  useEffect(() => {
    dispatch({ type: 'reset', workflow });
    setSelectedId(null);
    setSim(null);
    setRecorded(false);
    setBoundaryResolved(false);
    setProposalOpen(false);
  }, [workflow]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (!open) return null;

  const wf = state.present;

  const stopSim = (): void => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setSim(null);
    setSimStep(0);
    setRecorded(false);
  };
  const runSim = (): void => {
    if (sim) return stopSim();
    const result = simulate(wf, { fixtures: simulationFixtures ?? {} });
    setSim(result);
    setRecorded(false);
    // Reduced-motion (§9.4): step through at 0ms — jump straight to the end.
    if (prefersReducedMotion() || result.trail.length <= 1) {
      setSimStep(Math.max(0, result.trail.length - 1));
      return;
    }
    setSimStep(0);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      if (i >= result.trail.length) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        return;
      }
      setSimStep(i);
    }, 400);
  };
  const recordSession = (): void => {
    if (!sim || !onRecordSimulation) return;
    onRecordSimulation({
      workflowRef: workflowRef ?? `${wf.id}@${wf.version}`,
      steps: sim.trail.length,
      complete: sim.complete,
      ...(sim.blockedDecision ? { blocked: { nodeId: sim.blockedDecision.nodeId, reason: sim.blockedDecision.reason } } : {}),
      author: author ?? `ia.copilot`,
      timestamp: timestamp ?? '',
    });
    setRecorded(true);
  };

  const handleSave = (): void => {
    onSave(wf);
    // Boundary proposal (§5): NEVER silent — offer it, once per session.
    if (!boundaryResolved && agentTaskId && hasErrorBoundary(wf)) setProposalOpen(true);
  };
  const acceptBoundary = (): void => {
    if (agentTaskId) {
      const command = proposeErrorBoundaryCommand(diagram, agentTaskId);
      if (command) execute(command); // ONE undoable command on the macro stack
    }
    setBoundaryResolved(true);
    setProposalOpen(false);
  };
  const refuseBoundary = (): void => {
    setBoundaryResolved(true); // refusal does not re-ask this session
    setProposalOpen(false);
  };

  /** Apply an edit + emit its N-3 event from inside the modal. */
  const apply = (result: EditResult): void => {
    dispatch({ type: 'apply', result });
    emitEditorEvent(result.effect.event, {
      id: result.effect.id,
      elementType: result.effect.elementType,
      ...(result.effect.event !== 'element.changed' ? { kind: result.effect.kind } : {}),
    });
    emitEditorEvent('command.executed', { commandId: result.effect.event, description: result.effect.event });
  };
  const undo = (): void => {
    dispatch({ type: 'undo' });
    emitEditorEvent('command.undone', {});
  };
  const redo = (): void => dispatch({ type: 'redo' });

  const issues: ValidationIssue[] = validateGraph(wf, { resolveTool: toolProvider?.resolve });
  const errors = issues.filter((i) => i.severity === 'error');
  const level = wf.autonomyLevel;
  const needsGate = requiresDownstreamGate(level);
  const selected = wf.nodes.find((n) => n.id === selectedId) ?? null;
  const layout = layoutWorkflow(wf);
  const pos = new Map(layout.map((l) => [l.id, l]));
  const width = Math.max(560, ...layout.map((l) => l.x + l.width + 24));
  const height = Math.max(300, ...layout.map((l) => l.y + l.height + 24));
  const empty = wf.nodes.length === 0;
  const tokNodeId = sim ? sim.trail[Math.min(simStep, Math.max(0, sim.trail.length - 1))]?.nodeId : undefined;
  const tokenAt = tokNodeId ? pos.get(tokNodeId) : undefined;
  const simStatus = sim
    ? sim.blockedDecision
      ? t('agent.sim.blocked')
      : sim.complete
        ? t('agent.sim.done', { steps: sim.trail.length })
        : t('agent.sim.running', { step: simStep + 1, total: sim.trail.length })
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('agent.studio.aria')}
      className="bpmnr-agent-studio-overlay"
      style={overlay}
    >
      <div style={modal}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('agent.studio.title', { name: wf.name })}</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--bpmnr-text-muted)' }}>
              {t('agent.studio.subtitle', { ref: workflowRef ?? `${wf.id}@${wf.version}`, node: openedFrom ?? '' })}
            </div>
          </div>
          {lifecycleStatus && <span style={seal}>● {lifecycleStatus}</span>}
          <span style={autonomyPill} title={t('agent.autonomy.needsGate')}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{t('agent.autonomy.label')}</span>
            <strong style={{ color: 'var(--bpmnr-agent-tool, #33567e)' }}>
              {level} · {AUTONOMY_SCALE[minCoherentLevel(wf)].name}
            </strong>
            {needsGate && <span style={{ color: 'var(--bpmnr-btv-gold, #9a7b1e)' }}>{t('agent.autonomy.needsGate')}</span>}
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" style={btn} onClick={undo} disabled={state.past.length === 0} aria-label={t('agent.action.undo')}>↶</button>
          <button type="button" style={btn} onClick={redo} disabled={state.future.length === 0} aria-label={t('agent.action.redo')}>↷</button>
          <button type="button" style={{ ...btn, borderColor: 'var(--bpmnr-agent-tool, #33567e)', color: 'var(--bpmnr-agent-tool, #33567e)' }} onClick={runSim} data-agent-simulate>
            {sim ? `■ ${t('agent.action.stop')}` : `▶ ${t('agent.action.simulate')}`}
          </button>
          <button type="button" style={btnPrimary} onClick={handleSave}>{t('agent.action.save')}</button>
          <button type="button" style={btn} onClick={onClose} aria-label={t('agent.action.close')}>✕</button>
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* palette */}
          <aside style={palette} aria-label={t('agent.palette.nodes')}>
            <div style={eyebrow}>{t('agent.palette.nodes')}</div>
            {NODE_TYPES.map((nt) => (
              <button
                key={nt.type}
                type="button"
                style={paletteItem}
                onClick={() => apply(addNode(wf, nt.type))}
                aria-label={t('agent.palette.add', { label: t(nt.labelKey) })}
              >
                <span aria-hidden style={paletteIcon}>{nt.icon}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>{t(nt.labelKey)}</span>
                  <span style={{ display: 'block', fontSize: 9.5, color: 'var(--bpmnr-text-muted)' }}>{t(nt.descKey)}</span>
                </span>
              </button>
            ))}
            <div style={eyebrow}>{t('agent.palette.decorators')}</div>
            <div style={{ fontSize: 9.5, color: 'var(--bpmnr-text-muted)', lineHeight: 1.5 }}>{t('agent.decorators.note')}</div>
            <div style={eyebrow}>{t('agent.palette.templates')}</div>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                style={templateItem}
                onClick={() => apply({ workflow: tpl, effect: { event: 'element.added', kind: 'node' } })}
              >
                {tpl.name}
              </button>
            ))}
          </aside>

          {/* canvas */}
          <main style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--bpmnr-canvas-bg, #faf9f6)' }}>
            <svg width={width} height={height} role="group" aria-label={t('agent.canvas.aria')} style={{ display: 'block' }}>
              {wf.edges.map((edge, i) => {
                const from = pos.get(edge.from);
                const to = pos.get(edge.to);
                if (!from || !to) return null;
                const x1 = from.x + from.width;
                const y1 = from.y + from.height / 2;
                const x2 = to.x;
                const y2 = to.y + to.height / 2;
                return (
                  <line
                    key={`e${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={EDGE_STROKE[edge.edgeType] ?? EDGE_STROKE.data}
                    strokeWidth={1.5}
                    strokeDasharray={edge.edgeType === 'delegate' ? '6,4' : undefined}
                  />
                );
              })}
              {wf.nodes.map((node) => {
                const l = pos.get(node.id)!;
                const isSel = node.id === selectedId;
                return (
                  <g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label={t('agent.node.select', { id: node.id })}
                    transform={`translate(${l.x}, ${l.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(node.id);
                      }
                    }}
                  >
                    <rect
                      width={l.width}
                      height={l.height}
                      rx={10}
                      fill="var(--bpmnr-fill, #fff)"
                      stroke={isSel ? 'var(--bpmnr-selected, #1a6a54)' : 'var(--bpmnr-stroke, #44403a)'}
                      strokeWidth={isSel ? 2.5 : 1.5}
                    />
                    <text x={l.width / 2} y={26} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--bpmnr-text)">
                      {iconFor(node.type)} {node.id}
                    </text>
                    <text x={l.width / 2} y={44} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="var(--bpmnr-text-muted)">
                      {subtitleFor(node)}
                    </text>
                  </g>
                );
              })}
              {/* simulation token — 400ms/step (0ms under reduced-motion) */}
              {tokenAt && (
                <circle
                  data-agent-token
                  cx={tokenAt.x + tokenAt.width / 2}
                  cy={tokenAt.y + tokenAt.height / 2}
                  r={9}
                  fill="var(--bpmnr-agent-tool, #33567e)"
                  stroke="#fff"
                  strokeWidth={2.5}
                  style={{ transition: 'cx 400ms ease-in-out, cy 400ms ease-in-out' }}
                />
              )}
            </svg>
            {/* empty canvas → template chooser (governance as first experience) */}
            {empty && (
              <div style={chooser} data-testid="agent-template-chooser">
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t('agent.templates.pick')}</div>
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    style={{ ...paletteItem, minWidth: 240 }}
                    onClick={() => apply({ workflow: tpl, effect: { event: 'element.added', kind: 'node' } })}
                  >
                    {tpl.name}
                    {tpl.id === DEFAULT_TEMPLATE_ID ? t('agent.templates.default') : ''}
                  </button>
                ))}
              </div>
            )}
          </main>

          {/* inspector — the simulation trail replaces it in sim mode (§7) */}
          <aside style={inspector} aria-label={t('agent.inspector.aria')}>
            {sim ? (
              <SimulationView
                t={t}
                state={sim}
                status={simStatus}
                recorded={recorded}
                canRecord={Boolean(onRecordSimulation)}
                onRecord={recordSession}
              />
            ) : (
              <>
                <div style={eyebrow}>{t('agent.inspector.title')}</div>
                {!selected && <div style={{ fontSize: 12, color: 'var(--bpmnr-text-muted)' }}>{t('agent.inspector.empty')}</div>}
                {selected && <Inspector node={selected} wf={wf} t={t} toolProvider={toolProvider} promptProvider={promptProvider} onConfig={(patch) => apply(updateNodeConfig(wf, selected.id, patch))} onToggle={(d) => apply(toggleDecorator(wf, selected.id, d))} onRemove={() => { apply(removeNode(wf, selected.id)); setSelectedId(null); }} />}
                <ProblemsPanel
                  t={t}
                  issues={issues}
                  onLocate={(nodeId) => setSelectedId(nodeId)}
                  onQuickFix={(issue) => {
                    const result = quickFixFor(issue, wf);
                    if (result) apply(result);
                  }}
                />
              </>
            )}
          </aside>
        </div>

        {/* error-boundary proposal — NEVER silent; accept = one undoable command */}
        {proposalOpen && (
          <div style={proposalCard} role="alertdialog" aria-label={t('agent.boundary.title')} data-testid="agent-boundary-proposal">
            <strong style={{ fontSize: 12.5 }}>⛑ {t('agent.boundary.title')}</strong>
            <p style={{ fontSize: 11, color: 'var(--bpmnr-text-muted)', margin: 0 }}>{t('agent.boundary.body')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...btnPrimary, minHeight: 36 }} onClick={acceptBoundary} data-testid="agent-boundary-accept">{t('agent.boundary.accept')}</button>
              <button type="button" style={{ ...btn, minHeight: 36 }} onClick={refuseBoundary} data-testid="agent-boundary-refuse">{t('agent.boundary.refuse')}</button>
            </div>
          </div>
        )}

        {/* footer — graph validation always visible */}
        <footer style={footer} aria-live="polite">
          {errors.length === 0 ? (
            <span style={{ color: 'var(--bpmnr-selected, #1a6a54)' }}>✓ {t('agent.footer.valid')}</span>
          ) : (
            <span style={{ color: 'var(--bpmnr-error, #b3261e)' }}>
              ✗ {t(errors.length === 1 ? 'agent.footer.errors_one' : 'agent.footer.errors_other', { n: errors.length })}
              {errors[0].remediation ? ` · ${t('agent.footer.remediation', { remediation: errors[0].remediation })}` : ''}
            </span>
          )}
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--bpmnr-text-muted)' }}>{t('agent.footer.source')}</span>
        </footer>
      </div>
    </div>
  );
}

function iconFor(type: NodeType): string {
  return type === 'llm' ? '🧠' : type === 'tool' ? '🛠' : '◆';
}

function subtitleFor(node: AgentNode): string {
  if (node.type === 'llm') return node.config.model;
  if (node.type === 'tool') return node.config.usesTool;
  return node.config.condition;
}

function Inspector({
  node,
  wf,
  t,
  toolProvider,
  promptProvider,
  onConfig,
  onToggle,
  onRemove,
}: {
  node: AgentNode;
  wf: AgentWorkflow;
  t: ReturnType<typeof useT>;
  toolProvider?: ToolProvider;
  promptProvider?: PromptProvider;
  onConfig: (patch: Record<string, unknown>) => void;
  onToggle: (d: 'memory' | 'planner' | 'errorBoundary') => void;
  onRemove: () => void;
}) {
  const has = (d: string) => (node.decorators ?? []).some((x) => x.type === d);
  // Wave 1 (SL-5) + Wave 2 (SL-6). Default = Intelligence (the daily-work tab,
  // prototype 02); Identity is metadata set once; Contracts is the I/O + tool
  // contract (O2). Decorators + remove stay BELOW the tabs — memory/governance
  // are Wave 3, and keeping them out preserves the errorBoundary proposal flow.
  const [tab, setTab] = useState<'intelligence' | 'identity' | 'contracts'>('intelligence');
  useEffect(() => setTab('intelligence'), [node.id]);
  const provider = node.type === 'llm' ? (node.config.provider ?? t('agent.inspector.providerDefault')) : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{iconFor(node.type)} {node.id}</div>
      <div className="bpmnr-agent-inspector-tabs" role="tablist" aria-label={t('agent.inspector.tabsAria')} style={agentTabStrip}>
        {(['intelligence', 'identity', 'contracts'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-agent-tab={id}
            onClick={() => setTab(id)}
            style={agentTabBtn(tab === id)}
          >
            {t(`agent.inspector.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'identity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-agent-tabpanel="identity">
          <div style={idRow}>
            <span style={idKey}>{t('agent.inspector.nodeType')}</span>
            <span>{t(`agent.node.${node.type}`)}</span>
          </div>
          <div style={idRow}>
            <span style={idKey}>{t('agent.inspector.nodeId')}</span>
            <code style={{ fontFamily: 'ui-monospace, monospace' }}>{node.id}</code>
          </div>
        </div>
      )}
      {tab === 'intelligence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-agent-tabpanel="intelligence">
          {node.type === 'llm' && (
            <>
              <Field label={t('agent.inspector.model')} value={node.config.model} onChange={(v) => onConfig({ model: v })} />
              <Field label={t('agent.inspector.prompt')} value={node.config.promptRef} onChange={(v) => onConfig({ promptRef: v })} />
              <div style={idRow}>
                <span style={idKey}>{t('agent.inspector.provider')}</span>
                <span>{provider}</span>
              </div>
              <label style={checkRow}>
                <input type="checkbox" checked={node.config.structuredOutput === true} onChange={(e) => onConfig({ structuredOutput: e.target.checked })} />
                {t('agent.inspector.structured')}
              </label>
              {promptProvider && (
                <PromptCoverageValidator t={t} wf={wf} promptRef={node.config.promptRef} provider={promptProvider} />
              )}
            </>
          )}
          {node.type === 'tool' && (
            <>
              <ToolBinding t={t} value={node.config.usesTool} provider={toolProvider} onChange={(v) => onConfig({ usesTool: v })} />
              <Field label={t('agent.inspector.timeout')} value={String(node.config.timeoutMs ?? '')} onChange={(v) => onConfig({ timeoutMs: Number(v) || undefined })} />
            </>
          )}
          {node.type === 'decision' && (
            <Field label={t('agent.inspector.condition')} value={node.config.condition} onChange={(v) => onConfig({ condition: v })} />
          )}
        </div>
      )}
      {tab === 'contracts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-agent-tabpanel="contracts">
          <div style={eyebrow}>{t('agent.contracts.io')}</div>
          <SchemaView label={t('agent.contracts.input')} schema={wf.inputSchema} />
          <SchemaView label={t('agent.contracts.output')} schema={wf.outputSchema} />
          {node.type === 'tool' && (
            <ToolContractView t={t} value={node.config.usesTool} provider={toolProvider} />
          )}
        </div>
      )}
      <div style={eyebrow}>{t('agent.inspector.decorators')}</div>
      {(['memory', 'planner', 'errorBoundary'] as const).map((d) => (
        <label key={d} style={checkRow}>
          <input type="checkbox" checked={has(d)} onChange={() => onToggle(d)} />
          {t(`agent.decorator.${d}`)}
        </label>
      ))}
      {has('errorBoundary') && <div style={notice}>{t('agent.decorator.boundaryNotice')}</div>}
      <button type="button" style={{ ...btn, minHeight: 36 }} onClick={onRemove}>{t('agent.inspector.remove')}</button>
    </div>
  );
}

/** Read-only schema view (Squad Lane SL-6, Wave 2) — `key: type`, `*` = required. */
function SchemaView({ label, schema }: { label: string; schema: SchemaShape }) {
  const normalized = normalizeSchema(schema);
  const keys = Object.keys(normalized);
  return (
    <div>
      <div style={idKey}>{label}</div>
      {keys.map((key) => (
        <div key={key} style={idRow}>
          <code style={{ fontFamily: 'ui-monospace, monospace' }}>
            {key}
            {normalized[key].required ? '*' : ''}
          </code>
          <span style={{ color: 'var(--bpmnr-text-muted)' }}>{normalized[key].type}</span>
        </div>
      ))}
    </div>
  );
}

/** Resolved tool contract summary (Squad Lane SL-6, Wave 2) — degrades honestly. */
function ToolContractView({
  t,
  value,
  provider,
}: {
  t: ReturnType<typeof useT>;
  value: string;
  provider?: ToolProvider;
}) {
  if (!provider) return <div style={notice}>{t('agent.contracts.noProvider')}</div>;
  let contract: ToolContract | undefined;
  try {
    contract = value ? provider.resolve(toRef(value)) : undefined;
  } catch {
    contract = undefined;
  }
  if (!contract) {
    return <div style={toolUnresolved} data-testid="agent-contract-unresolved">⚠ {t('agent.inspector.tool.unresolved')}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="agent-contract">
      <div style={eyebrow}>{t('agent.contracts.tool')}</div>
      <div style={idRow}><span style={idKey}>{t('agent.contracts.capability')}</span><span>{contract.capability}</span></div>
      <div style={idRow}><span style={idKey}>{t('agent.contracts.effect')}</span><span>{contract.effect}</span></div>
      <div style={idRow}><span style={idKey}>{t('agent.contracts.authorization')}</span><span>{contract.authorization}</span></div>
    </div>
  );
}

/**
 * Prompt coverage validator (Squad Lane SL-7, prototype 05). A transparent
 * textarea over a highlight backdrop paints each `{{var}}` — green when it is a
 * declared input, amber when it is unknown — plus a coverage bar. The prompt
 * TEXT is resolved through the injected provider (the body lives in the Library
 * btv:prompt artifact), and edits persist via `save` (never the AgentWorkflow);
 * without `save` the textarea is read-only. Resolve → undefined warns honestly.
 */
function PromptCoverageValidator({
  t,
  wf,
  promptRef,
  provider,
}: {
  t: ReturnType<typeof useT>;
  wf: AgentWorkflow;
  promptRef: string;
  provider: PromptProvider;
}) {
  const resolved = provider.resolve(promptRef);
  const [text, setText] = useState(resolved ?? '');
  useEffect(() => setText(provider.resolve(promptRef) ?? ''), [promptRef, provider]);
  const backdrop = useRef<HTMLDivElement | null>(null);
  if (resolved === undefined) {
    return <div style={toolUnresolved} data-testid="agent-coverage-unresolved">⚠ {t('agent.coverage.unresolved')}</div>;
  }
  const inputVars = Object.keys(wf.inputSchema);
  const used = new Set(promptVariables(text));
  const coveredCount = inputVars.filter((v) => used.has(v)).length;
  const readOnly = provider.save === undefined;
  const onChange = (value: string): void => {
    setText(value);
    provider.save?.(promptRef, value);
  };
  const percent = inputVars.length === 0 ? 0 : Math.round((coveredCount / inputVars.length) * 100);
  return (
    <div data-agent-coverage>
      <div style={eyebrow}>{t('agent.coverage.title')}</div>
      <div style={coverageWrap}>
        <div ref={backdrop} aria-hidden style={coverageBackdrop}>
          {highlightSegments(text, inputVars)}
        </div>
        <textarea
          value={text}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (backdrop.current) {
              backdrop.current.scrollTop = e.currentTarget.scrollTop;
              backdrop.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          aria-label={t('agent.coverage.title')}
          data-testid="agent-coverage-textarea"
          style={coverageTextarea}
        />
      </div>
      <div style={coverageTrack} role="progressbar" aria-valuenow={coveredCount} aria-valuemin={0} aria-valuemax={inputVars.length}>
        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--bpmnr-selected, #1a6a54)', transition: prefersReducedMotion() ? 'none' : 'width 160ms ease' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--bpmnr-text-muted)' }} data-testid="agent-coverage-bar">
        {t('agent.coverage.bar', { used: coveredCount, total: inputVars.length })}
      </div>
      {readOnly && <div style={{ fontSize: 10, color: '#7a611e' }}>{t('agent.coverage.readOnly')}</div>}
    </div>
  );
}

/** Splits prompt text into plain runs + highlighted `{{var}}` spans (SL-7). */
function highlightSegments(text: string, inputVars: string[]): React.ReactNode[] {
  const declared = new Set(inputVars);
  const pattern = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <mark key={key++} style={declared.has(match[1]) ? markCovered : markUnknown}>
        {match[0]}
      </mark>,
    );
    last = match.index + match[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/**
 * Business-language title per validation code (Squad Lane SL-6). Each stable
 * code maps to a localized title; an UNMAPPED code falls back to a generic
 * localized title (never a raw code string), with the code always shown beside.
 */
const PROBLEM_TITLE_KEYS: Record<string, string> = {
  EMPTY_INPUT_SCHEMA: 'agent.problem.emptyInputSchema',
  EMPTY_OUTPUT_SCHEMA: 'agent.problem.emptyOutputSchema',
  EDGE_ENDPOINT_MISSING: 'agent.problem.edgeEndpointMissing',
  DECISION_ROUTE_MISSING: 'agent.problem.decisionRouteMissing',
  DECISION_IMPLICIT_METRIC: 'agent.problem.implicitMetric',
  RETRY_WITHOUT_MAX: 'agent.problem.retryWithoutMax',
  CYCLE_WITHOUT_STOP: 'agent.problem.cycleWithoutStop',
  LLM_NOT_STRUCTURED: 'agent.problem.llmNotStructured',
  PROMPT_REF_INVALID: 'agent.problem.promptRefInvalid',
  PROMPT_REF_ABBREVIATED: 'agent.problem.refAbbreviated',
  DELEGATE_REF_INVALID: 'agent.problem.delegateRefInvalid',
  DELEGATE_REF_ABBREVIATED: 'agent.problem.refAbbreviated',
  DELEGATE_UNRESOLVED: 'agent.problem.delegateUnresolved',
  AUTONOMY_INCOHERENT: 'agent.problem.autonomyIncoherent',
  TOOL_REF_INVALID: 'agent.problem.toolRefInvalid',
  TOOL_REF_ABBREVIATED: 'agent.problem.refAbbreviated',
  TOOL_UNRESOLVED: 'agent.problem.toolUnresolved',
  TOOL_PARAMS_MISMATCH: 'agent.problem.toolParamsMismatch',
  TOOL_EFFECT_UNGATED: 'agent.problem.toolEffectUngated',
  SCHEMA_UNSUPPORTED_KEYWORD: 'agent.problem.schemaUnsupported',
  DELEGATE_CONTRACT_MISMATCH: 'agent.problem.delegateContractMismatch',
  DELEGATE_CYCLE: 'agent.problem.delegateCycle',
  AUTONOMY_CHAIN: 'agent.problem.autonomyChain',
  BUDGET_MISSING: 'agent.problem.budgetMissing',
  PROMPT_VAR_UNUSED: 'agent.problem.promptVarUnused',
};

function businessTitle(t: ReturnType<typeof useT>, code: string): string {
  return t(PROBLEM_TITLE_KEYS[code] ?? 'agent.problem.fallback');
}

/**
 * Localized business remediation per code (Squad Lane SL-6 follow-up, i18n F5).
 * The headless `remediation` stays EN (host-agnostic guidance); the UI shows a
 * localized version keyed by code, falling back to the EN string when a code has
 * no mapping yet (the SL-13 sweep closes the remainder). A generic localized
 * sentence (no node-specific detail) is intentional — the stable code + Locate
 * carry the specifics.
 */
const PROBLEM_REMEDIATION_KEYS: Record<string, string> = {
  EMPTY_INPUT_SCHEMA: 'agent.remediation.emptyInputSchema',
  EMPTY_OUTPUT_SCHEMA: 'agent.remediation.emptyOutputSchema',
  EDGE_ENDPOINT_MISSING: 'agent.remediation.edgeEndpointMissing',
  DECISION_ROUTE_MISSING: 'agent.remediation.decisionRouteMissing',
  DECISION_IMPLICIT_METRIC: 'agent.remediation.implicitMetric',
  RETRY_WITHOUT_MAX: 'agent.remediation.retryWithoutMax',
  CYCLE_WITHOUT_STOP: 'agent.remediation.cycleWithoutStop',
  LLM_NOT_STRUCTURED: 'agent.remediation.llmNotStructured',
  PROMPT_REF_INVALID: 'agent.remediation.promptRefInvalid',
  DELEGATE_REF_INVALID: 'agent.remediation.delegateRefInvalid',
  AUTONOMY_INCOHERENT: 'agent.remediation.autonomyIncoherent',
  TOOL_REF_INVALID: 'agent.remediation.toolRefInvalid',
  TOOL_PARAMS_MISMATCH: 'agent.remediation.toolParamsMismatch',
  TOOL_EFFECT_UNGATED: 'agent.remediation.toolEffectUngated',
  DELEGATE_CONTRACT_MISMATCH: 'agent.remediation.delegateContractMismatch',
  DELEGATE_CYCLE: 'agent.remediation.delegateCycle',
  AUTONOMY_CHAIN: 'agent.remediation.autonomyChain',
  BUDGET_MISSING: 'agent.remediation.budgetMissing',
  SCHEMA_UNSUPPORTED_KEYWORD: 'agent.remediation.schemaUnsupported',
  PROMPT_VAR_UNUSED: 'agent.remediation.promptVarUnused',
};

function businessRemediation(
  t: ReturnType<typeof useT>,
  code: string,
  headless: string | undefined,
): string | undefined {
  const key = PROBLEM_REMEDIATION_KEYS[code];
  return key ? t(key) : headless; // localized, else the EN headless guidance
}

/**
 * Problems Panel (Squad Lane SL-6) — validation issues in BUSINESS language with
 * the stable code beside each. "Locate" selects the node (no scrollIntoView);
 * a safe/undoable quick-fix appears only for codes that cannot change the I/O
 * contract (cerca §2 / prototype 04).
 */
function ProblemsPanel({
  t,
  issues,
  onLocate,
  onQuickFix,
}: {
  t: ReturnType<typeof useT>;
  issues: ValidationIssue[];
  onLocate: (nodeId: string) => void;
  onQuickFix: (issue: ValidationIssue) => void;
}) {
  return (
    <div style={{ marginTop: 12 }} data-agent-problems>
      <div style={eyebrow}>{t('agent.problems.title')}</div>
      {issues.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--bpmnr-selected, #1a6a54)' }}>✓ {t('agent.problems.empty')}</div>
      ) : (
        issues.map((issue, i) => (
          <div key={`${issue.code}-${issue.nodeId ?? ''}-${i}`} style={problemRow} data-problem-code={issue.code}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: issue.severity === 'error' ? 'var(--bpmnr-error, #b3261e)' : '#7a611e' }}>
                {issue.severity === 'error' ? '✗' : '⚠'}
              </span>
              <strong style={{ fontSize: 11.5 }}>{businessTitle(t, issue.code)}</strong>
              <code style={problemCode}>{issue.code}</code>
            </div>
            {businessRemediation(t, issue.code, issue.remediation) && (
              <p style={{ fontSize: 10, color: 'var(--bpmnr-text-muted)', margin: '2px 0 0' }}>
                {businessRemediation(t, issue.code, issue.remediation)}
              </p>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {issue.nodeId && (
                <button type="button" style={miniBtn} data-locate={issue.nodeId} onClick={() => onLocate(issue.nodeId!)}>
                  {t('agent.problems.locate')}
                </button>
              )}
              {hasQuickFix(issue.code) && (
                <button type="button" style={miniBtn} data-quick-fix={issue.code} onClick={() => onQuickFix(issue)}>
                  {t('agent.problems.fix')}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * The simulation trail view — replaces the inspector in sim mode. It renders
 * the agentflow engine's result via the SAME trail UI + the SAME block chip
 * (BlockedDecisionNotice) as the H7 simulator, through the shared result shape
 * — zero adapter, zero UI fork. BlockedDecision shows node + reason + count.
 */
function SimulationView({
  t,
  state,
  status,
  recorded,
  canRecord,
  onRecord,
}: {
  t: ReturnType<typeof useT>;
  state: SimulationState;
  status: string;
  recorded: boolean;
  canRecord: boolean;
  onRecord: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-agent-sim-view>
      <div>
        <div style={eyebrow}>{t('agent.sim.eyebrow')}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }} data-agent-sim-status>{status}</div>
        <div style={{ fontSize: 10, color: 'var(--bpmnr-text-muted)' }}>{t('agent.sim.hint')}</div>
      </div>
      <div className="bpmnr-sim-card bpmnr-sim-trail-card">
        <div className="bpmnr-sim-card-title">{t('agent.sim.trail')}</div>
        <div className="bpmnr-sim-trail" data-sim-trail>
          {state.trail.map((entry) => (
            <div key={entry.step}>{entry.message}</div>
          ))}
        </div>
      </div>
      {state.blockedDecision && <BlockedDecisionNotice blocked={state.blockedDecision} />}
      {canRecord && !recorded && (
        <button type="button" style={{ ...btn, minHeight: 36 }} onClick={onRecord} data-testid="agent-record">
          {t('agent.sim.record')}
        </button>
      )}
      {recorded && (
        <div style={{ fontSize: 11, color: 'var(--bpmnr-selected, #1a6a54)' }} data-testid="agent-recorded">
          {t('agent.sim.recorded')}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
      <span style={{ color: 'var(--bpmnr-text-muted)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={input} />
    </label>
  );
}

/**
 * Squad Lane SL-2 — binds a tool node to a `tool:*@semver` contract. With a
 * ToolProvider that lists a catalog, it is a selector (impossible to type a
 * loose string — cerca §2.2); the resolved contract's effect + capability show
 * inline, and an unresolvable ref surfaces a declared warning (never silent).
 * With no provider it degrades to a typed text field (the pre-SL-2 behavior).
 */
function ToolBinding({
  t,
  value,
  provider,
  onChange,
}: {
  t: ReturnType<typeof useT>;
  value: string;
  provider?: ToolProvider;
  onChange: (v: string) => void;
}) {
  const catalog = provider?.list?.() ?? [];
  if (!provider || catalog.length === 0) {
    return <Field label={t('agent.inspector.tool')} value={value} onChange={onChange} />;
  }
  let resolved: ToolContract | undefined;
  try {
    resolved = value ? provider.resolve(toRef(value)) : undefined;
  } catch {
    resolved = undefined;
  }
  const inCatalog = catalog.some((c) => formatRef(c) === value);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
      <span style={{ color: 'var(--bpmnr-text-muted)' }}>{t('agent.inspector.tool')}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={input} data-testid="agent-tool-select" aria-label={t('agent.inspector.tool')}>
        {!inCatalog && <option value={value}>{value || t('agent.inspector.tool.placeholder')}</option>}
        {catalog.map((c) => {
          const ref = formatRef(c);
          return (
            <option key={ref} value={ref}>
              {c.name} — {ref}
            </option>
          );
        })}
      </select>
      {resolved ? (
        <span style={toolMeta} data-testid="agent-tool-effect">
          {t('agent.inspector.tool.effect', { effect: resolved.effect })} · {resolved.capability}
        </span>
      ) : (
        <span style={toolUnresolved} data-testid="agent-tool-unresolved">
          ⚠ {t('agent.inspector.tool.unresolved')}
        </span>
      )}
    </label>
  );
}

// ── inline styles (theme tokens; the notation gets no new AI color) ─────────
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(46,42,38,0.55)', display: 'flex', padding: 20, zIndex: 50 };
const modal: React.CSSProperties = { position: 'relative', margin: 'auto', width: 'min(1340px, 100%)', height: '100%', background: 'var(--bpmnr-canvas-bg, #faf9f6)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const chooser: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', background: 'var(--bpmnr-canvas-bg, #faf9f6)' };
const proposalCard: React.CSSProperties = { position: 'absolute', right: 20, bottom: 44, width: 320, background: 'var(--bpmnr-fill, #fff)', border: '1px solid #e8d9ae', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 5 };
const headerStyle: React.CSSProperties = { height: 54, flexShrink: 0, background: 'var(--bpmnr-fill, #fff)', borderBottom: '1px solid var(--bpmnr-border, #e2ddd3)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' };
const seal: React.CSSProperties = { background: '#f6edd4', color: '#7a611e', fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 999, padding: '3px 10px' };
const autonomyPill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 999, padding: '5px 12px', fontSize: 12 };
const btn: React.CSSProperties = { minHeight: 44, minWidth: 44, border: '1px solid var(--bpmnr-border, #e2ddd3)', background: 'transparent', borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontSize: 13 };
const btnPrimary: React.CSSProperties = { ...btn, border: 'none', background: 'var(--bpmnr-btv-gold, #9a7b1e)', color: '#fff', fontWeight: 600 };
const palette: React.CSSProperties = { width: 176, flexShrink: 0, background: 'var(--bpmnr-fill, #fff)', borderRight: '1px solid var(--bpmnr-border, #e2ddd3)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' };
const eyebrow: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: 1.8, color: 'var(--bpmnr-btv-gold, #9a7b1e)', marginTop: 4 };
const paletteItem: React.CSSProperties = { minHeight: 44, border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', textAlign: 'left' };
const paletteIcon: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bpmnr-fill-event, #e3ecf7)' };
const templateItem: React.CSSProperties = { minHeight: 36, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: 11, color: 'var(--bpmnr-agent-tool, #33567e)' };
const inspector: React.CSSProperties = { width: 296, flexShrink: 0, background: 'var(--bpmnr-fill, #fff)', borderLeft: '1px solid var(--bpmnr-border, #e2ddd3)', overflowY: 'auto', padding: 13 };
const footer: React.CSSProperties = { height: 30, flexShrink: 0, background: 'var(--bpmnr-fill, #fff)', borderTop: '1px solid var(--bpmnr-border, #e2ddd3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', fontSize: 11 };
const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, minHeight: 28 };
const input: React.CSSProperties = { border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 6, padding: '5px 7px', fontSize: 11, fontFamily: 'ui-monospace, monospace' };
const notice: React.CSSProperties = { fontSize: 10, color: '#7a611e', background: '#fdfaf1', border: '1px solid #e8d9ae', borderRadius: 7, padding: '6px 8px', lineHeight: 1.5 };
const agentTabStrip: React.CSSProperties = { display: 'flex', gap: 4, borderBottom: '1px solid var(--bpmnr-border, #e2ddd3)' };
const agentTabBtn = (active: boolean): React.CSSProperties => ({
  minHeight: 30,
  border: 'none',
  borderBottom: active ? '2px solid var(--bpmnr-btv-gold, #9a7b1e)' : '2px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 11.5,
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--bpmnr-text, #2e2a26)' : 'var(--bpmnr-text-muted, #6f675a)',
  padding: '4px 8px',
});
const idRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 };
const idKey: React.CSSProperties = { color: 'var(--bpmnr-text-muted)' };
const coverageWrap: React.CSSProperties = { position: 'relative', border: '1px solid var(--bpmnr-border, #e2ddd3)', borderRadius: 6, minHeight: 76 };
const coverageShared: React.CSSProperties = { margin: 0, padding: '6px 7px', fontSize: 11, fontFamily: 'ui-monospace, monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxSizing: 'border-box', minHeight: 76 };
const coverageBackdrop: React.CSSProperties = { ...coverageShared, position: 'absolute', inset: 0, color: 'var(--bpmnr-text, #2e2a26)', pointerEvents: 'none', overflow: 'auto' };
const coverageTextarea: React.CSSProperties = { ...coverageShared, position: 'relative', display: 'block', width: '100%', background: 'transparent', color: 'transparent', caretColor: 'var(--bpmnr-text, #2e2a26)', border: 'none', outline: 'none', resize: 'vertical' };
const coverageTrack: React.CSSProperties = { height: 6, background: 'var(--bpmnr-border, #e2ddd3)', borderRadius: 3, overflow: 'hidden', marginTop: 6 };
const markCovered: React.CSSProperties = { background: 'rgba(26,106,84,0.20)', color: 'inherit', borderRadius: 3 };
const markUnknown: React.CSSProperties = { background: 'rgba(122,97,30,0.20)', color: 'inherit', borderRadius: 3 };
const problemRow: React.CSSProperties = { borderTop: '1px solid var(--bpmnr-border, #e2ddd3)', padding: '6px 0' };
const problemCode: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 9, color: 'var(--bpmnr-text-muted)', marginLeft: 'auto' };
const miniBtn: React.CSSProperties = { minHeight: 26, border: '1px solid var(--bpmnr-border, #e2ddd3)', background: 'transparent', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 10.5 };
const toolMeta: React.CSSProperties = { fontSize: 10, color: 'var(--bpmnr-agent-tool, #33567e)', lineHeight: 1.4 };
const toolUnresolved: React.CSSProperties = { fontSize: 10, color: '#7a611e', background: '#fdfaf1', border: '1px solid #e8d9ae', borderRadius: 7, padding: '4px 7px', lineHeight: 1.4 };
