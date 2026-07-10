# @buildtovalue/core

Zero-dependency BPMN domain engine (pure TypeScript, browser/Node/worker):

- Data model with O(1) `Record` storage and **temporal immutability** (`createdInVersion`,
  `removedInVersion`, `supersedesEdgeId`)
- `CommandStack` (git-like cursor undo/redo) + `CompositeCommand`
- `LifecycleEngine` — `draft → test → candidate → active → deprecated → retired` with configurable
  multi-role promotion rules
- `RuleEngine` (`*.pre` veto hooks), `ValidationEngine` (structural + pluggable rules)
- Structured diff (`add/remove/update/supersede`) and round-trip normalizer
- `AuditLedger` — append-only, SHA-256 hash-chained, verifiable
- Geometry: anchors, cubic Bézier, orthogonal routing, bounding boxes
- `BpmnXmlConverter` — BPMN 2.0 XML import/export with full DI and `extensionElements`
  (XXE-safe bundled XML parser)

```ts
import { createDiagram, CommandStack, addNodeCommand, createNode } from '@buildtovalue/core';

const stack = new CommandStack(createDiagram({ name: 'Flow' }));
stack.execute(addNodeCommand(createNode({ type: 'startEvent' })));
```

Docs: https://github.com/danzeroum/bpmn/tree/main/docs — License: Apache-2.0.
