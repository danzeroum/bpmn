# @bpmn-react/adapters-bpmn

The concrete `ArtifactAdapter` implementations that connect the BPMN
ecosystem to the generic library (Handoff 6, S-2). This package is the side
of the boundary that KNOWS BPMN — `@bpmn-react/library` never does.

> Workspace-only until the npm-scope decision (pendencias.md §1). The final
> published name will be `<scope>/adapters-bpmn`.

## Adapters

All registry-backed adapters are thin configurations of one factory,
`createRegistryAdapter({ id, typeLabel, registry, match, target?, boundRuns? })`:

| Factory | id | typeLabel | Claims |
|---|---|---|---|
| `bpmnDiagramAdapter` | `bpmn-diagram` | FLUXO | diagrams not claimed by a specific kind |
| `personaAdapter` | `btv-persona` | PERSONA | persona-definition diagrams |
| `promptAdapter` | `btv-prompt` | PROMPT | prompt-definition diagrams |
| `connectorAdapter` | `btv-connector` | CONNECTOR | connector-definition diagrams |
| `policyAdapter` | `btv-policy` | POLÍTICA | approval-gate diagrams (see note) |
| `dmnDecisionAdapter` | `dmn-decision` | DECISÃO | `dmn:decision` nodes inside registered diagrams |

Classification (`classifyDiagram`): an explicit `diagram.metadata.artifactType`
(pt/en aliases) wins; otherwise a diagram whose active nodes are all one
mapped `btv:` type IS that artifact; everything else is a flow.

**Nota — "política":** there is no dedicated policy node type in the domain
today; the policy adapter maps to the BuildToValue Approval Gate
(`btv:gate`). Open product decision in pendencias.md (Handoff 6).

**DMN:** decisions enter as "mais um adapter, nunca caso especial". The
adapter is duck-typed on the DMN vocabulary (`dmn:decision` +
`properties.decisionTable`) so this package stays headless (the dmn package
bundles React components); once the npm scope lands it can move into the dmn
package — the end state the handoff describes — with zero changes to
library/library-react.

## What the adapters translate

- `ArtifactRef.artifactId` = the logical `diagram.id` (shared across
  versions); the registry stores one entry per version and the adapter
  groups them (`logicalArtifacts`).
- The observer's channel (`target`) picks the relevant version via the open
  publication window; without a target the newest version wins.
- `approvers` ← `version.approvedBy`; `provenance.ledgerHash` ← snapshot
  hash; `versions` timeline newest-first; `boundRuns` comes from the host
  (the registry stores no runs).
- Thumbnails are **headless SVG strings** (`diagramThumbnail`,
  `decisionThumbnail`) drawn from the diagram geometry with `--btv-*` token
  colors — the library only places them (§3.1).
- Actions are descriptors ("Abrir no Designer", "Diff vs versão ativa") the
  Studio resolves (§3.2) — nothing here mutates anything.
- `subscribe` + `notifyChanged()`: the registry has no observer, so the host
  calls `adapter.notifyChanged()` after register/publish.

## The acid-test fixture

`createRecipeAdapter()` — a fake adapter for cooking recipes, with no
relation to BPMN, importing only `@bpmn-react/library`. It exists to prove
the architecture (Handoff 6 §10.1): the whole Biblioteca must work with it
alone, without touching library/library-react. `tests/acidez.test.ts` runs
the catalog only with this adapter; S-3 extends the same fixture to the UI.
