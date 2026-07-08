import type { CSSProperties } from 'react';
import { addNodeCommand, createNode } from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import type { PaletteGroup, PaletteItem } from '../plugins/types.js';

/**
 * Element palette. Clicking an item creates a node of that type near the
 * center of the current viewport (snapped to the grid) and selects it.
 */
export function Palette() {
  const { execute } = useDiagram();
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const readOnly = store.getState().readOnly;
  if (readOnly) return null;

  const createAt = (nodeType: string, defaultProperties?: Record<string, unknown>) => {
    const { viewport, gridSize, snapEnabled } = store.getState();
    const cx = viewport.x + viewport.width / 2;
    const cy = viewport.y + viewport.height / 2;
    const def = config.registry.get(nodeType);
    // Offset repeated inserts so nodes don't stack exactly.
    const jitter = (Object.keys(diagram.nodes).length % 5) * (gridSize || 20);
    const x = snap(cx - def.defaultSize.width / 2 + jitter, snapEnabled ? gridSize : 0);
    const y = snap(cy - def.defaultSize.height / 2 + jitter, snapEnabled ? gridSize : 0);
    const node = createNode(
      {
        type: nodeType,
        x,
        y,
        properties: defaultProperties ? { ...defaultProperties } : {},
        versionId: diagram.version.id,
      },
      config.registry,
    );
    const verdict = execute(addNodeCommand(node));
    if (verdict.allowed) {
      store.setState({ selectedIds: [node.id], lastCreatedNodeId: node.id });
      config.emitEditorEvent('node.created', { nodeType });
    }
  };

  // Items render under their group (groups keep registration order); items
  // without a known group keep the old flat behavior, appended at the end.
  const byGroup = new Map<string, PaletteItem[]>();
  const ungrouped: PaletteItem[] = [];
  for (const item of config.paletteItems) {
    const group = item.group !== undefined && config.paletteGroups.some((g) => g.id === item.group)
      ? item.group
      : undefined;
    if (group === undefined) ungrouped.push(item);
    else byGroup.set(group, [...(byGroup.get(group) ?? []), item]);
  }

  const renderItem = (item: PaletteItem) => (
    <button
      key={item.id}
      type="button"
      className="bpmnr-palette-item"
      title={item.label}
      aria-label={`Add ${item.label}`}
      data-palette-item={item.id}
      onClick={() => createAt(item.nodeType, item.defaultProperties)}
    >
      <span className="bpmnr-palette-icon" aria-hidden>
        {item.icon ?? '▢'}
      </span>
      <span className="bpmnr-palette-label">{item.label}</span>
    </button>
  );

  return (
    <nav className="bpmnr-palette" aria-label="Element palette">
      {config.paletteGroups.map((group) => {
        const items = byGroup.get(group.id);
        if (!items?.length) return null;
        return (
          <section
            key={group.id}
            className="bpmnr-palette-group"
            data-palette-group={group.id}
            aria-label={group.label}
            style={groupStyle(group)}
          >
            <h3 className="bpmnr-palette-group-header">
              {group.label}
              {group.badge && <span className="bpmnr-palette-group-badge">{group.badge}</span>}
            </h3>
            {items.map(renderItem)}
          </section>
        );
      })}
      {ungrouped.map(renderItem)}
    </nav>
  );
}

/** Group color hooks become CSS custom properties consumed by styles.css. */
function groupStyle(group: PaletteGroup): CSSProperties | undefined {
  if (!group.headerColor && !group.itemBackground && !group.itemHoverBackground) return undefined;
  return {
    ...(group.headerColor && { '--bpmnr-palette-header-color': group.headerColor }),
    ...(group.itemBackground && { '--bpmnr-palette-item-bg': group.itemBackground }),
    ...(group.itemHoverBackground && { '--bpmnr-palette-item-hover-bg': group.itemHoverBackground }),
  } as CSSProperties;
}

function snap(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
}
