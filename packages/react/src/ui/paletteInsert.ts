import {
  addEventDefinitionCommand,
  addNodeCommand,
  boundaryAnchorOf,
  boundaryNodePosition,
  compositeCommand,
  createNode,
  nextEventDefinitionId,
  type BpmnDiagram,
  type Command,
  type NodeTypeRegistry,
  type RuleVerdict,
} from '@buildtovalue/core';
import { compensationHandlerCommands, typedMessageStartCommands } from '@buildtovalue/lint';
import { findNodeAtPoint } from '../canvas/hitTest.js';
import { SUBPROCESS_TITLE_HEIGHT } from '../shapes/shapes.js';
import type { CanvasStore } from '../state/canvasStore.js';
import type { PaletteBuildContext, PaletteInsertResult, PaletteItem } from '../plugins/types.js';

/** i18n-additive label: `palette.item.{id}` when the dictionary has it. */
export function paletteItemLabel(
  t: PaletteBuildContext['t'],
  item: PaletteItem,
): string {
  const key = `palette.item.${item.id}`;
  const translated = t(key);
  return translated === key ? item.label : translated;
}

function snap(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
}

/**
 * Insert a palette item near the viewport center (grid-snapped, jittered) —
 * the ONE code path shared by the palette click and the ⌘K entry (ES-2
 * reforço 8): position math + factory + selection in a single place.
 */
export function insertPaletteItem(
  item: PaletteItem,
  deps: {
    diagram: BpmnDiagram;
    registry: NodeTypeRegistry;
    store: CanvasStore;
    t: PaletteBuildContext['t'];
    execute: (command: Command) => RuleVerdict;
    /** 🔒 channel — a build that declines (reforço 7) announces here, never a silent no-op. */
    announceVeto: (reason: string) => void;
  },
): RuleVerdict {
  const { viewport, gridSize, snapEnabled } = deps.store.getState();
  const cx = viewport.x + viewport.width / 2;
  const cy = viewport.y + viewport.height / 2;
  const def = deps.registry.get(item.nodeType);
  // Offset repeated inserts so nodes don't stack exactly.
  const jitter = (Object.keys(deps.diagram.nodes).length % 5) * (gridSize || 20);
  const x = snap(cx - def.defaultSize.width / 2 + jitter, snapEnabled ? gridSize : 0);
  const y = snap(cy - def.defaultSize.height / 2 + jitter, snapEnabled ? gridSize : 0);
  const result = paletteInsertCommand(item, {
    diagram: deps.diagram,
    registry: deps.registry,
    x,
    y,
    t: deps.t,
  });
  // Reforço 7: a declined insert (e.g. boundary with no host under the drop)
  // lights the 🔒 with the declared reason — never an orphan, never a mute no-op.
  if ('veto' in result) {
    deps.announceVeto(result.veto);
    return { allowed: false, reason: result.veto };
  }
  const verdict = deps.execute(result.command);
  if (verdict.allowed) {
    deps.store.setState({ selectedIds: [result.selectId], lastCreatedNodeId: result.selectId });
  } else if (verdict.reason) {
    deps.announceVeto(verdict.reason);
  }
  return verdict;
}

/**
 * THE single insert factory of the palette (Handoff 17 ES-2, reforço 8): the
 * palette click and the ⌘K entry both resolve an item through this function —
 * one command, one source, never two code paths. Plain items produce an
 * `addNodeCommand`; composite items delegate to their {@link PaletteItem.build}.
 */
export function paletteInsertCommand(
  item: PaletteItem,
  ctx: PaletteBuildContext,
): PaletteInsertResult {
  if (item.build) return item.build(ctx);
  const node = createNode(
    {
      type: item.nodeType,
      x: ctx.x,
      y: ctx.y,
      properties: item.defaultProperties ? { ...item.defaultProperties } : {},
      versionId: ctx.diagram.version.id,
    },
    ctx.registry,
  );
  return { command: addNodeCommand(node), selectId: node.id };
}

/**
 * «Subprocesso de evento» (§4b): container + typed message start + NAMED
 * definition referenced — ONE composite (1 undo). The start+definition half
 * comes from the SHARED `typedMessageStartCommands` builder in the lint
 * package (Handoff 17 ES-4 anti-drift): the EVT_SUBPROC_START 0-starts
 * quick-fix composes the SAME builder — one FORM, one source (ES-0 decision
 * 4), so every fresh drop is lint-clean by construction.
 */
export function buildEventSubprocessInsert(ctx: PaletteBuildContext): {
  command: Command;
  selectId: string;
} {
  const { diagram, registry, x, y, t } = ctx;
  const sub = createNode(
    {
      type: 'subProcess',
      x,
      y,
      properties: { triggeredByEvent: true, isExpanded: true },
      versionId: diagram.version.id,
    },
    registry,
  );
  const { commands } = typedMessageStartCommands(diagram, {
    parentId: sub.id,
    x: x + 24,
    y: y + SUBPROCESS_TITLE_HEIGHT + 18,
    definitionName: t('eventDefs.defaultName.message'),
  });
  return {
    command: compositeCommand(t('palette.compose.eventSubprocess'), [
      addNodeCommand(sub),
      ...commands,
    ]),
    selectId: sub.id,
  };
}

/**
 * «Escalation (boundary)» (Handoff 18 §5b, decisão 3): a composite born
 * lint-clean — boundary + LOCAL escalation definition + ref in ONE undo,
 * `cancelActivity:false` explicit (the declared non-interrupting personality).
 * Reforço 7: a boundary needs a host — the drop must land on an activity
 * (attaches via the N-1 side/t anchor); on empty canvas it DECLINES with a
 * declared veto (announced on the 🔒), never an orphan boundary.
 */
export function buildEscalationBoundaryInsert(ctx: PaletteBuildContext): PaletteInsertResult {
  const { diagram, registry, x, y, t } = ctx;
  const size = registry.get('boundaryEvent').defaultSize;
  const center = { x: x + size.width / 2, y: y + size.height / 2 };
  const host = findNodeAtPoint(diagram, null, center);
  if (!host || !registry.has(host.type) || registry.get(host.type).category !== 'activity') {
    return { veto: t('palette.veto.boundaryNeedsHost') };
  }
  // Derive the N-1 anchor from the drop point, then snap the boundary onto the
  // host border (side/t stored so a later export re-derives them identically).
  const { side, t: anchorT } = boundaryAnchorOf(host, {
    x,
    y,
    width: size.width,
    height: size.height,
    properties: {},
  });
  const pos = boundaryNodePosition(host, side, anchorT, size);
  const escId = nextEventDefinitionId(diagram, 'escalation');
  const boundary = createNode(
    {
      type: 'boundaryEvent',
      x: pos.x,
      y: pos.y,
      properties: {
        attachedToRef: host.id,
        cancelActivity: false,
        eventDefinition: 'escalation',
        eventDefinitionRef: escId,
        boundarySide: side,
        boundaryT: anchorT,
      },
      versionId: diagram.version.id,
    },
    registry,
  );
  return {
    command: compositeCommand(t('palette.compose.escalationBoundary'), [
      addEventDefinitionCommand('escalation', {
        id: escId,
        name: t('eventDefs.defaultName.escalation'),
      }),
      addNodeCommand(boundary),
    ]),
    selectId: boundary.id,
  };
}

/**
 * The «Compensation (pair)» palette composite (Handoff 19 §6b): ONE undoable
 * command that drops the compensation boundary (⟲) on the host plus the handler
 * activity + linking association — the pair is born complete and lint-clean (the
 * ES-2 ruler). The handler + association come from the SHARED
 * `compensationHandlerCommands` builder (Handoff 19 §6c, one form): the SAME
 * source the COMP_BOUNDARY_NO_HANDLER quick-fix uses, so palette and fix never
 * drift. Drop demands an activity host (the EC-2 veto).
 */
export function buildCompensationPairInsert(ctx: PaletteBuildContext): PaletteInsertResult {
  const { diagram, registry, x, y, t } = ctx;
  const size = registry.get('boundaryEvent').defaultSize;
  const center = { x: x + size.width / 2, y: y + size.height / 2 };
  const host = findNodeAtPoint(diagram, null, center);
  if (!host || !registry.has(host.type) || registry.get(host.type).category !== 'activity') {
    return { veto: t('palette.veto.boundaryNeedsHost') };
  }
  const { side, t: anchorT } = boundaryAnchorOf(host, {
    x,
    y,
    width: size.width,
    height: size.height,
    properties: {},
  });
  const pos = boundaryNodePosition(host, side, anchorT, size);
  const boundary = createNode(
    {
      type: 'boundaryEvent',
      x: pos.x,
      y: pos.y,
      properties: {
        attachedToRef: host.id,
        // No cancelActivity (fires post-completion), no ref (compensation has none).
        eventDefinition: 'compensate',
        boundarySide: side,
        boundaryT: anchorT,
      },
      versionId: diagram.version.id,
    },
    registry,
  );
  const { commands: handlerCommands } = compensationHandlerCommands(diagram, {
    boundary,
    host,
    handlerName: t('palette.compose.compensationHandler'),
  });
  return {
    command: compositeCommand(t('palette.compose.compensationPair'), [
      addNodeCommand(boundary),
      ...handlerCommands,
    ]),
    selectId: boundary.id,
  };
}
