import type { BpmnDiagram, BpmnEdge, BpmnNode, Point, VersionStatus } from '../model/types.js';
import { activeNodes } from '../model/types.js';
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

    xml.open('bpmn:definitions', {
      'xmlns:bpmn': BPMN_NS,
      'xmlns:bpmndi': BPMNDI_NS,
      'xmlns:dc': DC_NS,
      'xmlns:di': DI_NS,
      [`xmlns:${this.ext.prefix}`]: this.ext.uri,
      id: `Definitions_${processId}`,
      targetNamespace: 'http://bpmn-react.io/bpmn',
      exporter: 'bpmn-react',
      exporterVersion: '0.1.0',
    });

    xml.open('bpmn:process', { id: processId, name: diagram.name, isExecutable: 'false' });
    this.writeDiagramExtension(xml, diagram);

    for (const node of Object.values(diagram.nodes)) {
      this.writeNode(xml, node);
    }
    for (const edge of Object.values(diagram.edges)) {
      this.writeEdge(xml, edge);
    }
    xml.close(); // process

    this.writeDi(xml, diagram, processId);
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
    const needsMeta =
      node.type !== tag ||
      node.removedInVersion !== undefined ||
      Object.keys(node.properties).length > 0 ||
      node.createdInVersion !== '0';

    if (!needsMeta) {
      xml.element(`bpmn:${tag}`, { id: node.id, name: node.label });
      return;
    }
    xml.open(`bpmn:${tag}`, { id: node.id, name: node.label });
    xml.open('bpmn:extensionElements');
    xml.element(`${p}:meta`, {
      type: node.type !== tag ? node.type : undefined,
      createdInVersion: node.createdInVersion !== '0' ? node.createdInVersion : undefined,
      removedInVersion: node.removedInVersion,
    });
    for (const [key, value] of Object.entries(node.properties)) {
      xml.element(`${p}:property`, { name: key, value: JSON.stringify(value) });
    }
    xml.close();
    xml.close();
  }

  private writeEdge(xml: XmlBuilder, edge: BpmnEdge): void {
    const p = this.ext.prefix;
    const attrs = {
      id: edge.id,
      sourceRef: edge.sourceId,
      targetRef: edge.targetId,
      name: edge.label,
    };
    const needsMeta =
      edge.type !== 'sequenceFlow' ||
      edge.purpose !== undefined ||
      edge.removedInVersion !== undefined ||
      edge.supersedesEdgeId !== undefined ||
      Object.keys(edge.properties).length > 0 ||
      edge.createdInVersion !== '0';

    if (!needsMeta) {
      xml.element('bpmn:sequenceFlow', attrs);
      return;
    }
    xml.open('bpmn:sequenceFlow', attrs);
    xml.open('bpmn:extensionElements');
    xml.element(`${p}:meta`, {
      type: edge.type !== 'sequenceFlow' ? edge.type : undefined,
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
      xml.open('bpmndi:BPMNShape', { id: `${node.id}_di`, bpmnElement: node.id });
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

    for (const child of processEl.children) {
      const tag = localName(child.tag);
      if (tag === 'extensionElements') continue;
      if (tag === 'sequenceFlow') {
        const edge = this.readEdge(child, warnings);
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

  private readEdge(el: XmlElement, warnings: string[]): BpmnEdge | undefined {
    const sourceId = el.attributes.sourceRef;
    const targetId = el.attributes.targetRef;
    if (!sourceId || !targetId) {
      warnings.push(`Ignored sequenceFlow ${el.attributes.id ?? '?'} without source/target refs`);
      return undefined;
    }
    const { properties, meta } = this.readExtensionElements(el);
    return {
      id: el.attributes.id ?? generateId(),
      type: meta.type ?? 'sequenceFlow',
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
