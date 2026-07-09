import type { BpmnDiagram, BpmnEdge, BpmnNode } from '../model/types.js';
import {
  activityMarkerOf,
  boundaryAttachedTo,
  calledElementOf,
  childrenOf,
  DATA_ASSOCIATION_EDGE_TYPE,
  eventDefinitionOf,
  nodeParentId,
} from '../model/types.js';
import type { NodeTypeRegistry } from '../model/registry.js';
import type { XmlBuilder } from '../xml/XmlBuilder.js';
import type { ExtensionHandler } from './extensionHandler.js';

/**
 * Serializes the semantic model (nodes, edges, data associations, the diagram
 * extension) to BPMN 2.0 XML. Extracted from `BpmnXmlConverter`; the top-level
 * document orchestration (definitions/collaboration/process/DI framing) stays
 * in the converter, which drives these element writers. All `<extensionElements>`
 * emission is delegated to `ExtensionHandler` so the encoding lives in one place.
 */
export class ElementSerializer {
  constructor(
    private readonly registry: NodeTypeRegistry,
    private readonly ext: ExtensionHandler,
  ) {}

  writeDiagramExtension(xml: XmlBuilder, diagram: BpmnDiagram): void {
    const p = this.ext.prefix;
    this.ext.writeExtensionElements(xml, () => {
      xml.element(`${p}:diagram`, {
        originalId: diagram.id,
        description: diagram.description || undefined,
      });
      xml.element(`${p}:version`, {
        versionId: diagram.version.id,
        semanticVersion: diagram.version.semanticVersion,
        status: diagram.version.status,
        changeSummary: diagram.version.changeSummary || undefined,
        createdBy: diagram.version.createdBy,
        createdAt: diagram.version.createdAt,
        snapshotHash: diagram.version.snapshotHash || undefined,
        parentVersionId: diagram.version.parentVersionId,
      });
      this.ext.writeProperties(xml, Object.entries(diagram.metadata));
    });
  }

  /** Scope of a sequence flow: the sub-process both endpoints live in, or
   * `undefined` for the top process level. A boundary event sits on its
   * host's border, so its flows run in the host's container. */
  edgeScopeOf(diagram: BpmnDiagram, edge: BpmnEdge): string | undefined {
    const source = diagram.nodes[edge.sourceId];
    if (!source) return undefined;
    const host = boundaryAttachedTo(source);
    const anchor = host ? (diagram.nodes[host] ?? source) : source;
    return nodeParentId(anchor);
  }

  writeNode(
    xml: XmlBuilder,
    node: BpmnNode,
    diagram: BpmnDiagram,
    edgesByScope: Map<string | undefined, BpmnEdge[]>,
    dataAssocsByActivity: Map<string, BpmnEdge[]>,
  ): void {
    const def = this.registry.has(node.type) ? this.registry.get(node.type) : undefined;
    const tag = def?.xml.tag ?? 'task';
    // Event kind travels as the standard <bpmn:{kind}EventDefinition/> child, not
    // as a bpmnr:property, so it interoperates and is not double-encoded.
    const eventDef = eventDefinitionOf(node);
    const marker = activityMarkerOf(node);
    // Boundary events carry their host + interrupting flag as native BPMN
    // attributes (attachedToRef / cancelActivity), not as bpmnr:property.
    const isBoundary = node.type === 'boundaryEvent';
    const attachedToRef =
      isBoundary && typeof node.properties.attachedToRef === 'string'
        ? node.properties.attachedToRef
        : undefined;
    const nonInterrupting = isBoundary && node.properties.cancelActivity === false;
    // A call activity's target process is the standard calledElement attribute.
    const calledElement = calledElementOf(node);
    // Data references carry their backing declaration id natively too.
    const dataStoreRef =
      node.type === 'dataStore' && typeof node.properties.dataStoreRef === 'string'
        ? node.properties.dataStoreRef
        : undefined;
    const dataObjectRef =
      node.type === 'dataObject' && typeof node.properties.dataObjectRef === 'string'
        ? node.properties.dataObjectRef
        : undefined;
    // Containment and expansion are encoded structurally (nesting below and
    // the DI isExpanded attribute), never as bpmnr:property.
    const isSubProcess = node.type === 'subProcess';
    const nestedNodes = isSubProcess ? childrenOf(diagram, node.id) : [];
    const nestedEdges = isSubProcess ? (edgesByScope.get(node.id) ?? []) : [];
    const dataAssocs = dataAssocsByActivity.get(node.id) ?? [];
    const reserved = new Set<string>(['parentId']);
    if (eventDef) reserved.add('eventDefinition');
    if (marker) reserved.add('marker');
    if (attachedToRef !== undefined) reserved.add('attachedToRef');
    if (nonInterrupting) reserved.add('cancelActivity');
    if (calledElement !== undefined) reserved.add('calledElement');
    if (dataStoreRef !== undefined) reserved.add('dataStoreRef');
    if (dataObjectRef !== undefined) reserved.add('dataObjectRef');
    if (isSubProcess) reserved.add('isExpanded');
    const propEntries = Object.entries(node.properties).filter(([key]) => !reserved.has(key));
    const attrs = {
      id: node.id,
      name: node.label,
      attachedToRef,
      cancelActivity: nonInterrupting ? 'false' : undefined,
      calledElement,
      dataStoreRef,
      dataObjectRef,
    };
    const hasChildren =
      eventDef !== undefined ||
      marker !== undefined ||
      nestedNodes.length > 0 ||
      nestedEdges.length > 0 ||
      dataAssocs.length > 0;
    const needsMeta =
      node.type !== tag ||
      node.removedInVersion !== undefined ||
      propEntries.length > 0 ||
      node.createdInVersion !== '0';

    if (!needsMeta && !hasChildren) {
      xml.element(`bpmn:${tag}`, attrs);
      return;
    }
    xml.open(`bpmn:${tag}`, attrs);
    if (needsMeta) {
      this.ext.writeMetaBlock(
        xml,
        {
          type: node.type !== tag ? node.type : undefined,
          createdInVersion: node.createdInVersion !== '0' ? node.createdInVersion : undefined,
          removedInVersion: node.removedInVersion,
        },
        propEntries,
      );
    }
    if (eventDef !== undefined) {
      xml.element(`bpmn:${eventDef}EventDefinition`, { id: `${node.id}_def` });
    }
    if (marker === 'loop') {
      xml.element('bpmn:standardLoopCharacteristics', {});
    } else if (marker !== undefined) {
      xml.element('bpmn:multiInstanceLoopCharacteristics', {
        isSequential: marker === 'sequentialMultiInstance' ? 'true' : 'false',
      });
    }
    // Data associations of THIS activity (standard nested elements).
    for (const assoc of dataAssocs) {
      this.writeDataAssociation(xml, assoc, node.id);
    }
    // Nested flow elements (F7): children first, then the flows between them.
    for (const child of nestedNodes) {
      this.writeNode(xml, child, diagram, edgesByScope, dataAssocsByActivity);
    }
    for (const edge of nestedEdges) {
      this.writeEdge(xml, edge, edge.type === 'association' ? 'association' : 'sequenceFlow');
    }
    xml.close();
  }

  /** True when the node's registered category is `data` (dataObject/dataStore
   * built-ins or plugin data types). */
  private isDataNode(node: BpmnNode | undefined): boolean {
    if (!node) return false;
    return this.registry.has(node.type) && this.registry.get(node.type).category === 'data';
  }

  /**
   * Data association edges grouped by the ACTIVITY endpoint they nest under on
   * export. Direction decides the element: data → activity is a
   * dataInputAssociation, activity → data a dataOutputAssociation.
   */
  groupDataAssociations(diagram: BpmnDiagram): Map<string, BpmnEdge[]> {
    const byActivity = new Map<string, BpmnEdge[]>();
    for (const edge of Object.values(diagram.edges)) {
      if (edge.type !== DATA_ASSOCIATION_EDGE_TYPE) continue;
      const source = diagram.nodes[edge.sourceId];
      // Input association (data → activity) hangs off the target; anything
      // else (including data → data, a modelling error) off the source.
      const activityId = this.isDataNode(source) ? edge.targetId : edge.sourceId;
      if (!diagram.nodes[activityId]) continue; // dangling — orphanEdgeRule owns this
      byActivity.set(activityId, [...(byActivity.get(activityId) ?? []), edge]);
    }
    return byActivity;
  }

  /**
   * Writes one data association nested in its activity element. Only the far
   * (data-side) ref is written as a child ref element — the activity side is
   * implied by nesting, mirroring how bpmn.io emits these.
   */
  private writeDataAssociation(xml: XmlBuilder, edge: BpmnEdge, activityId: string): void {
    const isInput = edge.targetId === activityId;
    const tag = isInput ? 'bpmn:dataInputAssociation' : 'bpmn:dataOutputAssociation';
    const needsMeta =
      edge.purpose !== undefined ||
      edge.removedInVersion !== undefined ||
      edge.supersedesEdgeId !== undefined ||
      Object.keys(edge.properties).length > 0 ||
      edge.createdInVersion !== '0' ||
      edge.label !== undefined;
    xml.open(tag, { id: edge.id });
    if (needsMeta) {
      this.ext.writeMetaBlock(
        xml,
        {
          purpose: edge.purpose,
          label: edge.label,
          createdInVersion: edge.createdInVersion !== '0' ? edge.createdInVersion : undefined,
          removedInVersion: edge.removedInVersion,
          supersedesEdgeId: edge.supersedesEdgeId,
        },
        Object.entries(edge.properties),
      );
    }
    if (isInput) {
      xml.element('bpmn:sourceRef', {}, edge.sourceId);
    } else {
      xml.element('bpmn:targetRef', {}, edge.targetId);
    }
    xml.close();
  }

  writeEdge(
    xml: XmlBuilder,
    edge: BpmnEdge,
    tag: 'sequenceFlow' | 'messageFlow' | 'association' = 'sequenceFlow',
  ): void {
    const attrs = {
      id: edge.id,
      sourceRef: edge.sourceId,
      targetRef: edge.targetId,
      name: edge.label,
    };
    const needsMeta =
      edge.type !== tag ||
      edge.purpose !== undefined ||
      edge.removedInVersion !== undefined ||
      edge.supersedesEdgeId !== undefined ||
      Object.keys(edge.properties).length > 0 ||
      edge.createdInVersion !== '0';

    if (!needsMeta) {
      xml.element(`bpmn:${tag}`, attrs);
      return;
    }
    xml.open(`bpmn:${tag}`, attrs);
    this.ext.writeMetaBlock(
      xml,
      {
        type: edge.type !== tag ? edge.type : undefined,
        purpose: edge.purpose,
        createdInVersion: edge.createdInVersion !== '0' ? edge.createdInVersion : undefined,
        removedInVersion: edge.removedInVersion,
        supersedesEdgeId: edge.supersedesEdgeId,
      },
      Object.entries(edge.properties),
    );
    xml.close();
  }
}
