import {
  addNodeCommand,
  compositeCommand,
  createNode,
  type BpmnDiagram,
  type Command,
  type NodeTypeRegistry,
  type RuleVerdict,
} from '@buildtovalue/core';
import { typedMessageStartCommands } from '@buildtovalue/lint';
import { SUBPROCESS_TITLE_HEIGHT } from '../shapes/shapes.js';
import type { CanvasStore } from '../state/canvasStore.js';
import type { PaletteBuildContext, PaletteItem } from '../plugins/types.js';

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
  const { command, selectId } = paletteInsertCommand(item, {
    diagram: deps.diagram,
    registry: deps.registry,
    x,
    y,
    t: deps.t,
  });
  const verdict = deps.execute(command);
  if (verdict.allowed) {
    deps.store.setState({ selectedIds: [selectId], lastCreatedNodeId: selectId });
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
): { command: Command; selectId: string } {
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
