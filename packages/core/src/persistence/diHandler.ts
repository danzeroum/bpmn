import type { BpmnDiagram, BpmnEdge, Point } from '../model/types.js';
import { activeNodes, isContainerType } from '../model/types.js';
import { routeOrthogonal } from '../geometry/index.js';
import type { XmlBuilder } from '../xml/XmlBuilder.js';
import {
  childrenByLocalName,
  findByLocalName,
  firstChildByLocalName,
  type XmlElement,
} from '../xml/MiniXmlParser.js';

/**
 * Reads and writes the BPMN DI layer (`bpmndi:BPMNDiagram` / `BPMNShape` /
 * `BPMNEdge` and the `dc:Bounds` / `di:waypoint` geometry). Extracted from
 * `BpmnXmlConverter` — geometry (de)serialization is an independent concern
 * from the semantic model, so it lives on its own. Behaviour is unchanged.
 */
export class DIHandler {
  /** Writes the `bpmndi:BPMNDiagram` plane with a shape per node and an edge
   * (with waypoints) per connection. */
  writeDi(xml: XmlBuilder, diagram: BpmnDiagram, planeElement: string): void {
    xml.open('bpmndi:BPMNDiagram', { id: 'BPMNDiagram_1' });
    xml.open('bpmndi:BPMNPlane', { id: 'BPMNPlane_1', bpmnElement: planeElement });

    for (const node of Object.values(diagram.nodes)) {
      xml.open('bpmndi:BPMNShape', {
        id: `${node.id}_di`,
        bpmnElement: node.id,
        // Pools/lanes are rendered as horizontal swimlanes.
        isHorizontal: isContainerType(node.type) ? 'true' : undefined,
        // Sub-process expansion is a DI concern (standard attribute).
        isExpanded:
          node.type === 'subProcess' && typeof node.properties.isExpanded === 'boolean'
            ? String(node.properties.isExpanded)
            : undefined,
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

  /**
   * Applies parsed DI geometry onto an already-built diagram: shape bounds onto
   * nodes (plus sub-process `isExpanded`), edge waypoints onto edges. When the
   * document carries no DI at all, spreads nodes on a simple grid so the import
   * stays usable. Pushes warnings for invalid bounds / missing DI.
   */
  applyDi(root: XmlElement, diagram: BpmnDiagram, warnings: string[]): void {
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
      // BPMN DI carries a sub-process' expansion on its shape.
      const properties =
        node.type === 'subProcess' && shape.attributes.isExpanded !== undefined
          ? { ...node.properties, isExpanded: shape.attributes.isExpanded === 'true' }
          : node.properties;
      diagram.nodes[node.id] = { ...node, x, y, width, height, properties };
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
