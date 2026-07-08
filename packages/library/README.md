# @bpmn-react/library

Generic, ecosystem-independent artifact catalog — the headless half of the
BuildToValue Studio Biblioteca (Handoff 6, S-1).

> Workspace-only until the npm-scope decision (pendencias.md §1). The final
> published name will be `<scope>/library`.

## What it is

A catalog that **does not know what it catalogs**. This package defines:

- the **`ArtifactAdapter` contract** (`{ id, typeLabel, list, get, subscribe? }`)
  — anyone who knows a concrete artifact type (BPMN diagram, prompt, DMN
  decision, recipe…) implements it and plugs in;
- the shared **six-state `LifecycleStatus`** vocabulary
  (`draft | test | candidate | active | deprecated | retired`) — structurally
  compatible with `@bpmn-react/core`'s `VersionStatus`, with no import;
- the **headless catalog logic**: `createLibraryCatalog(adapters)` aggregates
  registered adapters and implements text search, status/type filtering,
  sorting (`name | updated | status`) and chip counts — 100% testable without
  a DOM.

Everything an adapter provides is **data**: thumbnails as `ThumbnailSpec`
(SVG string / icon name), actions as `ArtifactAction` descriptors the host
resolves. The catalog is read-only by construction — there is no mutation path.

## Independence guarantee

This package imports **nothing** from the monorepo (not `core`, not
`registry`, not `react`) and declares **zero dependencies of any kind**.
This is Handoff 6 acceptance criterion §10.2 and it is enforced by
`tests/independence.test.ts` (same spirit as `scripts/check-no-runtime-deps.mjs`,
applied to this package's import graph). A violation is an architecture bug,
never an acceptable exception.

## Usage

```ts
import { createLibraryCatalog, type ArtifactAdapter } from '@bpmn-react/library';

const catalog = createLibraryCatalog([bpmnDiagramAdapter, promptAdapter], {
  onWarning: (w) => console.warn(`[library] ${w.adapterId}: ${w.message}`),
});

const { items, counts } = await catalog.list({
  text: 'onboarding',
  statuses: ['active', 'candidate'],
  sort: 'updated',
});

const detail = await catalog.get(items[0].ref); // routed to the owning adapter
```

Registration validates adapters (unique `id`, non-empty `typeLabel`) with
**warnings, never crashes** — invalid adapters are dropped, the catalog keeps
working. A failing `list()` from one adapter likewise warns and leaves the
others intact.

## Notes on the contract (deviations documented)

- `ArtifactSummary.updatedAt?: string` (ISO) is an extension over the Handoff 6
  §3 contract: the §4 requirement of sorting by "atualização" needs a date.
  Optional — items without it sort after dated ones, tie-breaking by name.
- Chip `counts` are computed over the text-filtered set **before** status and
  adapter narrowing, so each chip shows what selecting it would yield.
