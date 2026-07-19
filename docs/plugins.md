# Plugins

A plugin is a **plain declarative object** — no dependency injection, no lifecycle classes:

```tsx
import type { BpmnPlugin } from '@buildtovalue/react';

export const myDomainPlugin: BpmnPlugin = {
  id: 'my-company/orders',
  nodeTypes: [
    {
      type: 'orders:approval',
      label: 'Order Approval',
      category: 'custom',
      defaultSize: { width: 100, height: 70 },
      xml: { tag: 'userTask' }, // exported as a standard BPMN tag → interoperable
    },
  ],
  shapes: {
    'orders:approval': ({ node, selected }) => (
      <rect width={node.width} height={node.height} rx={8}
            stroke={selected ? 'teal' : 'gray'} fill="white" />
    ),
  },
  paletteItems: [
    { id: 'orders-approval', label: 'Order Approval', nodeType: 'orders:approval', icon: '✔' },
  ],
  validationRules: [
    (diagram) =>
      Object.values(diagram.nodes)
        .filter((n) => n.type === 'orders:approval' && !n.properties.approver)
        .map((n) => ({
          code: 'APPROVAL_WITHOUT_APPROVER',
          severity: 'error' as const,
          message: `"${n.label}" has no approver assigned`,
          nodeId: n.id,
        })),
  ],
  registerRules: (engine) => {
    engine.register('edge.connect.pre', (payload, diagram) => {
      // veto connections based on your domain rules
      return { allowed: true };
    });
  },
  lifecycleConfig: { minApprovalRoles: 3 },
  edgeRouter: 'orthogonal', // or 'bezier' (default) or a custom function
  onBeforeSave: (diagram) => diagram,
  onAfterLoad: (diagram) => diagram,
};
```

Use it:

```tsx
<BpmnEditor diagram={diagram} plugins={[myDomainPlugin]} />
```

## What each field does

| Field | Effect |
|---|---|
| `nodeTypes` | Registered into the `NodeTypeRegistry` and added to `preferredTypes`; the `xml.tag` mapping keeps exports interoperable while `extensionElements` preserve the custom type identity on round-trip. How a custom type is resolved (or degraded with a warning) on import is the [`preferredTypes` contract matrix](format-spec.md#type-resolution--the-preferredtypes-contract). |
| `shapes` | React components keyed by node type; receive `{ node, selected }`. |
| `paletteItems` | Extra palette buttons (`defaultProperties` seed new nodes). |
| `validationRules` | Appended to the `ValidationEngine` (run by the toolbar Validate button and the CLI). |
| `registerRules` | Access to the `RuleEngine` `*.pre` hooks — veto connections, commands, promotions. |
| `lifecycleConfig` | Overrides the lifecycle state machine (transitions, approval quorum, changelog length, promotion rules). |
| `edgeRouter` | `'bezier'`, `'orthogonal'` or `(source, target) => EdgeGeometry`. |
| `onBeforeSave` / `onAfterLoad` | Transform the diagram at export/import boundaries. |

Plugins are merged in order; duplicate ids — the last one wins. A complete worked example lives in
[`@buildtovalue/domain-example`](../packages/domain-example).
