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
| `task`, `userTask`, `serviceTask`, `scriptTask` | ✓ | ✓ | |
| `exclusiveGateway`, `parallelGateway`, `inclusiveGateway` | ✓ | ✓ | |
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
| anything else (`callActivity`, `eventBasedGateway`, `group`, …) | warning, skipped | – | roadmap |

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

## Parser guarantees

- Structure validation only — no XSD schema validation.
- `DOCTYPE`/DTD is **rejected** (XXE-safe by construction); only the five predefined entities and
  numeric character references are decoded.
- Attribute order and element order are not significant on import.
- Coordinates are rounded to 2 decimals when diffing round-trips (`normalizeForDiff`).
