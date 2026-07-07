import { addNodeCommand, createNode } from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';

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
    if (verdict.allowed) store.setState({ selectedIds: [node.id] });
  };

  return (
    <nav className="bpmnr-palette" aria-label="Element palette">
      {config.paletteItems.map((item) => (
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
      ))}
    </nav>
  );
}

function snap(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
}
