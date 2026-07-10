# Getting started

## Install

```bash
pnpm add @buildtovalue/core @buildtovalue/react
# optional: the example domain plugin, as a template for your own vocabulary
pnpm add @buildtovalue/domain-example
```

Requirements: React ≥ 18, Node ≥ 20 (for the CLI / SSR usage — the browser build has no Node dependency).

## A minimal editor

```tsx
import { useState } from 'react';
import { createDiagram } from '@buildtovalue/core';
import { BpmnEditor } from '@buildtovalue/react';
import '@buildtovalue/react/styles.css';

export function App() {
  const [diagram] = useState(() => createDiagram({ name: 'My process' }));
  return (
    <div style={{ height: '100vh' }}>
      <BpmnEditor diagram={diagram} onChange={(d) => console.log('changed', d)} />
    </div>
  );
}
```

`BpmnEditor` is the batteries-included arrangement (toolbar, palette, inspector, minimap, status
badge). For full control compose the pieces yourself:

```tsx
import { BpmnDesigner, Palette, Toolbar, PropertiesPanel, MiniMap } from '@buildtovalue/react';

<BpmnDesigner diagram={diagram}>
  <div className="my-layout-top"><Toolbar /></div>
  <div className="my-layout-left"><Palette /></div>
  <div className="my-layout-right"><PropertiesPanel /></div>
  <MiniMap />
</BpmnDesigner>;
```

Read-only rendering: `<BpmnViewer diagram={diagram} />`.

## Programmatic editing

All mutations are commands on a git-like undo stack:

```ts
import {
  CommandStack,
  addNodeCommand,
  addEdgeCommand,
  createDiagram,
  createEdge,
  createNode,
} from '@buildtovalue/core';

const diagram = createDiagram({ name: 'Headless' });
const stack = new CommandStack(diagram);

const a = createNode({ type: 'startEvent', x: 0, y: 0 });
const b = createNode({ type: 'task', x: 200, y: 0 });
stack.execute(addNodeCommand(a));
stack.execute(addNodeCommand(b));
stack.execute(addEdgeCommand(createEdge({ sourceId: a.id, targetId: b.id })));
stack.undo();
stack.redo();
console.log(stack.current); // the resulting immutable diagram
```

Inside React, the same stack is available through `useDiagram()`:

```tsx
const { diagram, execute, undo, redo, canUndo, canRedo, replaceDiagram } = useDiagram();
```

## BPMN 2.0 XML

```ts
import { BpmnXmlConverter } from '@buildtovalue/core';

const converter = new BpmnXmlConverter();
const xml = converter.toXml(diagram);            // includes BPMN DI (shapes + waypoints)
const { diagram: back, warnings } = converter.fromXml(xml);
```

See [format-spec.md](format-spec.md) for the supported element profile.

## CLI

```bash
pnpm add -g @buildtovalue/cli
bpmn-react validate flow.bpmn.xml
bpmn-react export flow.json --to xml -o flow.bpmn.xml
bpmn-react diff v1.json v2.json
```
