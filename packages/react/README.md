# @buildtovalue/react

React layer for [bpmn-react](https://github.com/danzeroum/bpmn): a native-SVG BPMN designer with
zero runtime dependencies (React as peer).

- `<BpmnEditor>` — batteries-included editor (toolbar, palette, inspector, minimap, status badge)
- `<BpmnDesigner>` / `<BpmnViewer>` — composable canvas with edit/read-only modes
- viewBox pan/zoom (cursor-centered), pointer-capture drag with 4px threshold, port-based
  connecting with live rule feedback, lasso selection, corner resize, keyboard shortcuts
- Granular external store (`useSyncExternalStore`) — gestures never re-render the whole tree
- 12 built-in BPMN shapes, themable via `--bpmnr-*` CSS variables (light/dark)
- Declarative plugin objects: node types, shapes, palette items, validation and governance rules
- Observability without telemetry: plugins can register `onEditorEvent` and receive
  `node.created` / `edge.connected` / `promotion.completed` / `import.warning` / `render.slow`
- `DiffView`, SVG/PNG exporters

```tsx
import { BpmnEditor } from '@buildtovalue/react';
import '@buildtovalue/react/styles.css';

<BpmnEditor diagram={diagram} plugins={[myPlugin]} onChange={save} />;
```

## Theming & typography

- **Theme**: dark mode follows `prefers-color-scheme` by default. To control it explicitly, set
  `data-bpmnr-theme="dark"` (or `"light"`) on the root element (`<html>`); the attribute overrides
  the system preference.
- **Font**: the UI consumes `--bpmnr-font` (default `system-ui` stack). To opt into a brand font
  (e.g. Space Grotesk), load the webfont in your app and set
  `:root { --bpmnr-font: 'Space Grotesk', system-ui, sans-serif; }` — the library ships no font
  assets.
- **Semantic zoom**: below 60% zoom the canvas drops secondary ink (edge labels, purpose chips and
  domain type tags); below 50% it also drops activity shadows.

Docs: https://github.com/danzeroum/bpmn/tree/main/docs — License: Apache-2.0.
