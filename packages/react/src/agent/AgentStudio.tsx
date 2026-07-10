import { useEffect, useReducer, useState } from 'react';
import {
  AUTONOMY_SCALE,
  minCoherentLevel,
  requiresDownstreamGate,
  TEMPLATES,
  validateGraph,
  type AgentNode,
  type AgentWorkflow,
  type NodeType,
  type ValidationIssue,
} from '@buildtovalue/agentflow';
import { useDismissal } from '../gestures/useDismissal.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useT } from '../i18n/I18nContext.js';
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
  const { open, workflow, workflowRef, lifecycleStatus, openedFrom, onSave, onClose } = props;
  const t = useT();
  const { emitEditorEvent } = useEditorConfig();
  const [state, dispatch] = useReducer(agentEditorReducer, workflow, initEditorState);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useDismissal('agent-studio', open, onClose);

  // Reset the isolated history whenever a different sub-workflow is opened.
  useEffect(() => {
    dispatch({ type: 'reset', workflow });
    setSelectedId(null);
  }, [workflow]);

  if (!open) return null;

  const wf = state.present;

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

  const issues: ValidationIssue[] = validateGraph(wf);
  const errors = issues.filter((i) => i.severity === 'error');
  const level = wf.autonomyLevel;
  const needsGate = requiresDownstreamGate(level);
  const selected = wf.nodes.find((n) => n.id === selectedId) ?? null;
  const layout = layoutWorkflow(wf);
  const pos = new Map(layout.map((l) => [l.id, l]));
  const width = Math.max(560, ...layout.map((l) => l.x + l.width + 24));
  const height = Math.max(300, ...layout.map((l) => l.y + l.height + 24));

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
          <button type="button" style={btnPrimary} onClick={() => onSave(wf)}>{t('agent.action.save')}</button>
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
          <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--bpmnr-canvas-bg, #faf9f6)' }}>
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
            </svg>
          </main>

          {/* inspector */}
          <aside style={inspector} aria-label={t('agent.inspector.aria')}>
            <div style={eyebrow}>{t('agent.inspector.title')}</div>
            {!selected && <div style={{ fontSize: 12, color: 'var(--bpmnr-text-muted)' }}>{t('agent.inspector.empty')}</div>}
            {selected && <Inspector node={selected} t={t} onConfig={(patch) => apply(updateNodeConfig(wf, selected.id, patch))} onToggle={(d) => apply(toggleDecorator(wf, selected.id, d))} onRemove={() => { apply(removeNode(wf, selected.id)); setSelectedId(null); }} />}
          </aside>
        </div>

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
  t,
  onConfig,
  onToggle,
  onRemove,
}: {
  node: AgentNode;
  t: ReturnType<typeof useT>;
  onConfig: (patch: Record<string, unknown>) => void;
  onToggle: (d: 'memory' | 'planner' | 'errorBoundary') => void;
  onRemove: () => void;
}) {
  const has = (d: string) => (node.decorators ?? []).some((x) => x.type === d);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{iconFor(node.type)} {node.id}</div>
      {node.type === 'llm' && (
        <>
          <Field label={t('agent.inspector.model')} value={node.config.model} onChange={(v) => onConfig({ model: v })} />
          <Field label={t('agent.inspector.prompt')} value={node.config.promptRef} onChange={(v) => onConfig({ promptRef: v })} />
          <label style={checkRow}>
            <input type="checkbox" checked={node.config.structuredOutput === true} onChange={(e) => onConfig({ structuredOutput: e.target.checked })} />
            {t('agent.inspector.structured')}
          </label>
        </>
      )}
      {node.type === 'tool' && (
        <>
          <Field label={t('agent.inspector.tool')} value={node.config.usesTool} onChange={(v) => onConfig({ usesTool: v })} />
          <Field label={t('agent.inspector.timeout')} value={String(node.config.timeoutMs ?? '')} onChange={(v) => onConfig({ timeoutMs: Number(v) || undefined })} />
        </>
      )}
      {node.type === 'decision' && (
        <Field label={t('agent.inspector.condition')} value={node.config.condition} onChange={(v) => onConfig({ condition: v })} />
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
      <span style={{ color: 'var(--bpmnr-text-muted)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={input} />
    </label>
  );
}

// ── inline styles (theme tokens; the notation gets no new AI color) ─────────
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(46,42,38,0.55)', display: 'flex', padding: 20, zIndex: 50 };
const modal: React.CSSProperties = { margin: 'auto', width: 'min(1340px, 100%)', height: '100%', background: 'var(--bpmnr-canvas-bg, #faf9f6)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
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
