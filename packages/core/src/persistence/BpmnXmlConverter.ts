import type {
  BpmnDiagram,
  BpmnEdge,
  BpmnNode,
  EventDefinitionKind,
  Point,
  VersionStatus,
} from '../model/types.js';
import {
  activeNodes,
  eventDefinitionOf,
  EVENT_DEFINITION_KINDS,
  isContainerType,
  laneFlowNodeRefs,
} from '../model/types.js';
import { BpmnParseError } from '../model/errors.js';
import { createDefaultRegistry, type NodeTypeRegistry } from '../model/registry.js';
import { createVersion, generateId } from '../model/factory.js';
import { routeOrthogonal } from '../geometry/index.js';
import { XmlBuilder } from '../xml/XmlBuilder.js';
import { getDefaultXmlAdapter, type XmlParserAdapter } from '../xml/adapter.js';
import {
  childrenByLocalName,
  findByLocalName,
  firstChildByLocalName,
  localName,
  type XmlElement,
} from '../xml/MiniXmlParser.js';

export const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
export const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
export const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';
export const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';
export const DEFAULT_EXTENSION_NS = {
  prefix: 'bpmnr',
  uri: 'http://bpmn-react.io/schema/1.0',
};

const VERSION_STATUSES: VersionStatus[] = [
  'draft',
  'test',
  'candidate',
  'active',
  'deprecated',
  'retired',
];

export interface XmlConverterOptions {
  registry?: NodeTypeRegistry;
  adapter?: XmlParserAdapter;
  /**
   * Custom node types (registered by plugins) that take precedence when an
   * imported element has no explicit type metadata.
   */
  preferredTypes?: string[];
  extensionNamespace?: { prefix: string; uri: string };
}

export interface ImportResult {
  diagram: BpmnDiagram;
  /** Non-fatal problems found during import (unknown elements, missing refs…). */
  warnings: string[];
}

/**
 * Bidirectional converter between the bpmn-react model and BPMN 2.0 XML.
 *
 * Scope: the documented MVP profile (see docs/format-spec.md) — process
 * elements from the standard set, sequence flows, full BPMN DI (shapes,
 * bounds, edge waypoints) and vendor extensions inside `extensionElements`.
 * Interoperable with Camunda Modeler / bpmn.io: unknown elements are ignored
 * with warnings rather than rejected.
 */
export class BpmnXmlConverter {
  private readonly registry: NodeTypeRegistry;
  private readonly adapter: XmlParserAdapter;
  private readonly preferredTypes: string[];
  private readonly ext: { prefix: string; uri: string };

  constructor(options: XmlConverterOptions = {}) {
    this.registry = options.registry ?? createDefaultRegistry();
    this.adapter = options.adapter ?? getDefaultXmlAdapter();
    this.preferredTypes = options.preferredTypes ?? [];
    this.ext = options.extensionNamespace ?? DEFAULT_EXTENSION_NS;
  }

  // ---------------------------------------------------------------- export

  toXml(diagram: BpmnDiagram): string {
    const xml = new XmlBuilder();
    const processId = xmlSafeId(diagram.id, 'Process');
    const collaborationId = `Collaboration_${processId}`;

    const nodes = Object.values(diagram.nodes);
    const pools = nodes.filter((n) => n.type === 'pool');
    const lanes = nodes.filter((n) => n.type === 'lane');
    const flowNodes = nodes.filter((n) => !isContainerType(n.type));

    // Message flows live in the collaboration — only expressible when one
    // exists (i.e. the diagram has pools). Without pools they fall back to
    // sequenceFlow + bpmnr:meta, which round-trips the type losslessly.
    const edges = Object.values(diagram.edges);
    const messageFlows = pools.length > 0 ? edges.filter((e) => e.type === 'messageFlow') : [];
    const processEdges = pools.length > 0 ? edges.filter((e) => e.type !== 'messageFlow') : edges;

    xml.open('bpmn:definitions', {
      'xmlns:bpmn': BPMN_NS,
      'xmlns:bpmndi': BPMNDI_NS,
      'xmlns:dc': DC_NS,
      'xmlns:di': DI_NS,
      [`xmlns:${this.ext.prefix}`]: this.ext.uri,
      id: `Definitions_${processId}`,
      targetNamespace: 'http://bpmn-react.io/bpmn',
      exporter: 'bpmn-react',
      exporterVersion: '1.0.0',
    });

    // Pools become participants inside a collaboration referencing the process.
    if (pools.length > 0) {
      xml.open('bpmn:collaboration', { id: collaborationId });
      for (const pool of pools) {
        xml.element('bpmn:participant', {
          id: pool.id,
          name: pool.label,
          processRef: processId,
        });
      }
      for (const flow of messageFlows) {
        this.writeEdge(xml, flow, 'messageFlow');
      }
      xml.close();
    }

    xml.open('bpmn:process', { id: processId, name: diagram.name, isExecutable: 'false' });
    this.writeDiagramExtension(xml, diagram);

    // Lanes become a laneSet whose lanes list the flow nodes they contain.
    if (lanes.length > 0) {
      xml.open('bpmn:laneSet', { id: `LaneSet_${processId}` });
      for (const lane of lanes) {
        // Stale references (deleted nodes) would make the export invalid BPMN.
        const refs = laneFlowNodeRefs(lane).filter((id) => diagram.nodes[id]);
        if (refs.length === 0) {
          xml.element('bpmn:lane', { id: lane.id, name: lane.label });
        } else {
          xml.open('bpmn:lane', { id: lane.id, name: lane.label });
          for (const ref of refs) xml.element('bpmn:flowNodeRef', {}, ref);
          xml.close();
        }
      }
      xml.close();
    }

    for (const node of flowNodes) {
      this.writeNode(xml, node);
    }
    for (const edge of processEdges) {
      this.writeEdge(xml, edge, edge.type === 'association' ? 'association' : 'sequenceFlow');
    }
    xml.close(); // process

    this.writeDi(xml, diagram, pools.length > 0 ? collaborationId : processId);
    xml.close(); // definitions
    return xml.toString();
  }

  private writeDiagramExtension(xml: XmlBuilder, diagram: BpmnDiagram): void {
    const p = this.ext.prefix;
    xml.open('bpmn:extensionElements');
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
    for (const [key, value] of Object.entries(diagram.metadata)) {
      xml.element(`${p}:property`, { name: key, value: JSON.stringify(value) });
    }
    xml.close();
  }

  private writeNode(xml: XmlBuilder, node: BpmnNode): void {
    const def = this.registry.has(node.type) ? this.registry.get(node.type) : undefined;
    const tag = def?.xml.tag ?? 'task';
    const p = this.ext.prefix;
    // Event kind travels as the standard <bpmn:{kind}EventDefinition/> child, not
    // as a bpmnr:property, so it interoperates and is not double-encoded.
    const eventDef = eventDefinitionOf(node);
    const propEntries = Object.entries(node.properties).filter(
      ([key]) => !(eventDef && key === 'eventDefinition'),
    );
    const needsMeta =
      node.type !== tag ||
      node.removedInVersion !== undefined ||
      propEntries.length > 0 ||
      node.createdInVersion !== '0';

    if (!needsMeta && eventDef === undefined) {
      xml.element(`bpmn:${tag}`, { id: node.id, name: node.label });
      return;
    }
    xml.open(`bpmn:${tag}`, { id: node.id, name: node.label });
    if (needsMeta) {
      xml.open('bpmn:extensionElements');
      xml.element(`${p}:meta`, {
        type: node.type !== tag ? node.type : undefined,
        createdInVersion: node.createdInVersion !== '0' ? node.createdInVersion : undefined,
        removedInVersion: node.removedInVersion,
      });
      for (const [key, value] of propEntries) {
        xml.element(`${p}:property`, { name: key, value: JSON.stringify(value) });
      }
      xml.close();
    }
    if (eventDef !== undefined) {
      xml.element(`bpmn:${eventDef}EventDefinition`, { id: `${node.id}_def` });
    }
    xml.close();
  }

  private writeEdge(
    xml: XmlBuilder,
    edge: BpmnEdge,
    tag: 'sequenceFlow' | 'messageFlow' | 'association' = 'sequenceFlow',
  ): void {
    const p = this.ext.prefix;
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
    xml.open('bpmn:extensionElements');
    xml.element(`${p}:meta`, {
      type: edge.type !== tag ? edge.type : undefined,
      purpose: edge.purpose,
      createdInVersion: edge.createdInVersion !== '0' ? edge.createdInVersion : undefined,
      removedInVersion: edge.removedInVersion,
      supersedesEdgeId: edge.supersedesEdgeId,
    });
    for (const [key, value] of Object.entries(edge.properties)) {
      xml.element(`${p}:property`, { name: key, value: JSON.stringify(value) });
    }
    xml.close();
    xml.close();
  }

  private writeDi(xml: XmlBuilder, diagram: BpmnDiagram, processId: string): void {
    xml.open('bpmndi:BPMNDiagram', { id: 'BPMNDiagram_1' });
    xml.open('bpmndi:BPMNPlane', { id: 'BPMNPlane_1', bpmnElement: processId });

    for (const node of Object.values(diagram.nodes)) {
      xml.open('bpmndi:BPMNShape', {
        id: `${node.id}_di`,
        bpmnElement: node.id,
        // Pools/lanes are rendered as horizontal swimlanes.
        isHorizontal: isContainerType(node.type) ? 'true' : undefined,
      });
      xml.element('dc:Bounds', {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
      xml.close();
    }

    for (const edge of Object.values(diagram.edges)) {
      const waypoints = this.edgeWaypoints(diagram, edge);
      if (waypoints.length < 2) continue;
      xml.open('bpmndi:BPMNEdge', { id: `${edge.id}_di`, bpmnElement: edge.id });
      for (const point of waypoints) {
        xml.element('di:waypoint', { x: point.x, y: point.y });
      }
      xml.close();
    }

    xml.close(); // plane
    xml.close(); // diagram
  }

  private edgeWaypoints(diagram: BpmnDiagram, edge: BpmnEdge): Point[] {
    if (edge.waypoints && edge.waypoints.length >= 2) return edge.waypoints;
    const source = diagram.nodes[edge.sourceId];
    const target = diagram.nodes[edge.targetId];
    if (!source || !target) return [];
    return routeOrthogonal(source, target);
  }

  // ---------------------------------------------------------------- import

  fromXml(xmlText: string): ImportResult {
    const warnings: string[] = [];
    const root = this.adapter.parse(xmlText);
    if (localName(root.tag) !== 'definitions') {
      throw new BpmnParseError(`Expected <definitions> root element, got <${root.tag}>`);
    }
    const processEl = firstChildByLocalName(root, 'process');
    if (!processEl) {
      throw new BpmnParseError('No <process> element found in the BPMN document');
    }

    const extension = this.readExtensionElements(processEl);
    const diagramMeta = extension.elements.find((e) => localName(e.tag) === 'diagram');
    const versionMeta = extension.elements.find((e) => localName(e.tag) === 'version');

    const diagram: BpmnDiagram = {
      id: diagramMeta?.attributes.originalId ?? processEl.attributes.id ?? generateId(),
      name: processEl.attributes.name ?? 'Imported process',
      description: diagramMeta?.attributes.description ?? '',
      version: this.readVersion(versionMeta),
      nodes: {},
      edges: {},
      metadata: extension.properties,
    };

    // Pools and message flows live in a <collaboration> at the root.
    const collaboration = firstChildByLocalName(root, 'collaboration');
    if (collaboration) {
      for (const participant of childrenByLocalName(collaboration, 'participant')) {
        const pool = this.readContainer(participant, 'pool');
        if (pool) diagram.nodes[pool.id] = pool;
      }
      for (const flowEl of childrenByLocalName(collaboration, 'messageFlow')) {
        const edge = this.readEdge(flowEl, warnings, 'messageFlow');
        if (edge) diagram.edges[edge.id] = edge;
      }
    }

    for (const child of processEl.children) {
      const tag = localName(child.tag);
      if (tag === 'extensionElements') continue;
      if (tag === 'laneSet') {
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
      if (node) diagram.nodes[node.id] = node;
    }

    // Validate edge references.
    for (const edge of Object.values(diagram.edges)) {
      if (!diagram.nodes[edge.sourceId] || !diagram.nodes[edge.targetId]) {
        warnings.push(`Edge ${edge.id} references a node not present in the document`);
      }
    }

    this.applyDi(root, diagram, warnings);
    return { diagram, warnings };
  }

  private readVersion(versionMeta: XmlElement | undefined): BpmnDiagram['version'] {
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

  private readExtensionElements(el: XmlElement): {
    properties: Record<string, unknown>;
    meta: Record<string, string>;
    elements: XmlElement[];
  } {
    const container = firstChildByLocalName(el, 'extensionElements');
    const properties: Record<string, unknown> = {};
    let meta: Record<string, string> = {};
    const elements: XmlElement[] = container?.children ?? [];
    for (const child of elements) {
      const tag = localName(child.tag);
      if (tag === 'property') {
        const name = child.attributes.name;
        const raw = child.attributes.value;
        if (name !== undefined && raw !== undefined) {
          try {
            properties[name] = JSON.parse(raw);
          } catch {
            properties[name] = raw;
          }
        }
      } else if (tag === 'meta') {
        meta = { ...child.attributes };
      }
    }
    return { properties, meta, elements };
  }

  private readNode(el: XmlElement, warnings: string[]): BpmnNode | undefined {
    const tag = localName(el.tag);
    const { properties, meta } = this.readExtensionElements(el);

    let type: string | undefined;
    if (meta.type && this.registry.has(meta.type)) {
      type = meta.type;
    } else {
      type = this.registry.typeForXmlTag(tag, this.preferredTypes)?.type;
    }
    if (!type) {
      warnings.push(`Ignored unsupported element <${el.tag}>`);
      return undefined;
    }
    // Standard <bpmn:{kind}EventDefinition/> child → properties.eventDefinition.
    const eventDef = readEventDefinition(el);
    if (eventDef) properties.eventDefinition = eventDef;
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
  private readContainer(el: XmlElement, type: 'pool' | 'lane'): BpmnNode | undefined {
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

  private readEdge(
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
    const { properties, meta } = this.readExtensionElements(el);
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

  private applyDi(root: XmlElement, diagram: BpmnDiagram, warnings: string[]): void {
    const shapes = findByLocalName(root, 'BPMNShape');
    for (const shape of shapes) {
      const elementId = shape.attributes.bpmnElement;
      const node = elementId ? diagram.nodes[elementId] : undefined;
      const bounds = firstChildByLocalName(shape, 'Bounds');
      if (!node || !bounds) continue;
      const x = Number(bounds.attributes.x);
      const y = Number(bounds.attributes.y);
      const width = Number(bounds.attributes.width);
      const height = Number(bounds.attributes.height);
      if ([x, y, width, height].some(Number.isNaN)) {
        warnings.push(`Invalid bounds for shape ${elementId}`);
        continue;
      }
      diagram.nodes[node.id] = { ...node, x, y, width, height };
    }

    const diEdges = findByLocalName(root, 'BPMNEdge');
    for (const diEdge of diEdges) {
      const elementId = diEdge.attributes.bpmnElement;
      const edge = elementId ? diagram.edges[elementId] : undefined;
      if (!edge) continue;
      const waypoints: Point[] = [];
      for (const wp of childrenByLocalName(diEdge, 'waypoint')) {
        const x = Number(wp.attributes.x);
        const y = Number(wp.attributes.y);
        if (Number.isNaN(x) || Number.isNaN(y)) continue;
        waypoints.push({ x, y });
      }
      if (waypoints.length >= 2) {
        diagram.edges[edge.id] = { ...edge, waypoints };
      }
    }

    // If no DI at all, spread nodes on a simple grid so the import is usable.
    const hasAnyDi = shapes.length > 0;
    if (!hasAnyDi) {
      const nodes = activeNodes(diagram);
      nodes.forEach((node, index) => {
        diagram.nodes[node.id] = {
          ...node,
          x: 80 + (index % 4) * 200,
          y: 80 + Math.floor(index / 4) * 140,
        };
      });
      if (nodes.length > 0) warnings.push('Document has no BPMN DI — applied automatic grid layout');
    }
  }
}

/** BPMN ids must be valid NCNames; fall back to a prefixed form when not. */
function xmlSafeId(id: string, prefix: string): string {
  return /^[A-Za-z_][\w.-]*$/.test(id) ? id : `${prefix}_${id.replace(/[^\w.-]/g, '_')}`;
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
