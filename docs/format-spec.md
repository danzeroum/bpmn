# BPMN 2.0 XML — supported profile

The converter implements a deliberate, documented **profile** of the OMG BPMN 2.0 specification —
the subset needed to interoperate with bpmn.io / Camunda Modeler — instead of the full ~500-page
spec. Unknown elements are ignored with warnings on import (never a hard failure). The profile is
stable under semver: documents exported by a 1.x release will always re-import in later 1.x
releases.

## Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
    xmlns:bpmnr="http://bpmn-react.io/schema/1.0"
    id="Definitions_…" targetNamespace="…" exporter="bpmn-react">
  <bpmn:process id="…" name="…" isExecutable="false">
    <bpmn:extensionElements>…diagram/version metadata…</bpmn:extensionElements>
    …flow elements…
    …sequence flows…
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="…process id…">
      <bpmndi:BPMNShape bpmnElement="…"><dc:Bounds x y width height/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge bpmnElement="…"><di:waypoint x y/>…</bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

## Supported elements

| Element | Import | Export | Notes |
|---|---|---|---|
| `definitions`, `process` | ✓ | ✓ | one process per document |
| `startEvent`, `endEvent` | ✓ | ✓ | typed via `eventDefinition` (see below) |
| `intermediateCatchEvent`, `intermediateThrowEvent` | ✓ | ✓ | typed via `eventDefinition` |
| `boundaryEvent` | ✓ | ✓ | `attachedToRef` + `cancelActivity` (see below) |
| `messageEventDefinition`, `timerEventDefinition`, … | ✓ | ✓ | event definition child (see below) |
| `task`, `userTask`, `serviceTask`, `scriptTask`, `sendTask`, `receiveTask`, `manualTask` | ✓ | ✓ | loop / multi-instance markers (see below) |
| `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`, `eventBasedGateway` | ✓ | ✓ | |
| `group` | ✓ | ✓ | non-semantic artifact (dashed frame) |
| `subProcess` | ✓ | ✓ | flat (no nested flow elements yet) |
| `dataObjectReference`, `textAnnotation` | ✓ | ✓ | |
| `sequenceFlow` | ✓ | ✓ | `sourceRef`/`targetRef`/`name` |
| `collaboration`/`participant` (pools) | ✓ | ✓ | see [Pools & lanes](#pools--lanes) |
| `laneSet`/`lane`/`flowNodeRef` | ✓ | ✓ | see [Pools & lanes](#pools--lanes) |
| `messageFlow` | ✓ | ✓ | in the collaboration; requires a pool (falls back to `sequenceFlow` + `bpmnr:meta` without one) |
| `association` | ✓ | ✓ | artifact link (e.g. task → text annotation) |
| `bpmndi:BPMNDiagram/Plane/Shape` + `dc:Bounds` | ✓ | ✓ | node coordinates (`isHorizontal` on pools/lanes) |
| `bpmndi:BPMNEdge` + `di:waypoint` | ✓ | ✓ | edge routing (computed orthogonally when absent) |
| `extensionElements` | ✓ | ✓ | see below |
| anything else (`callActivity`, nested `subProcess` flow, DMN, …) | warning, skipped | – | roadmap |

Documents without DI import with an automatic grid layout (and a warning).

## Typed events

Event nodes (`startEvent`, `endEvent`, `intermediateCatchEvent`,
`intermediateThrowEvent`) carry their kind under `properties.eventDefinition`, one of
`message`, `timer`, `error`, `signal`, `escalation`, `conditional`, `link`, `terminate`.
On export it becomes the standard child element (e.g. `<bpmn:messageEventDefinition/>`) —
**not** a `bpmnr:property` — so typed events interoperate with Camunda / bpmn.io and
round-trip losslessly. On import, a recognized `<bpmn:*EventDefinition/>` child sets
`properties.eventDefinition`; an absent one means a plain (none) event.

```xml
<bpmn:startEvent id="Start_1" name="Order received">
  <bpmn:messageEventDefinition id="Start_1_def"/>
</bpmn:startEvent>
```

### Activity markers

An activity (any `*Task` or `subProcess`) may carry a loop marker under `properties.marker`:
`loop`, `parallelMultiInstance`, or `sequentialMultiInstance`. On export it becomes the
standard `standardLoopCharacteristics` / `multiInstanceLoopCharacteristics` (`isSequential`)
child, so it interoperates and round-trips.

```xml
<bpmn:userTask id="Task_1" name="Approve">
  <bpmn:multiInstanceLoopCharacteristics isSequential="true"/>
</bpmn:userTask>
```

### Boundary events

A `boundaryEvent` attaches to a host activity via the native `attachedToRef` attribute
and stores it under `properties.attachedToRef`; `cancelActivity="false"` (stored as
`properties.cancelActivity = false`) marks a non-interrupting boundary (dashed border).
Its `eventDefinition` works exactly as for other events. In the editor a boundary event
rides along when its host is moved. Attaching by drag-and-drop onto an activity and
sliding along the host border on resize are tracked in `pendencias.md`.

```xml
<bpmn:boundaryEvent id="Boundary_1" name="Timeout" attachedToRef="Task_1" cancelActivity="false">
  <bpmn:timerEventDefinition id="Boundary_1_def"/>
</bpmn:boundaryEvent>
```

## Pools & lanes

Pools and lanes are modelled as ordinary nodes with the reserved types `pool` and `lane`
(rendered as swimlane containers *behind* the flow). They map to standard BPMN:

- **Pools** → a `<bpmn:collaboration>` holding one `<bpmn:participant>` per pool, each with
  `processRef` pointing at the single process. When any pool is present the DI plane's
  `bpmnElement` targets the collaboration.
- **Lanes** → a `<bpmn:laneSet>` inside the process; each `<bpmn:lane>` lists its members as
  `<bpmn:flowNodeRef>` children. Membership is stored on the lane node under
  `properties.flowNodeRefs` (a string array of node ids).
- Pool/lane DI shapes carry `isHorizontal="true"`.

```xml
<bpmn:collaboration id="Collaboration_1">
  <bpmn:participant id="Pool_1" name="Editorial" processRef="Process_1"/>
</bpmn:collaboration>
<bpmn:process id="Process_1">
  <bpmn:laneSet id="LaneSet_1">
    <bpmn:lane id="Lane_1" name="Authors">
      <bpmn:flowNodeRef>Task_write</bpmn:flowNodeRef>
    </bpmn:lane>
  </bpmn:laneSet>
  …flow elements…
</bpmn:process>
```

Lane membership is **interactive** in the editor: dropping a flow node inside a lane joins it
(the lane's `flowNodeRefs` is updated as part of the same undoable move command), dragging it out
leaves it. Stale refs (deleted nodes) are dropped at export and reported by the
`STALE_LANE_REF` validation rule.

**Profile boundaries** (tracked in [`pendencias.md`](../pendencias.md)): this is a
single-process profile — N pools export as N participants referencing the *same* process.
True multi-pool collaborations (one process per pool) are not modelled; `messageFlow` edges
connect nodes across pool boundaries visually but semantically stay within the one process.

## Vendor extensions (`bpmnr` namespace)

Everything bpmn-react adds travels inside standard `extensionElements`, so any spec-compliant
engine simply ignores it:

- `bpmnr:diagram originalId description` — diagram identity (process ids must be NCNames; the
  original id is preserved here when it isn't one).
- `bpmnr:version versionId semanticVersion status changeSummary createdBy createdAt snapshotHash parentVersionId`
  — the lifecycle entity.
- `bpmnr:meta type createdInVersion removedInVersion supersedesEdgeId purpose` — per-element
  temporal-immutability metadata; `type` restores custom (plugin) node/edge types on import while
  the element tag stays standard.
- `bpmnr:property name value` — free-form properties (`value` is JSON-encoded).

## Named event definitions (`bpmn:message` / `bpmn:signal` / `bpmn:error` / `bpmn:escalation`)

First-class named definitions (Handoff 16 §3a; escalation added in Handoff 18 §5a) follow the
OMG standard exactly — never a vendor namespace for what the spec already names:

- **Model.** `diagram.definitions.{messages,signals,errors,escalations}[]` — `{ id, name }`
  entries (`errors` carry the OMG `errorCode`; `escalations` carry `escalationCode`, the exact
  mould, per-type asymmetry). The whole field is optional and additive; `escalations` is itself
  additionally optional so a pre-existing `definitions` literal stays valid, and every read goes
  through `eventDefinitionsOf`, which fills the missing bucket. Absent, every pre-existing hash
  and export is byte-identical (frozen fixtures `eventDefsFrozen.json` / `escalationFrozen.json`).
- **References.** An event keeps its KIND in `properties.eventDefinition` and references a
  named definition via `properties.eventDefinitionRef` (the definition's `id`). Renaming a
  definition never touches nodes — the cascade to every referencing event is by construction.
- **Export.** Definitions emit as root elements (`<bpmn:message id name/>`,
  `<bpmn:signal/>`, `<bpmn:error errorCode/>`, `<bpmn:escalation escalationCode/>`) before
  `collaboration`/`process`, in stored array order (escalation after error in the XSD
  rootElement group); the code attribute is OMITTED when undefined (never `escalationCode=""`).
  The event's `<bpmn:{kind}EventDefinition>` child carries the standard
  `messageRef`/`signalRef`/`errorRef`/`escalationRef` attribute — for escalation across all
  four hosts: throw (intermediate/end) and catch (boundary + event-subprocess start). Round-trip
  is byte-stable between bpmn-react exports. Authority (`properties.escalationAuthority`) is NOT
  an OMG concept — it stays a common `bpmnr:property`, never a root attribute.
- **Import.** Root elements populate `diagram.definitions`; `*Ref` attributes populate the
  node property. An ORPHAN ref (no matching root) is synthesized as `{ id: ref, name: ref }`
  WITH an informative warning naming the event — never silence, never data loss.
- **Deletion.** `removeEventDefinitionCommand` is vetoed by the default rules while any
  active event references the definition; the veto reason lists every usage (label + id).

## Event subprocess (`properties.triggeredByEvent` / `properties.isInterrupting`)

An event subprocess (Handoff 17 §4a) is a COMMON `subProcess` whose
`properties.triggeredByEvent` is `true` — F7 containment (`parentId`, nesting, DI) is reused
whole, no new containment model. Its start event may carry `properties.isInterrupting: false`.

- **Serialization (DECLARED emission rule).** Both are attributes the OMG names, emitted as
  standard XML attributes on the element kinds that own them — `triggeredByEvent="true"` on
  `<bpmn:subProcess>`, `isInterrupting="false"` on `<bpmn:startEvent>` — and reserved from the
  property soup exactly when emitted (the `eventDefinitionRef` mold). The OMG default is
  OMITTED: `triggeredByEvent` is only written when `true`, `isInterrupting` only when `false`
  (`isInterrupting="true"` never appears).
- **The converter preserves, it never judges.** The attributes round-trip byte-stably WHEREVER
  they appear on their element kinds — e.g. an external file with `isInterrupting="false"` on a
  top-level start with no event subprocess in sight round-trips unchanged. Whether that model
  MAKES SENSE is the lint's job (`EVT_SUBPROC_*`, panel 4d), never the converter's.
- **Structure.** Sequence flow to or from the event-subprocess SHELL is vetoed by the default
  rules (children connect among themselves normally); the shell is exempt from
  `UNREACHABLE_NODE` — it fires by its start event, like a boundary event receives control
  from its host.
- **Predicate source.** `isEventSubprocess`/`startIsInterrupting` are THE single source of the
  classification — the execution-tab matrix and the lint rules consume these helpers, so
  editor, lint and simulator agree by construction.

## Canonical timer (`properties.timer`)

A timer event stores its expression as `properties.timer = { kind: 'date' | 'duration' |
'cycle', expression }` (Handoff 16 §3d). On TIMER events it exports as the standard OMG
child — `<bpmn:timeDate>`, `<bpmn:timeDuration>` or `<bpmn:timeCycle>` (text content) inside
the `timerEventDefinition` — and is reserved from the property soup exactly when emitted;
on any OTHER node the property stays an ordinary `bpmnr:property` and never produces an
orphan OMG child. Round-trip is byte-stable; the absent field keeps prior exports
byte-identical. Expressions are validated by the headless ISO 8601 parser
(`parseTimerExpression` — `P1M` is one MONTH, `PT1M` is one MINUTE); a present-but-invalid
expression surfaces as the `TIMER_MALFORMED` lint error, never a silent normalization.

## Governed event-definition bindings (`properties.eventDefinitionBinding`)

An event can reference a definition governed by the host's Biblioteca (Handoff 16 §3b)
instead of a purely local one:

- **Model.** The binding is a `nome@semver` string in `properties.eventDefinitionBinding`,
  which serializes like every other custom property — as a `bpmnr:property` inside the
  node's `extensionElements`, **never** a vendor attribute such as `camunda:modelRefCode`.
  Round-trip is byte-stable by construction (no converter change was needed).
- **Local mirror.** Binding upserts a local definition with the reserved id `gov-{nome}`
  carrying the resolved payload (`name`, `errorCode`). The mirror keeps the OMG export
  valid — `messageRef`/`signalRef`/`errorRef` still points at a real root element — so any
  standard engine consumes the file with zero knowledge of the binding. Mirror ids are
  reserved: `gov-*` definitions are managed by the Biblioteca and are **read-only** in the
  editor (rename/`errorCode` blocked — editing happens by promoting a new artifact version).
- **Pin semantics.** The binding points at a FIXED `nome@semver`. Promoting a NEW version
  of the artifact never moves the mirror or the binding — only an explicit change of
  reference does, and that change is an auditable act (ledger entry
  `EVENT_BINDING_CHANGED` with `from`/`to`). Resolution state is reported, not enforced:
  a binding to a non-vigente version validates as WARNING `SIG_REF_STALE`; an
  unresolvable one as ERROR `SIG_REF_MISSING`.
- **Resolution.** The editor never consults a registry: the host injects a synchronous
  `EventDefinitionResolver` via plugin. Without one, the binding degrades DECLAREDLY —
  shown as text with a "resolution not configured" notice, never silently dropped.
- **Usage counting.** The mirror is an ordinary definition: while the bound event
  references it, the deletion veto counts that usage — governança by construction, no
  special case. Unbinding garbage-collects the mirror when its last usage goes away.

## Foreign extension passthrough (`zeebe:*`, `camunda:*`, …)

Extension content from OTHER namespaces is preserved through the round-trip instead of being
dropped:

- **What is preserved.** Foreign children of `extensionElements` on flow nodes, sequence/message
  flows, data associations' host elements and the `<bpmn:process>` itself (e.g.
  `zeebe:taskDefinition`, `zeebe:ioMapping`, `zeebe:userTaskForm`,
  `camunda:executionListener`); foreign-prefixed **attributes** on those elements (e.g.
  `zeebe:modelerTemplate`, `camunda:asyncBefore`); and the root's foreign `xmlns:*` declarations,
  re-declared on export in sorted-prefix order. Model storage: `foreignExtensions` /
  `foreignAttributes` on nodes and edges, `processForeignExtensions` / `foreignNamespaces` on the
  diagram — all optional, so extension-free diagrams keep their exact pre-passthrough bytes and
  hashes.
- **The guarantee.** Semantically lossless on import and **byte-stable between bpmn-react
  exports**: export → import → export is byte-identical. Byte-identity with the ORIGINAL
  third-party file is NOT promised — formatting is normalized by our writer, exactly like other
  BPMN tools.
- **Text normalization (contract).** Element text is whitespace-**trimmed at the edges** on
  import, and `CDATA` sections are read raw but re-emitted as **escaped text** (semantically
  equal XML). Both normalizations happen once, on first import; every later pass is byte-stable.
- **Diffing.** A changed foreign extension appears in `computeDiff`/`diffDiagrams` as a NAMED
  field — the element tag (`zeebe:taskDefinition`) or `@`-prefixed attribute name
  (`@zeebe:modelerTemplate`) — never as an opaque blob, so the review ΔN popover renders it per
  field.
- **Not preserved (registered scope).** Foreign children of `definitions` outside the process
  (messages, signals, errors — part of the compensation/choreography coverage pendency) and
  unprefixed legacy `property`/`meta` children, which are still read as bpmn-react's own.

## Parser guarantees

- Structure validation only — no XSD schema validation.
- `DOCTYPE`/DTD is **rejected** (XXE-safe by construction); only the five predefined entities and
  numeric character references are decoded.
- Attribute order and element order are not significant on import.
- Coordinates are rounded to 2 decimals when diffing round-trips (`normalizeForDiff`).
