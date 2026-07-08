# @bpmn-react/library-react

React UI for the generic artifact library — the visible half of the
BuildToValue Studio Biblioteca (Handoff 6, S-3; visual spec Handoff 3 §5).

> Workspace-only until the npm-scope decision (pendencias.md §1). The final
> published name will be `<scope>/library-react`.

## What it is

`<LibraryView adapters={...} onAction={...} initialQuery? onQueryChange? />` —
a gallery driven exclusively by the `ArtifactAdapter` contract from
`@bpmn-react/library`:

- **status chips**: the fixed six-state `LifecycleStatus` vocabulary, with
  live counts;
- **type chips**: one per registered adapter (dynamic — each adapter is a
  chip with its `typeLabel` and count);
- **search + sort** (name / update / status), all computed by the headless
  catalog;
- **cards**: 108px thumb (the adapter's `ThumbnailSpec`, placed as data),
  type chip, name, seal row and free meta line;
- **drawer** (316px): kicker, name, seal, then ONLY the sections the adapter
  provided (vigência/aprovação/change summary, proveniência, version
  timeline) — optional fields → optional UI, never "N/A";
- **actions**: descriptors rendered as buttons; `onAction(ref, action)` is
  the only outbound call — the view mutates nothing.

No prop knows concrete artifact types. The same acid-test fixture from S-2
(`createRecipeAdapter`) drives the UI test suite (§10.1).

## Seals

Cards, drawer and timeline use the SAME `StatusBadge` from
`@bpmn-react/react` in its standalone mode (`seal` prop — Handoff 6 §10.6)
and the canonical `--bpmnr-status-*` tokens. Import the stylesheets in
order:

```ts
import '@bpmn-react/react/styles.css';
import '@bpmn-react/library-react/styles.css';
```

## URL state (§10.7)

The view is navigation-agnostic: pass `initialQuery` (parsed from your URL)
and `onQueryChange` (serialize back). The Studio shell (S-4) owns real
navigation; `packages/example`'s `?library=1` surface shows the pattern.
