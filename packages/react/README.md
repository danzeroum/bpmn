# @bpmn-react/react

React layer for [bpmn-react](https://github.com/danzeroum/bpmn): a native-SVG BPMN designer with
zero runtime dependencies (React as peer).

- `<BpmnEditor>` — batteries-included editor (toolbar, palette, inspector, minimap, status badge)
- `<BpmnDesigner>` / `<BpmnViewer>` — composable canvas with edit/read-only modes
- viewBox pan/zoom (cursor-centered), pointer-capture drag with 4px threshold, port-based
  connecting with live rule feedback, lasso selection, corner resize, keyboard shortcuts
- Granular external store (`useSyncExternalStore`) — gestures never re-render the whole tree
- 12 built-in BPMN shapes, themable via `--bpmnr-*` CSS variables (light/dark)
- Declarative plugin objects: node types, shapes, palette items, validation and governance rules
- `DiffView`, SVG/PNG exporters

```tsx
import { BpmnEditor } from '@bpmn-react/react';
import '@bpmn-react/react/styles.css';

<BpmnEditor diagram={diagram} plugins={[myPlugin]} onChange={save} />;
```

Docs: https://github.com/danzeroum/bpmn/tree/main/docs — License: Apache-2.0.
