# bpmn-react

**A zero-dependency BPMN 2.0 diagramming library for React — with native versioning, governance and cryptographic audit.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

`bpmn-react` is a from-scratch implementation of a BPMN process designer. It does **not** depend on
`bpmn-js`, `diagram-js`, React Flow or any other diagramming library — the rendering engine is native
SVG driven by React, and the domain engine is pure TypeScript with **zero runtime dependencies**.

What makes it different from generic BPMN editors:

- **Versioning as a first-class entity** — every diagram carries a semantic version with a governed
  lifecycle: `draft → test → candidate → active → deprecated → retired`, enforced by a configurable
  state machine with multi-role promotion rules.
- **Temporal immutability** — versioned edges are never deleted or edited. They are *closed*
  (`removedInVersion`) and *superseded* (`supersedesEdgeId`), preserving a complete lineage for audit.
- **Cryptographic audit ledger** — an append-only, SHA-256 hash-chained ledger records every change;
  any retroactive tampering breaks the chain and is detected by `verify()`.
- **BPMN 2.0 XML interoperability** — import/export with full BPMN DI (shapes, bounds, waypoints)
  so diagrams round-trip with Camunda Modeler and bpmn.io tools. Custom properties travel inside
  standard `extensionElements`.
- **Extensible by design** — custom node types, shapes, palette items, validation rules and XML
  mappings are registered through a declarative plugin object. Your domain vocabulary lives in a
  plugin, not in a fork.

## Packages

| Package | Description |
|---|---|
| [`@bpmn-react/core`](packages/core) | Domain engine: model, events, commands, lifecycle, rules, validation, diff, audit, geometry, XML. Pure TypeScript, runs headless (browser, Node, workers). |
| [`@bpmn-react/react`](packages/react) | React layer: SVG canvas, shapes, gestures (drag/connect/zoom/pan), palette, inspector, minimap, diff view. Peer deps: `react`, `react-dom`. |
| [`@bpmn-react/domain-example`](packages/domain-example) | Example domain plugin (squads, personas, gates, prompts, connectors, deliverables) showing how to extend the core. |
| [`@bpmn-react/cli`](packages/cli) | Headless CLI: `validate`, `export`, `diff`. |
| [`@bpmn-react/example`](packages/example) | Demo app (Vite) with the full designer. |

## Quick start

```bash
pnpm add @bpmn-react/core @bpmn-react/react
```

```tsx
import { createDiagram } from '@bpmn-react/core';
import { BpmnDesigner } from '@bpmn-react/react';

const diagram = createDiagram({ name: 'Order fulfilment' });

export function App() {
  return <BpmnDesigner diagram={diagram} onChange={(d) => console.log(d)} />;
}
```

Read-only rendering:

```tsx
import { BpmnViewer } from '@bpmn-react/react';

<BpmnViewer diagram={diagram} />;
```

## Development

```bash
pnpm install
pnpm build          # build all packages
pnpm test           # unit tests (Vitest)
pnpm typecheck
pnpm lint
pnpm --filter @bpmn-react/example dev   # run the demo app
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Plugins](docs/plugins.md)
- [Versioning & governance](docs/versioning.md)
- [BPMN 2.0 XML format profile](docs/format-spec.md)
- [Known limitations](docs/limitations.md)

## Known limitations (summary)

- The BPMN 2.0 XML converter supports a documented **MVP profile** (see
  [docs/format-spec.md](docs/format-spec.md)), not the full ~500-page OMG spec. Unknown elements are
  ignored with warnings on import.
- SVG rendering is optimized for diagrams up to **~300–400 elements**. Virtualization and a canvas
  fallback for larger graphs are on the roadmap (post-1.0).
- No built-in multi-user collaboration (CRDT) — planned as a future layer.
- PNG export requires all fonts/styles to be inlined in the SVG (browser canvas security); external
  assets would taint the canvas.
- The XML parser validates structure, not the official XSD schema. It rejects `DOCTYPE`/DTD by
  design (XXE-safe).

## License

[Apache 2.0](LICENSE) — see also [NOTICE](NOTICE). All code in this repository is original work;
architectural inspiration from publicly documented design patterns is credited in NOTICE.
