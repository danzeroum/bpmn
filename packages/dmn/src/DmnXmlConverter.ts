import {
  createDiagram,
  createVersion,
  generateId,
  MiniXmlParser,
  straightConnection,
  XmlBuilder,
  childrenByLocalName,
  firstChildByLocalName,
  localName,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type Point,
  type VersionStatus,
  type XmlElement,
} from '@bpmn-react/core';
import { DMN_NODE_TYPES, type DmnEdgeType } from './model.js';
import { decisionTableOf } from './decisionTable.js';
import { readDecisionTable, writeDecisionTable } from './decisionTableXml.js';

export const DMN_NS = 'https://www.omg.org/spec/DMN/20191111/MODEL/';
export const DMNDI_NS = 'https://www.omg.org/spec/DMN/20191111/DMNDI/';
/**
 * Human-readable spec version matching DMN_NS (20191111 = DMN 1.3). §11.4:
 * surfaces show this configured string — "DMN 1.x" is never hardcoded in a
 * component; hosts override it where their converter targets change.
 */
export const DMN_SPEC_VERSION = 'DMN 1.3';
const DC_NS = 'http://www.omg.org/spec/DMN/20180521/DC/';
const DI_NS = 'http://www.omg.org/spec/DMN/20180521/DI/';
const EXT = { prefix: 'bpmnr', uri: 'http://bpmn-react.io/schema/1.0' };

const TAG_TO_TYPE = new Map(DMN_NODE_TYPES.map((def) => [def.xml.tag, def]));

/** Requirement element name per edge type. */
function requirementTag(edge: BpmnEdge): string {
  if (edge.type === 'dmn:knowledgeRequirement') return 'knowledgeRequirement';
  if (edge.type === 'dmn:authorityRequirement') return 'authorityRequirement';
  return 'informationRequirement';
}

function requiredRefTag(edge: BpmnEdge, source: BpmnNode | undefined): string {
  if (edge.type === 'dmn:knowledgeRequirement') return 'requiredKnowledge';
  if (edge.type === 'dmn:authorityRequirement') return 'requiredAuthority';
  return source?.type === 'dmn:decision' ? 'requiredDecision' : 'requiredInput';
}

const REQUIREMENT_LOCAL_TO_TYPE: Record<string, DmnEdgeType> = {
  informationRequirement: 'dmn:informationRequirement',
  knowledgeRequirement: 'dmn:knowledgeRequirement',
  authorityRequirement: 'dmn:authorityRequirement',
};

export interface DmnImportResult {
  diagram: BpmnDiagram;
  warnings: string[];
}

const VERSION_STATUSES: VersionStatus[] = [
  'draft',
  'test',
  'candidate',
  'active',
  'deprecated',
  'retired',
];

/**
 * Bidirectional converter between a DRD (modeled as a BpmnDiagram with
 * `dmn:*` node/edge types) and DMN 1.3+ XML (Handoff 5 §11 F-B1). Scope:
 * the §4.1 minimum viable DRD — decision, inputData, knowledgeSource,
 * businessKnowledgeModel and the three requirement edges, plus DMNDI
 * (shapes, bounds, edge waypoints) and the bpmnr governance extension.
 * Same guarantees as the BPMN converter: lossless round-trip, byte-stable
 * canonical export, XXE-safe parsing.
 */
export class DmnXmlConverter {
  // ---------------------------------------------------------------- export

  toXml(diagram: BpmnDiagram): string {
    const xml = new XmlBuilder();
    const definitionsId = /^[A-Za-z_][\w.-]*$/.test(diagram.id)
      ? diagram.id
      : `Definitions_${diagram.id.replace(/[^\w.-]/g, '_')}`;

    xml.open('dmn:definitions', {
      'xmlns:dmn': DMN_NS,
      'xmlns:dmndi': DMNDI_NS,
      'xmlns:dc': DC_NS,
      'xmlns:di': DI_NS,
      [`xmlns:${EXT.prefix}`]: EXT.uri,
      id: definitionsId,
      name: diagram.name,
      namespace: 'http://bpmn-react.io/dmn',
      exporter: 'bpmn-react',
      exporterVersion: '1.0.0',
    });

    // Governance metadata — same shape as the BPMN converter's extension.
    xml.open('dmn:extensionElements');
    xml.element(`${EXT.prefix}:diagram`, {
      originalId: diagram.id,
      description: diagram.description || undefined,
    });
    xml.element(`${EXT.prefix}:version`, {
      versionId: diagram.version.id,
      semanticVersion: diagram.version.semanticVersion,
      status: diagram.version.status,
      changeSummary: diagram.version.changeSummary || undefined,
      createdBy: diagram.version.createdBy,
      createdAt: diagram.version.createdAt,
      snapshotHash: diagram.version.snapshotHash || undefined,
      parentVersionId: diagram.version.parentVersionId,
    });
    xml.close();

    const nodes = Object.values(diagram.nodes);
    const requirementsByOwner = new Map<string, BpmnEdge[]>();
    for (const edge of Object.values(diagram.edges)) {
      if (!(edge.type in REQUIREMENT_TYPE_SET)) continue;
      requirementsByOwner.set(edge.targetId, [
        ...(requirementsByOwner.get(edge.targetId) ?? []),
        edge,
      ]);
    }

    for (const node of nodes) {
      const def = TAG_TO_TYPE_BY_TYPE.get(node.type);
      if (!def) continue; // non-DMN node in a DRD — not expressible
      const tag = `dmn:${def.xml.tag}`;
      const requirements = requirementsByOwner.get(node.id) ?? [];
      const meta = this.nodeMeta(node);
      // A decision's logic is written canonically as <dmn:decisionTable> (below),
      // never as a bpmnr:property blob — so nodeMeta() excludes it.
      const table = node.type === 'dmn:decision' ? decisionTableOf(node) : undefined;
      if (requirements.length === 0 && !meta && !table) {
        xml.element(tag, { id: node.id, name: node.label });
        continue;
      }
      xml.open(tag, { id: node.id, name: node.label });
      if (meta) this.writeMeta(xml, meta);
      for (const edge of requirements) {
        const source = diagram.nodes[edge.sourceId];
        xml.open(`dmn:${requirementTag(edge)}`, { id: edge.id });
        xml.element(`dmn:${requiredRefTag(edge, source)}`, { href: `#${edge.sourceId}` });
        xml.close();
      }
      // The decision's expression comes last in the DMN schema (after requirements).
      if (table) writeDecisionTable(xml, table, node.id);
      xml.close();
    }

    // DMNDI: shapes for every node, edges with waypoints for requirements.
    xml.open('dmndi:DMNDI');
    xml.open('dmndi:DMNDiagram', { id: 'DMNDiagram_1' });
    for (const node of nodes) {
      xml.open('dmndi:DMNShape', { id: `${node.id}_di`, dmnElementRef: node.id });
      xml.element('dc:Bounds', { x: node.x, y: node.y, width: node.width, height: node.height });
      xml.close();
    }
    for (const edge of Object.values(diagram.edges)) {
      if (!(edge.type in REQUIREMENT_TYPE_SET)) continue;
      const waypoints = this.edgeWaypoints(diagram, edge);
      if (waypoints.length < 2) continue;
      xml.open('dmndi:DMNEdge', { id: `${edge.id}_di`, dmnElementRef: edge.id });
      for (const point of waypoints) {
        xml.element('di:waypoint', { x: point.x, y: point.y });
      }
      xml.close();
    }
    xml.close(); // diagram
    xml.close(); // DMNDI
    xml.close(); // definitions
    return xml.toString();
  }

  /** Extension payload for a node — only written when non-default. */
  private nodeMeta(node: BpmnNode): Record<string, string> | undefined {
    const entries: Record<string, string> = {};
    if (node.createdInVersion !== '0') entries.createdInVersion = node.createdInVersion;
    if (node.removedInVersion !== undefined) entries.removedInVersion = node.removedInVersion;
    for (const [key, value] of Object.entries(node.properties)) {
      // The decision table is serialized canonically as <dmn:decisionTable>,
      // not double-encoded here as a proprietary JSON property.
      if (key === 'decisionTable') continue;
      entries[`property:${key}`] = JSON.stringify(value);
    }
    return Object.keys(entries).length > 0 ? entries : undefined;
  }

  private writeMeta(xml: XmlBuilder, meta: Record<string, string>): void {
    xml.open('dmn:extensionElements');
    const attrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (!key.startsWith('property:')) attrs[key] = value;
    }
    if (Object.keys(attrs).length > 0) xml.element(`${EXT.prefix}:meta`, attrs);
    for (const [key, value] of Object.entries(meta)) {
      if (key.startsWith('property:')) {
        xml.element(`${EXT.prefix}:property`, { name: key.slice('property:'.length), value });
      }
    }
    xml.close();
  }

  private edgeWaypoints(diagram: BpmnDiagram, edge: BpmnEdge): Point[] {
    if (edge.waypoints && edge.waypoints.length >= 2) return edge.waypoints;
    const source = diagram.nodes[edge.sourceId];
    const target = diagram.nodes[edge.targetId];
    if (!source || !target) return [];
    // Requirement edges are straight (§4.1) — two border-anchored points.
    const line = straightConnection(source, target);
    return [line.start, line.end];
  }

  // ---------------------------------------------------------------- import

  fromXml(xmlText: string): DmnImportResult {
    const warnings: string[] = [];
    const root = new MiniXmlParser().parse(xmlText);
    if (localName(root.tag) !== 'definitions') {
      throw new Error(`Expected <definitions> root element, got <${root.tag}>`);
    }

    const extension = firstChildByLocalName(root, 'extensionElements');
    const diagramMeta = extension
      ? childrenByLocalName(extension, 'diagram')[0]
      : undefined;
    const versionMeta = extension
      ? childrenByLocalName(extension, 'version')[0]
      : undefined;

    const diagram = createDiagram({
      id: diagramMeta?.attributes.originalId ?? root.attributes.id ?? generateId(),
      name: root.attributes.name ?? 'Imported DRD',
    });
    diagram.description = diagramMeta?.attributes.description ?? '';
    diagram.version = this.readVersion(versionMeta);

    for (const child of root.children) {
      const tag = localName(child.tag);
      const def = TAG_TO_TYPE.get(tag);
      if (!def) {
        if (!['extensionElements', 'DMNDI'].includes(tag)) {
          warnings.push(`Ignored unsupported element <${child.tag}>`);
        }
        continue;
      }
      const node = this.readNode(child, def.type, def.defaultSize);
      // Canonical decision logic takes precedence over any legacy
      // bpmnr:property="decisionTable" blob readNode may have parsed.
      if (node.type === 'dmn:decision') {
        const table = readDecisionTable(child);
        if (table) node.properties.decisionTable = table;
      }
      diagram.nodes[node.id] = node;
      this.readRequirements(child, node.id, diagram, warnings);
    }

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
      return createVersion({ changeSummary: 'Imported from DMN XML', createdBy: 'import' });
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

  private readNode(
    el: XmlElement,
    type: string,
    defaultSize: { width: number; height: number },
  ): BpmnNode {
    const properties: Record<string, unknown> = {};
    let createdInVersion = '0';
    let removedInVersion: string | undefined;
    const extension = firstChildByLocalName(el, 'extensionElements');
    for (const child of extension?.children ?? []) {
      const tag = localName(child.tag);
      if (tag === 'meta') {
        if (child.attributes.createdInVersion) createdInVersion = child.attributes.createdInVersion;
        if (child.attributes.removedInVersion) removedInVersion = child.attributes.removedInVersion;
      } else if (tag === 'property') {
        const name = child.attributes.name;
        const raw = child.attributes.value;
        if (name !== undefined && raw !== undefined) {
          try {
            properties[name] = JSON.parse(raw);
          } catch {
            properties[name] = raw;
          }
        }
      }
    }
    return {
      id: el.attributes.id ?? generateId(),
      type,
      label: el.attributes.name ?? type,
      x: 0,
      y: 0,
      width: defaultSize.width,
      height: defaultSize.height,
      properties,
      createdInVersion,
      ...(removedInVersion ? { removedInVersion } : {}),
      audit: { createdAt: new Date().toISOString(), createdBy: 'import', history: [] },
    };
  }

  private readRequirements(
    ownerEl: XmlElement,
    ownerId: string,
    diagram: BpmnDiagram,
    warnings: string[],
  ): void {
    for (const child of ownerEl.children) {
      const type = REQUIREMENT_LOCAL_TO_TYPE[localName(child.tag)];
      if (!type) continue;
      const ref = child.children.find((c) => localName(c.tag).startsWith('required'));
      const href = ref?.attributes.href;
      if (!href || !href.startsWith('#')) {
        warnings.push(
          `Ignored ${localName(child.tag)} ${child.attributes.id ?? '?'} on ${ownerId} without a valid href`,
        );
        continue;
      }
      const edge: BpmnEdge = {
        id: child.attributes.id ?? generateId(),
        type,
        sourceId: href.slice(1),
        targetId: ownerId,
        properties: {},
        createdInVersion: '0',
        audit: { createdAt: new Date().toISOString(), createdBy: 'import', history: [] },
      };
      diagram.edges[edge.id] = edge;
    }
  }

  private applyDi(root: XmlElement, diagram: BpmnDiagram, warnings: string[]): void {
    const dmndi = firstChildByLocalName(root, 'DMNDI');
    const plane = dmndi ? firstChildByLocalName(dmndi, 'DMNDiagram') : undefined;
    const shapes = plane ? childrenByLocalName(plane, 'DMNShape') : [];
    for (const shape of shapes) {
      const node = shape.attributes.dmnElementRef
        ? diagram.nodes[shape.attributes.dmnElementRef]
        : undefined;
      const bounds = firstChildByLocalName(shape, 'Bounds');
      if (!node || !bounds) continue;
      const x = Number(bounds.attributes.x);
      const y = Number(bounds.attributes.y);
      const width = Number(bounds.attributes.width);
      const height = Number(bounds.attributes.height);
      if ([x, y, width, height].some(Number.isNaN)) {
        warnings.push(`Invalid bounds for shape ${shape.attributes.dmnElementRef}`);
        continue;
      }
      diagram.nodes[node.id] = { ...node, x, y, width, height };
    }
    for (const diEdge of plane ? childrenByLocalName(plane, 'DMNEdge') : []) {
      const edge = diEdge.attributes.dmnElementRef
        ? diagram.edges[diEdge.attributes.dmnElementRef]
        : undefined;
      if (!edge) continue;
      const waypoints: Point[] = [];
      for (const wp of childrenByLocalName(diEdge, 'waypoint')) {
        const x = Number(wp.attributes.x);
        const y = Number(wp.attributes.y);
        if (!Number.isNaN(x) && !Number.isNaN(y)) waypoints.push({ x, y });
      }
      if (waypoints.length >= 2) diagram.edges[edge.id] = { ...edge, waypoints };
    }
    if (shapes.length === 0) {
      const nodes = Object.values(diagram.nodes);
      nodes.forEach((node, index) => {
        diagram.nodes[node.id] = {
          ...node,
          x: 80 + (index % 4) * 200,
          y: 80 + Math.floor(index / 4) * 140,
        };
      });
      if (nodes.length > 0) warnings.push('Document has no DMNDI — applied automatic grid layout');
    }
  }
}

const REQUIREMENT_TYPE_SET: Record<string, true> = {
  'dmn:informationRequirement': true,
  'dmn:knowledgeRequirement': true,
  'dmn:authorityRequirement': true,
};

const TAG_TO_TYPE_BY_TYPE = new Map(DMN_NODE_TYPES.map((def) => [def.type, def]));
