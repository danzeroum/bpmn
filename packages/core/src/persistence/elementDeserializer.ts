import type {
  BpmnDiagram,
  BpmnEdge,
  BpmnNode,
  EventDefinitionKind,
  VersionStatus,
} from '../model/types.js';
import { DATA_ASSOCIATION_EDGE_TYPE, EVENT_DEFINITION_KINDS } from '../model/types.js';
import type { NodeTypeRegistry } from '../model/registry.js';
import { createVersion, generateId } from '../model/factory.js';
import {
  childrenByLocalName,
  firstChildByLocalName,
  localName,
  type XmlElement,
} from '../xml/MiniXmlParser.js';
import type { ExtensionHandler } from './extensionHandler.js';

const VERSION_STATUSES: VersionStatus[] = [
  'draft',
  'test',
  'candidate',
  'active',
  'deprecated',
  'retired',
];

/**
 * Deserializes BPMN 2.0 XML flow elements into the semantic model (nodes,
 * edges, data associations, containers, version lineage). Extracted from
 * `BpmnXmlConverter`; the converter frames the document (root/collaboration/
 * process discovery, DI) and delegates the element reading here. Extension
 * decoding is delegated to `ExtensionHandler`.
 */
export class ElementDeserializer {
  constructor(
    private readonly registry: NodeTypeRegistry,
    private readonly preferredTypes: string[],
    private readonly ext: ExtensionHandler,
  ) {}

  /** Non-node children of a flow container, consumed elsewhere or ignorable. */
  private static readonly STRUCTURAL_CHILD_TAGS = new Set([
    'standardLoopCharacteristics',
    'multiInstanceLoopCharacteristics',
    'incoming',
    'outgoing',
    'documentation',
    // Consumed by readDataAssociations on the owning activity; ioSpecification
    // and its synthesized property targets are bpmn.io plumbing we don't model.
    'dataInputAssociation',
    'dataOutputAssociation',
    'ioSpecification',
    'property',
    // Declaration behind a dataObjectReference — the reference carries the
    // name/DI; the id round-trips via the reference's dataObjectRef attribute.
    'dataObject',
  ]);

  /**
   * Reads the flow elements of a container (`<process>` or, recursively, a
   * `<subProcess>`), stamping children with their container id
   * (`properties.parentId`). Before F7 sub-process children were silently
   * dropped; now they round-trip as first-class nodes.
   */
  readFlowElements(
    containerEl: XmlElement,
    parentId: string | undefined,
    diagram: BpmnDiagram,
    warnings: string[],
  ): void {
    for (const child of containerEl.children) {
      const tag = localName(child.tag);
      if (tag === 'extensionElements') continue;
      if (
        ElementDeserializer.STRUCTURAL_CHILD_TAGS.has(tag) ||
        tag.endsWith('EventDefinition')
      ) {
        continue; // read via readActivityMarker/readEventDefinition on the container
      }
      if (tag === 'laneSet') {
        if (parentId !== undefined) {
          warnings.push(`Ignored <laneSet> inside sub-process ${parentId} (not supported)`);
          continue;
        }
        for (const laneEl of childrenByLocalName(child, 'lane')) {
          const lane = this.readContainer(laneEl, 'lane');
          if (lane) diagram.nodes[lane.id] = lane;
        }
        continue;
      }
      if (tag === 'sequenceFlow' || tag === 'association') {
        const edge = this.readEdge(child, warnings, tag);
        if (edge) diagram.edges[edge.id] = edge;
        continue;
      }
      const node = this.readNode(child, warnings);
      if (!node) continue;
      if (parentId !== undefined) node.properties.parentId = parentId;
      diagram.nodes[node.id] = node;
      this.readDataAssociations(child, node.id, diagram, warnings);
      if (node.type === 'subProcess') {
        this.readFlowElements(child, node.id, diagram, warnings);
      }
    }
  }

  /**
   * Reads the standard dataInputAssociation/dataOutputAssociation children of
   * an activity into `dataAssociation` edges. The activity side is implied by
   * nesting; the data side comes from the sourceRef (input) / targetRef
   * (output) child. bpmn.io-style targetRefs pointing at a synthesized
   * `<bpmn:property>` are ignored — the edge targets the activity itself.
   */
  readDataAssociations(
    activityEl: XmlElement,
    activityId: string,
    diagram: BpmnDiagram,
    warnings: string[],
  ): void {
    const read = (el: XmlElement, kind: 'input' | 'output') => {
      const refTag = kind === 'input' ? 'sourceRef' : 'targetRef';
      const ref = firstChildByLocalName(el, refTag)?.text.trim();
      if (!ref) {
        warnings.push(
          `Ignored data ${kind} association ${el.attributes.id ?? '?'} on ${activityId} without a <${refTag}>`,
        );
        return;
      }
      const { properties, meta } = this.ext.readExtensionElements(el);
      const edge: BpmnEdge = {
        id: el.attributes.id ?? generateId(),
        type: DATA_ASSOCIATION_EDGE_TYPE,
        sourceId: kind === 'input' ? ref : activityId,
        targetId: kind === 'input' ? activityId : ref,
        ...(meta.label ? { label: meta.label } : {}),
        ...(meta.purpose ? { purpose: meta.purpose } : {}),
        properties,
        createdInVersion: meta.createdInVersion ?? '0',
        ...(meta.removedInVersion ? { removedInVersion: meta.removedInVersion } : {}),
        ...(meta.supersedesEdgeId ? { supersedesEdgeId: meta.supersedesEdgeId } : {}),
        audit: { createdAt: new Date().toISOString(), createdBy: 'import', history: [] },
      };
      diagram.edges[edge.id] = edge;
    };
    for (const el of childrenByLocalName(activityEl, 'dataInputAssociation')) read(el, 'input');
    for (const el of childrenByLocalName(activityEl, 'dataOutputAssociation')) read(el, 'output');
  }

  readVersion(versionMeta: XmlElement | undefined): BpmnDiagram['version'] {
    if (!versionMeta) {
      return createVersion({ changeSummary: 'Imported from BPMN XML', createdBy: 'import' });
    }
    const a = versionMeta.attributes;
    const status = VERSION_STATUSES.includes(a.status as VersionStatus)
      ? (a.status as VersionStatus)
      : 'draft';
    return {
      id: a.versionId ?? generateId(),
      semanticVersion: a.semanticVersion ?? '0.1.0',
      status,
      approvedBy: [],
      changeSummary: a.changeSummary ?? '',
      createdBy: a.createdBy ?? 'import',
      createdAt: a.createdAt ?? new Date().toISOString(),
      snapshotHash: a.snapshotHash ?? '',
      ...(a.parentVersionId ? { parentVersionId: a.parentVersionId } : {}),
    };
  }

  readNode(el: XmlElement, warnings: string[]): BpmnNode | undefined {
    const tag = localName(el.tag);
    const { properties, meta, elements } = this.ext.readExtensionElements(el);
    // Agent Lane (Handoff 12 §5): a dedicated bpmnr:agentWorkflowSnapshot child
    // round-trips the read-degraded sub-workflow snapshot. It lives outside the
    // property soup, so read it back symmetrically (byte-stable both ways).
    const snapshotEl = elements.find((c) => localName(c.tag) === 'agentWorkflowSnapshot');
    if (typeof snapshotEl?.attributes.snapshot === 'string') {
      properties.agentWorkflowSnapshot = snapshotEl.attributes.snapshot;
    }

    let type: string | undefined;
    if (meta.type && this.registry.has(meta.type)) {
      type = meta.type;
    } else {
      type = this.registry.typeForXmlTag(tag, this.preferredTypes)?.type;
    }
    if (!type) {
      // complexGateway carries an unmodellable merge/branch expression, so it
      // is dropped rather than silently downgraded. Surface an explicit,
      // actionable warning instead of the generic "unsupported" line so the
      // author knows what was lost and the usual remedy (an inclusive gateway
      // with conditional flows covers most complex-gateway intents).
      if (tag === 'complexGateway') {
        const idAttr = el.attributes.id ? ` id="${el.attributes.id}"` : '';
        warnings.push(
          `Dropped <bpmn:complexGateway${idAttr}>: complex gateways are not supported. ` +
            `Remodel it as an inclusive gateway with conditional sequence flows.`,
        );
        return undefined;
      }
      warnings.push(`Ignored unsupported element <${el.tag}>`);
      return undefined;
    }
    // Standard <bpmn:{kind}EventDefinition/> child → properties.eventDefinition.
    const eventDef = readEventDefinition(el);
    if (eventDef) properties.eventDefinition = eventDef;
    // Boundary event host + interrupting flag from native attributes.
    if (type === 'boundaryEvent') {
      if (el.attributes.attachedToRef) properties.attachedToRef = el.attributes.attachedToRef;
      if (el.attributes.cancelActivity === 'false') properties.cancelActivity = false;
    }
    // Call activity target process / data element backing ids — all native
    // BPMN attributes, round-tripped without bpmnr:property double-encoding.
    if (type === 'callActivity' && el.attributes.calledElement) {
      properties.calledElement = el.attributes.calledElement;
    }
    if (type === 'dataStore' && el.attributes.dataStoreRef) {
      properties.dataStoreRef = el.attributes.dataStoreRef;
    }
    if (type === 'dataObject' && el.attributes.dataObjectRef) {
      properties.dataObjectRef = el.attributes.dataObjectRef;
    }
    // Standard loopCharacteristics child → properties.marker.
    const marker = readActivityMarker(el);
    if (marker) properties.marker = marker;
    const def = this.registry.get(type);
    return {
      id: el.attributes.id ?? generateId(),
      type,
      label: el.attributes.name ?? def.label,
      x: 0,
      y: 0,
      width: def.defaultSize.width,
      height: def.defaultSize.height,
      properties,
      createdInVersion: meta.createdInVersion ?? '0',
      ...(meta.removedInVersion ? { removedInVersion: meta.removedInVersion } : {}),
      audit: { createdAt: new Date().toISOString(), createdBy: 'import', history: [] },
    };
  }

  /** Reads a pool (participant) or lane element into a container node. */
  readContainer(el: XmlElement, type: 'pool' | 'lane'): BpmnNode | undefined {
    const def = this.registry.has(type) ? this.registry.get(type) : undefined;
    if (!def) return undefined;
    const properties: Record<string, unknown> = {};
    if (type === 'lane') {
      const refs = childrenByLocalName(el, 'flowNodeRef')
        .map((c) => c.text.trim())
        .filter(Boolean);
      if (refs.length > 0) properties.flowNodeRefs = refs;
    }
    return {
      id: el.attributes.id ?? generateId(),
      type,
      label: el.attributes.name ?? def.label,
      x: 0,
      y: 0,
      width: def.defaultSize.width,
      height: def.defaultSize.height,
      properties,
      createdInVersion: '0',
      audit: { createdAt: new Date().toISOString(), createdBy: 'import', history: [] },
    };
  }

  readEdge(
    el: XmlElement,
    warnings: string[],
    defaultType: 'sequenceFlow' | 'messageFlow' | 'association' = 'sequenceFlow',
  ): BpmnEdge | undefined {
    const sourceId = el.attributes.sourceRef;
    const targetId = el.attributes.targetRef;
    if (!sourceId || !targetId) {
      warnings.push(
        `Ignored ${localName(el.tag)} ${el.attributes.id ?? '?'} without source/target refs`,
      );
      return undefined;
    }
    const { properties, meta } = this.ext.readExtensionElements(el);
    return {
      id: el.attributes.id ?? generateId(),
      type: meta.type ?? defaultType,
      sourceId,
      targetId,
      ...(el.attributes.name ? { label: el.attributes.name } : {}),
      ...(meta.purpose ? { purpose: meta.purpose } : {}),
      properties,
      createdInVersion: meta.createdInVersion ?? '0',
      ...(meta.removedInVersion ? { removedInVersion: meta.removedInVersion } : {}),
      ...(meta.supersedesEdgeId ? { supersedesEdgeId: meta.supersedesEdgeId } : {}),
      audit: { createdAt: new Date().toISOString(), createdBy: 'import', history: [] },
    };
  }
}

/**
 * Reads a standard `<bpmn:{kind}EventDefinition/>` child (e.g.
 * `messageEventDefinition`, `timerEventDefinition`) and returns the kind, or
 * `undefined` when the element has no (recognized) event definition.
 */
function readEventDefinition(el: XmlElement): EventDefinitionKind | undefined {
  for (const child of el.children) {
    const match = /^(.+)EventDefinition$/.exec(localName(child.tag));
    const kind = match?.[1];
    if (kind && (EVENT_DEFINITION_KINDS as readonly string[]).includes(kind)) {
      return kind as EventDefinitionKind;
    }
  }
  return undefined;
}

/** Reads a standard loopCharacteristics child into an activity marker. */
function readActivityMarker(el: XmlElement): string | undefined {
  for (const child of el.children) {
    const tag = localName(child.tag);
    if (tag === 'standardLoopCharacteristics') return 'loop';
    if (tag === 'multiInstanceLoopCharacteristics') {
      return child.attributes.isSequential === 'true'
        ? 'sequentialMultiInstance'
        : 'parallelMultiInstance';
    }
  }
  return undefined;
}
