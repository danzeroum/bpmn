# BPMN 2.0 XML — supported profile

The converter implements a deliberate **MVP profile** of the OMG BPMN 2.0 specification — the
subset needed to interoperate with bpmn.io / Camunda Modeler — instead of the full ~500-page spec.
Unknown elements are ignored with warnings on import (never a hard failure).

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
| `startEvent`, `endEvent` | ✓ | ✓ | |
| `task`, `userTask`, `serviceTask`, `scriptTask` | ✓ | ✓ | |
| `exclusiveGateway`, `parallelGateway`, `inclusiveGateway` | ✓ | ✓ | |
| `subProcess` | ✓ | ✓ | flat (no nested flow elements yet) |
| `dataObjectReference`, `textAnnotation` | ✓ | ✓ | |
| `sequenceFlow` | ✓ | ✓ | `sourceRef`/`targetRef`/`name` |
| `bpmndi:BPMNDiagram/Plane/Shape` + `dc:Bounds` | ✓ | ✓ | node coordinates |
| `bpmndi:BPMNEdge` + `di:waypoint` | ✓ | ✓ | edge routing (computed orthogonally when absent) |
| `extensionElements` | ✓ | ✓ | see below |
| anything else (`laneSet`, `boundaryEvent`, `callActivity`, events with definitions, …) | warning, skipped | – | roadmap |

Documents without DI import with an automatic grid layout (and a warning).

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
