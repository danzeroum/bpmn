import type { BpmnDiagram, BpmnEdge } from '../model/types.js';
import {
  DATA_ASSOCIATION_EDGE_TYPE,
  boundaryAttachedTo,
  isContainerType,
  laneFlowNodeRefs,
  nodeParentId,
} from '../model/types.js';
import { boundaryAnchorOf } from '../geometry/boundary.js';
import { BpmnParseError } from '../model/errors.js';
import { createDefaultRegistry, type NodeTypeRegistry } from '../model/registry.js';
import { generateId } from '../model/factory.js';
import { XmlBuilder } from '../xml/XmlBuilder.js';
import { getDefaultXmlAdapter, type XmlParserAdapter } from '../xml/adapter.js';
import {
  childrenByLocalName,
  firstChildByLocalName,
  localName,
} from '../xml/MiniXmlParser.js';
import { ExtensionHandler } from './extensionHandler.js';
import { ElementSerializer } from './elementSerializer.js';
import { ElementDeserializer } from './elementDeserializer.js';
import { DIHandler } from './diHandler.js';

export const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
export const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
export const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';
export const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';
export const DEFAULT_EXTENSION_NS = {
  prefix: 'bpmnr',
  uri: 'http://bpmn-react.io/schema/1.0',
};

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
 *
 * This class is a thin orchestrator: it frames the document (definitions,
 * collaboration, process, DI) and delegates the actual element work to focused
 * collaborators — {@link ElementSerializer} / {@link ElementDeserializer} for
 * the semantic model, {@link DIHandler} for geometry, and {@link
 * ExtensionHandler} for the `bpmnr:*` extension encoding.
 */
export class BpmnXmlConverter {
  private readonly adapter: XmlParserAdapter;
  private readonly serializer: ElementSerializer;
  private readonly deserializer: ElementDeserializer;
  private readonly di: DIHandler;
  private readonly ext: ExtensionHandler;

  constructor(options: XmlConverterOptions = {}) {
    const registry: NodeTypeRegistry = options.registry ?? createDefaultRegistry();
    this.adapter = options.adapter ?? getDefaultXmlAdapter();
    this.ext = new ExtensionHandler(options.extensionNamespace ?? DEFAULT_EXTENSION_NS);
    this.serializer = new ElementSerializer(registry, this.ext);
    this.deserializer = new ElementDeserializer(registry, options.preferredTypes ?? [], this.ext);
    this.di = new DIHandler();
  }

  // ---------------------------------------------------------------- export

  toXml(diagram: BpmnDiagram): string {
    const xml = new XmlBuilder();
    const processId = xmlSafeId(diagram.id, 'Process');
    const collaborationId = `Collaboration_${processId}`;

    const nodes = Object.values(diagram.nodes);
    const pools = nodes.filter((n) => n.type === 'pool');
    const lanes = nodes.filter((n) => n.type === 'lane');
    // Children of a sub-process are written NESTED inside their container
    // element (writeNode recursion); only top-level flow nodes appear here.
    const flowNodes = nodes.filter(
      (n) => !isContainerType(n.type) && nodeParentId(n) === undefined,
    );

    // Message flows live in the collaboration — only expressible when one
    // exists (i.e. the diagram has pools). Without pools they fall back to
    // sequenceFlow + bpmnr:meta, which round-trips the type losslessly.
    const edges = Object.values(diagram.edges);
    const messageFlows = pools.length > 0 ? edges.filter((e) => e.type === 'messageFlow') : [];
    // Data associations nest inside their activity element (standard BPMN),
    // never at the process level.
    const dataAssocsByActivity = this.serializer.groupDataAssociations(diagram);
    const scopedEdges = edges.filter(
      (e) =>
        e.type !== DATA_ASSOCIATION_EDGE_TYPE && (pools.length === 0 || e.type !== 'messageFlow'),
    );
    // Sequence flows are scoped to their container: flows between children of
    // a sub-process nest inside it, the rest stay at the process level.
    const edgesByScope = new Map<string | undefined, BpmnEdge[]>();
    for (const edge of scopedEdges) {
      const scope = this.serializer.edgeScopeOf(diagram, edge);
      edgesByScope.set(scope, [...(edgesByScope.get(scope) ?? []), edge]);
    }
    const processEdges = edgesByScope.get(undefined) ?? [];

    // Passthrough: foreign xmlns declarations captured at import, re-declared
    // in sorted-prefix order (deterministic bytes).
    const foreignNs = Object.fromEntries(
      Object.entries(diagram.foreignNamespaces ?? {})
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([prefix, uri]) => [`xmlns:${prefix}`, uri]),
    );
    xml.open('bpmn:definitions', {
      'xmlns:bpmn': BPMN_NS,
      'xmlns:bpmndi': BPMNDI_NS,
      'xmlns:dc': DC_NS,
      'xmlns:di': DI_NS,
      [`xmlns:${this.ext.prefix}`]: this.ext.uri,
      ...foreignNs,
      id: `Definitions_${processId}`,
      targetNamespace: 'http://bpmn-react.io/bpmn',
      exporter: 'bpmn-react',
      exporterVersion: '1.0.0',
    });

    // Named event definitions (Handoff 16 §3a): OMG root elements, emitted
    // before collaboration/process in stored array order.
    if (diagram.definitions) {
      for (const message of diagram.definitions.messages) {
        xml.element('bpmn:message', { id: message.id, name: message.name || undefined });
      }
      for (const signal of diagram.definitions.signals) {
        xml.element('bpmn:signal', { id: signal.id, name: signal.name || undefined });
      }
      for (const error of diagram.definitions.errors) {
        xml.element('bpmn:error', {
          id: error.id,
          name: error.name || undefined,
          errorCode: error.errorCode,
        });
      }
      // Handoff 18 §5a: escalation roots follow the same OMG mould, emitted
      // after error (XSD rootElement group), escalationCode omitted when absent.
      for (const escalation of diagram.definitions.escalations ?? []) {
        xml.element('bpmn:escalation', {
          id: escalation.id,
          name: escalation.name || undefined,
          escalationCode: escalation.escalationCode,
        });
      }
    }

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
        this.serializer.writeEdge(xml, flow, 'messageFlow');
      }
      xml.close();
    }

    xml.open('bpmn:process', { id: processId, name: diagram.name, isExecutable: 'false' });
    this.serializer.writeDiagramExtension(xml, diagram);

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
      this.serializer.writeNode(xml, node, diagram, edgesByScope, dataAssocsByActivity);
    }
    for (const edge of processEdges) {
      this.serializer.writeEdge(xml, edge, edge.type === 'association' ? 'association' : 'sequenceFlow');
    }
    xml.close(); // process

    this.di.writeDi(xml, diagram, pools.length > 0 ? collaborationId : processId);
    xml.close(); // definitions
    return xml.toString();
  }

  // ---------------------------------------------------------------- import

  fromXml(xmlText: string): ImportResult {
    const warnings: string[] = [];
    const root = this.adapter.parse(xmlText);
    if (localName(root.tag) !== 'definitions') {
      throw new BpmnParseError(`Expected <definitions> root element, got <${root.tag}>`);
    }
    const processEls = childrenByLocalName(root, 'process');
    const processEl = processEls[0];
    if (!processEl) {
      throw new BpmnParseError('No <process> element found in the BPMN document');
    }
    if (processEls.length > 1) {
      warnings.push(
        `Document has ${processEls.length} <process> elements — only the first ` +
          `(${processEl.attributes.id ?? 'unnamed'}) was imported; flow elements of the ` +
          'other processes were dropped (the v1 profile is single-process)',
      );
    }

    const extension = this.ext.readExtensionElements(processEl);
    const diagramMeta = extension.elements.find((e) => localName(e.tag) === 'diagram');
    const versionMeta = extension.elements.find((e) => localName(e.tag) === 'version');

    // Passthrough: foreign xmlns declarations of the root (any prefix outside
    // the five we own) survive the import so re-export stays namespace-valid.
    const OWN_PREFIXES = new Set(['bpmn', 'bpmndi', 'dc', 'di', this.ext.prefix]);
    const foreignNamespaces: Record<string, string> = {};
    for (const [name, value] of Object.entries(root.attributes)) {
      if (!name.startsWith('xmlns:')) continue;
      const prefix = name.slice('xmlns:'.length);
      if (!OWN_PREFIXES.has(prefix)) foreignNamespaces[prefix] = value;
    }

    const diagram: BpmnDiagram = {
      id: diagramMeta?.attributes.originalId ?? processEl.attributes.id ?? generateId(),
      name: processEl.attributes.name ?? 'Imported process',
      description: diagramMeta?.attributes.description ?? '',
      version: this.deserializer.readVersion(versionMeta),
      nodes: {},
      edges: {},
      metadata: extension.properties,
      ...(extension.foreign.length > 0 ? { processForeignExtensions: extension.foreign } : {}),
      ...(Object.keys(foreignNamespaces).length > 0 ? { foreignNamespaces } : {}),
    };

    // Named event definitions (§3a): OMG root elements → diagram.definitions.
    // `codeAttr` names the per-type code attribute (error → errorCode,
    // escalation → escalationCode, Handoff 18 §5a); message/signal have none.
    const readDefinitions = (tag: string, codeAttr?: 'errorCode' | 'escalationCode') =>
      childrenByLocalName(root, tag).map((el) => ({
        id: el.attributes.id ?? generateId(),
        name: el.attributes.name ?? el.attributes.id ?? '',
        ...(codeAttr && el.attributes[codeAttr] ? { [codeAttr]: el.attributes[codeAttr] } : {}),
      }));
    const messages = readDefinitions('message');
    const signals = readDefinitions('signal');
    const errors = readDefinitions('error', 'errorCode');
    const escalations = readDefinitions('escalation', 'escalationCode');
    if (
      messages.length > 0 ||
      signals.length > 0 ||
      errors.length > 0 ||
      escalations.length > 0
    ) {
      diagram.definitions = { messages, signals, errors, escalations };
    }

    // Pools and message flows live in a <collaboration> at the root.
    const collaboration = firstChildByLocalName(root, 'collaboration');
    if (collaboration) {
      for (const participant of childrenByLocalName(collaboration, 'participant')) {
        const pool = this.deserializer.readContainer(participant, 'pool');
        if (pool) diagram.nodes[pool.id] = pool;
      }
      for (const flowEl of childrenByLocalName(collaboration, 'messageFlow')) {
        const edge = this.deserializer.readEdge(flowEl, warnings, 'messageFlow');
        if (edge) diagram.edges[edge.id] = edge;
      }
    }

    this.deserializer.readFlowElements(processEl, undefined, diagram, warnings);

    // Validate edge references.
    for (const edge of Object.values(diagram.edges)) {
      if (!diagram.nodes[edge.sourceId] || !diagram.nodes[edge.targetId]) {
        warnings.push(`Edge ${edge.id} references a node not present in the document`);
      }
    }

    this.di.applyDi(root, diagram, warnings);

    // Handoff 11 N-1: regain the parametric boundary anchor (side + t) from
    // the DI geometry. The pair is editor-only state — it never travels in
    // the XML, so every import derives it back from the absolute coordinates.
    for (const node of Object.values(diagram.nodes)) {
      const hostId = boundaryAttachedTo(node);
      const host = hostId ? diagram.nodes[hostId] : undefined;
      if (!host) continue;
      const { side, t } = boundaryAnchorOf(host, node);
      node.properties = { ...node.properties, boundarySide: side, boundaryT: t };
    }

    // Orphan refs (§3a, E-0 decisão 2): a *Ref pointing at no root element is
    // SYNTHESIZED as a definition (id = name = ref) WITH an informative
    // warning naming the event — never silence, never data loss.
    for (const node of Object.values(diagram.nodes)) {
      const kind = node.properties.eventDefinition;
      const ref = node.properties.eventDefinitionRef;
      if (typeof ref !== 'string' || ref === '') continue;
      if (kind !== 'message' && kind !== 'signal' && kind !== 'error' && kind !== 'escalation')
        continue;
      const bucketKey =
        kind === 'message'
          ? 'messages'
          : kind === 'signal'
            ? 'signals'
            : kind === 'error'
              ? 'errors'
              : 'escalations';
      diagram.definitions ??= { messages: [], signals: [], errors: [], escalations: [] };
      const bucket = (diagram.definitions[bucketKey] ??= []);
      if (bucket.some((definition) => definition.id === ref)) continue;
      bucket.push({ id: ref, name: ref });
      warnings.push(
        `Referenced ${kind} "${ref}" has no <bpmn:${kind}> root element — a definition was ` +
          `synthesized (event "${node.label || node.id}")`,
      );
    }
    return { diagram, warnings };
  }
}

/** BPMN ids must be valid NCNames; fall back to a prefixed form when not. */
function xmlSafeId(id: string, prefix: string): string {
  return /^[A-Za-z_][\w.-]*$/.test(id) ? id : `${prefix}_${id.replace(/[^\w.-]/g, '_')}`;
}
