# @buildtovalue/domain-example

A complete worked example of a **domain plugin** for bpmn-react — use it directly or copy it as a
template for your own vocabulary.

Adds squads, personas, approval gates, prompts, connectors and deliverables:

- custom node types mapped to interoperable BPMN tags (exports open in Camunda/bpmn.io),
- custom SVG shapes and palette entries,
- domain validation (gates accept one predecessor; squads need personas; handoffs need a purpose),
- a governance rule freezing approved gates (supersede instead of editing).

```tsx
import { BpmnEditor } from '@buildtovalue/react';
import { domainExamplePlugin } from '@buildtovalue/domain-example';

<BpmnEditor diagram={diagram} plugins={[domainExamplePlugin]} />;
```

License: Apache-2.0.
