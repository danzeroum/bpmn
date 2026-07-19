import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useT } from '../i18n/I18nContext.js';
import { theme } from '../shapes/common.js';

/** Dashed preview line while a connection gesture is in progress. */
export function ConnectionPreview() {
  const connect = useCanvasState((s) => s.connectState);
  if (!connect) return null;
  const invalid = connect.invalidReason !== null;
  return (
    <g pointerEvents="none" data-connection-preview>
      <line
        className="bpmnr-connect-preview-line"
        x1={connect.sourcePoint.x}
        y1={connect.sourcePoint.y}
        x2={connect.currentPoint.x}
        y2={connect.currentPoint.y}
        stroke={invalid ? 'var(--bpmnr-danger, #b3372f)' : theme.strokeSelected}
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <circle
        cx={connect.currentPoint.x}
        cy={connect.currentPoint.y}
        r={4}
        fill={invalid ? 'var(--bpmnr-danger, #b3372f)' : theme.strokeSelected}
      />
      {invalid && connect.invalidReason && (
        <text
          x={connect.currentPoint.x + 10}
          y={connect.currentPoint.y - 10}
          fontSize={11}
          fill="var(--bpmnr-danger, #b3372f)"
        >
          {connect.invalidReason}
        </text>
      )}
    </g>
  );
}

/**
 * Border highlight while an event drags inside an activity's boundary snap
 * zone (Handoff 11 N-1): the host border strokes selected/2px with a 120ms
 * fade, plus a dot on the exact parametric anchor the drop will attach to.
 */
export function BoundarySnapOverlay() {
  const snap = useCanvasState((s) => s.boundarySnap);
  const { diagram } = useDiagram();
  const host = snap ? diagram.nodes[snap.hostId] : undefined;
  if (!snap || !host) return null;
  return (
    <g pointerEvents="none" data-testid="boundary-snap-highlight">
      <rect
        x={host.x}
        y={host.y}
        width={host.width}
        height={host.height}
        fill="none"
        stroke={theme.strokeSelected}
        strokeWidth={2}
        style={{ transition: 'opacity 120ms ease-out' }}
      />
      <circle cx={snap.point.x} cy={snap.point.y} r={5} fill={theme.strokeSelected} />
    </g>
  );
}

/**
 * Border highlight while a node drags over an expanded sub-process that would
 * adopt it on drop (F7 reparent-on-drop). Reuses the boundary-snap affordance
 * — the candidate container strokes selected/2px with the same 120ms fade — so
 * "highlight now, reparent on drop" reads identically to "highlight now, attach
 * on drop". No highlight ⇒ no reparent. Boundary snap has precedence, so this
 * and the boundary highlight are never armed at once.
 */
export function ReparentTargetOverlay() {
  const targetId = useCanvasState((s) => (s.dragState?.active ? s.dragState.reparentTargetId : null));
  const { diagram } = useDiagram();
  const container = targetId ? diagram.nodes[targetId] : undefined;
  if (!container) return null;
  return (
    <g pointerEvents="none" data-testid="reparent-target-highlight">
      <rect
        x={container.x}
        y={container.y}
        width={container.width}
        height={container.height}
        fill="none"
        stroke={theme.strokeSelected}
        strokeWidth={2}
        style={{ transition: 'opacity 120ms ease-out' }}
      />
    </g>
  );
}

/** Lasso rectangle during box selection. */
export function SelectionBoxOverlay() {
  const box = useCanvasState((s) => s.selectionBox);
  if (!box) return null;
  const x = Math.min(box.start.x, box.current.x);
  const y = Math.min(box.start.y, box.current.y);
  const width = Math.abs(box.current.x - box.start.x);
  const height = Math.abs(box.current.y - box.start.y);
  if (width < 2 && height < 2) return null;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="var(--bpmnr-lasso-fill, rgba(26, 106, 84, 0.08))"
      stroke={theme.strokeSelected}
      strokeWidth={1}
      strokeDasharray="4,3"
      pointerEvents="none"
      data-selection-box
    />
  );
}


/** Smart alignment guides + equal-spacing badges (Handoff 14 §1b) — draw-only. */
export function AlignmentGuidesOverlay() {
  const guides = useCanvasState((s) => s.alignGuides);
  const badges = useCanvasState((s) => s.spacingBadges);
  if (!guides && !badges) return null;
  return (
    <g pointerEvents="none" data-alignment-guides>
      {guides?.map((guide, index) => (
        <line
          key={`g${index}`}
          className="bpmnr-align-guide"
          x1={guide.axis === 'v' ? guide.position : guide.from}
          x2={guide.axis === 'v' ? guide.position : guide.to}
          y1={guide.axis === 'v' ? guide.from : guide.position}
          y2={guide.axis === 'v' ? guide.to : guide.position}
        />
      ))}
      {badges?.map((b, index) => {
        const mid = (b.from + b.to) / 2;
        const x = b.axis === 'h' ? mid : b.position;
        const y = b.axis === 'h' ? b.position : mid;
        return (
          <g key={`b${index}`} data-spacing-badge={b.value}>
            <line
              className="bpmnr-align-guide"
              x1={b.axis === 'h' ? b.from : b.position}
              x2={b.axis === 'h' ? b.to : b.position}
              y1={b.axis === 'h' ? b.position : b.from}
              y2={b.axis === 'h' ? b.position : b.to}
            />
            <rect
              className="bpmnr-spacing-badge"
              x={x - 19}
              y={y - 8}
              width={38}
              height={16}
              rx={8}
            />
            {/* i18n-exempt — numeric measurement, no prose */}
            <text className="bpmnr-spacing-badge-text" x={x} y={y + 3.5} textAnchor="middle">
              {b.value}px
            </text>
          </g>
        );
      })}
    </g>
  );
}


/**
 * Two expanding halo rings around the latest search hit (Handoff 14 §1c).
 * Pure CSS animation (2 rings, staggered); cleared when the outer ring ends.
 * Never rendered under reduced motion — the store field stays null.
 */
export function SearchPulseOverlay() {
  const pulse = useCanvasState((s) => s.searchPulse);
  const store = useCanvasStore();
  const { diagram } = useDiagram();
  if (!pulse) return null;
  const node = diagram.nodes[pulse.elementId];
  if (!node) return null;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const base = Math.max(node.width, node.height) / 2 + 8;
  return (
    <g pointerEvents="none" data-search-pulse key={pulse.token}>
      <circle className="bpmnr-search-pulse" cx={cx} cy={cy} r={base} />
      <circle
        className="bpmnr-search-pulse bpmnr-search-pulse-late"
        cx={cx}
        cy={cy}
        r={base}
        onAnimationEnd={() => {
          if (store.getState().searchPulse?.token === pulse.token) {
            store.setState({ searchPulse: null });
          }
        }}
      />
    </g>
  );
}

/**
 * Target-position ghosts of the pending auto-layout (Handoff 14 §1e): while
 * the Aplicar/Recusar card is open, every node the layout wants to move shows
 * a dashed outline at its PROPOSED position — the "DEPOIS" preview. Nothing
 * on the real diagram moves until the user applies. Stripped from exports
 * (TRANSIENT_SELECTORS).
 */
export function LayoutPreviewOverlay() {
  const proposal = useCanvasState((s) => s.layoutProposal);
  if (!proposal) return null;
  return (
    <g pointerEvents="none" data-layout-preview>
      {proposal.moved.map((move) => (
        <g key={move.id}>
          <line
            className="bpmnr-layout-preview-trace"
            x1={move.from.x + move.width / 2}
            y1={move.from.y + move.height / 2}
            x2={move.to.x + move.width / 2}
            y2={move.to.y + move.height / 2}
          />
          <rect
            className="bpmnr-layout-preview-ghost"
            x={move.to.x}
            y={move.to.y}
            width={move.width}
            height={move.height}
            rx={8}
          />
        </g>
      ))}
    </g>
  );
}

/**
 * Governed-binding chip (Handoff 16 §3b): every event carrying a pinned
 * `nome@semver` binding shows a mono chip below the node — the binding text
 * plus a GLYPH+TEXT state seal (✓ VIGENTE / ⚠ CANDIDATA / ✕ NÃO RESOLVIDA),
 * never color alone. Without a resolver the chip renders the binding text
 * with the declared-degradation notice glyph (~). Transient: never exported.
 */
export function EventBindingOverlay() {
  const { diagram } = useDiagram();
  const config = useEditorConfig();
  const t = useT();
  const resolver = config.eventDefinitionResolver;
  const chips = Object.values(diagram.nodes).filter(
    (node) => !node.removedInVersion && typeof node.properties.eventDefinitionBinding === 'string',
  );
  // Authority chip (Handoff 18 §5b): an escalation catch declaring
  // `properties.escalationAuthority` (settled value — the diagram only updates
  // on the inspector's blur-commit). Empty string = absent → no chip (never an
  // empty chip). Transient: the value serializes as bpmnr:, the chip never does.
  const authorityChips = Object.values(diagram.nodes).filter(
    (node) =>
      !node.removedInVersion &&
      node.properties.eventDefinition === 'escalation' &&
      typeof node.properties.escalationAuthority === 'string' &&
      node.properties.escalationAuthority.trim() !== '',
  );
  // Compensation chip (Handoff 19 §6b): a compensate THROW shows «⟲ compensa:
  // {activity|scope}» — the SETTLED activityRef names the target; absent =
  // broadcast over the scope. Transient (never exported), glyph + text.
  const compensationChips = Object.values(diagram.nodes).filter(
    (node) =>
      !node.removedInVersion &&
      node.properties.eventDefinition === 'compensate' &&
      (node.type === 'intermediateThrowEvent' || node.type === 'endEvent'),
  );
  if (chips.length === 0 && authorityChips.length === 0 && compensationChips.length === 0) {
    return null;
  }
  return (
    <g data-event-bindings>
      {chips.map((node) => {
        const binding = node.properties.eventDefinitionBinding as string;
        const kind = node.properties.eventDefinition;
        const refKind =
          kind === 'message' || kind === 'signal' || kind === 'error' || kind === 'escalation'
            ? kind
            : null;
        let seal = `~ ${t('eventDefs.binding.unresolved')}`;
        let state = 'degraded';
        if (resolver && refKind) {
          const resolved = resolver.resolve(binding, refKind);
          if (!resolved) {
            seal = `✕ ${t('eventDefs.binding.missing')}`;
            state = 'missing';
          } else if (resolved.status === 'active') {
            seal = `✓ ${t('eventDefs.binding.active')}`;
            state = 'active';
          } else {
            seal = `⚠ ${t('eventDefs.binding.stale')}`;
            state = 'stale';
          }
        }
        const cx = node.x + node.width / 2;
        const top = node.y + node.height + 12;
        return (
          <g
            key={node.id}
            className="bpmnr-event-binding"
            data-event-binding={node.id}
            data-binding-state={state}
          >
            <text x={cx} y={top} textAnchor="middle" className="bpmnr-event-binding-ref">
              {binding}
            </text>
            <text x={cx} y={top + 11} textAnchor="middle" className="bpmnr-event-binding-seal">
              {seal}
            </text>
          </g>
        );
      })}
      {authorityChips.map((node) => {
        const authority = (node.properties.escalationAuthority as string).trim();
        const cx = node.x + node.width / 2;
        // Sit below the governed seal when this node also shows a binding chip.
        const hasBinding = typeof node.properties.eventDefinitionBinding === 'string';
        const top = node.y + node.height + (hasBinding ? 34 : 12);
        return (
          <g
            key={`auth-${node.id}`}
            className="bpmnr-event-authority"
            data-event-authority={node.id}
          >
            {/* i18n-exempt — the ↟ glyph; the text is the translation */}
            <text x={cx} y={top} textAnchor="middle" className="bpmnr-event-authority-chip">
              {`↟ ${t('eventDefs.authority.chip', { name: authority })}`}
            </text>
          </g>
        );
      })}
      {compensationChips.map((node) => {
        const ref = node.properties.compensateActivityRef;
        const target =
          typeof ref === 'string' && ref.trim() !== ''
            ? diagram.nodes[ref]?.label || ref
            : undefined;
        const cx = node.x + node.width / 2;
        const top = node.y + node.height + 12;
        return (
          <g
            key={`comp-${node.id}`}
            className="bpmnr-event-compensation"
            data-event-compensation={node.id}
          >
            {/* i18n-exempt — the ⟲ glyph; the text is the translation */}
            <text x={cx} y={top} textAnchor="middle" className="bpmnr-event-compensation-chip">
              {`⟲ ${
                target !== undefined
                  ? t('eventDefs.compensation.chip', { name: target })
                  : t('eventDefs.compensation.broadcast')
              }`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
