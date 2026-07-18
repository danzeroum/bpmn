import type {
  BpmnDiagram,
  BpmnNode,
  ErrorEventDefinition,
  EscalationEventDefinition,
  EventDefinitions,
  NamedEventDefinition,
} from './types.js';
import { activeNodes, isEventSubprocess, nodeParentId } from './types.js';

/**
 * Named event definitions — headless helpers (Handoff 16 §3a, E-1).
 * The referenceable kinds map 1:1 to the OMG root elements
 * (`bpmn:message`/`bpmn:signal`/`bpmn:error`/`bpmn:escalation`) and to the
 * event KINDS the nodes already carry in `properties.eventDefinition`.
 * Handoff 18 §5a adds `escalation` as the 4th kind through this SAME single
 * source (zero fork) — buckets, id prefix, picker and refs follow by
 * construction.
 */
export const EVENT_DEFINITION_REF_KINDS = ['message', 'signal', 'error', 'escalation'] as const;
export type EventDefinitionRefKind = (typeof EVENT_DEFINITION_REF_KINDS)[number];

/** Bucket key of a kind inside {@link EventDefinitions}. */
export const EVENT_DEFINITION_BUCKETS = {
  message: 'messages',
  signal: 'signals',
  error: 'errors',
  escalation: 'escalations',
} as const satisfies Record<EventDefinitionRefKind, keyof EventDefinitions>;

/** Id prefix per kind — the «+» auto-id convention (Axelor-validated). */
const ID_PREFIX: Record<EventDefinitionRefKind, string> = {
  message: 'msg',
  signal: 'sig',
  error: 'err',
  escalation: 'esc',
};

/** Empty, frozen-shape buckets — the starting point when `definitions` is absent. */
export function emptyEventDefinitions(): EventDefinitions {
  return { messages: [], signals: [], errors: [], escalations: [] };
}

/**
 * The definitions bag of a diagram, tolerant of the absent field AND of the
 * additive `escalations` bucket being absent from an older literal — every
 * bucket is filled so callers treat all four as always-present (Handoff 18).
 */
export function eventDefinitionsOf(diagram: BpmnDiagram): Required<EventDefinitions> {
  const defs = diagram.definitions;
  if (!defs) return emptyEventDefinitions() as Required<EventDefinitions>;
  return { ...defs, escalations: defs.escalations ?? [] };
}

/** Definition list of one kind (empty array when absent). */
export function eventDefinitionList(
  diagram: BpmnDiagram,
  kind: EventDefinitionRefKind,
): readonly (NamedEventDefinition | ErrorEventDefinition | EscalationEventDefinition)[] {
  return eventDefinitionsOf(diagram)[EVENT_DEFINITION_BUCKETS[kind]];
}

/** Lookup by id inside a kind's bucket. */
export function findEventDefinition(
  diagram: BpmnDiagram,
  kind: EventDefinitionRefKind,
  id: string,
): NamedEventDefinition | ErrorEventDefinition | EscalationEventDefinition | undefined {
  return eventDefinitionList(diagram, kind).find((definition) => definition.id === id);
}

/**
 * Next collision-safe auto id for the «+» flow: `msg-1`, `msg-2`, … scanning
 * the existing bucket (imported ids of any shape never collide — the counter
 * skips taken ids).
 */
export function nextEventDefinitionId(diagram: BpmnDiagram, kind: EventDefinitionRefKind): string {
  const taken = new Set(eventDefinitionList(diagram, kind).map((definition) => definition.id));
  let counter = 1;
  while (taken.has(`${ID_PREFIX[kind]}-${counter}`)) counter++;
  return `${ID_PREFIX[kind]}-${counter}`;
}

/** The named-definition reference of an event node, when present. */
export function eventDefinitionRefOf(node: BpmnNode): string | undefined {
  const ref = node.properties.eventDefinitionRef;
  return typeof ref === 'string' && ref !== '' ? ref : undefined;
}

/**
 * Every ACTIVE node referencing the definition (id + label, for honest veto
 * messages): the kind must match the bucket, so an id reused across kinds
 * never cross-matches.
 */
export function eventDefinitionUsages(
  diagram: BpmnDiagram,
  kind: EventDefinitionRefKind,
  id: string,
): Array<{ nodeId: string; label: string }> {
  return Object.values(diagram.nodes)
    .filter(
      (node) =>
        !node.removedInVersion &&
        node.properties.eventDefinition === kind &&
        eventDefinitionRefOf(node) === id,
    )
    .map((node) => ({ nodeId: node.id, label: node.label || node.id }));
}

/**
 * An escalation catch reachable in the diagram: a boundary event OR an event
 * subprocess start carrying the escalation kind, tagged with how it matches a
 * given throw ref (Handoff 18 §5d/§5e).
 */
export interface EscalationCatch {
  node: BpmnNode;
  /** Where the catch lives — the two OMG-legal escalation catch hosts. */
  catchKind: 'boundary' | 'esubStart';
  /** `exact` = same escalationRef as the throw; `catchAll` = the catch has no ref. */
  matchType: 'exact' | 'catchAll';
}

/**
 * SHARED SOURCE (Handoff 18) — the diagram-wide ENUMERATION of escalation
 * catches eligible for a throw with ref `throwRef`. This is enumeration ONLY:
 * NO scope, NO tier/precedence ordering. The lint (`ESC_NO_CATCH`, EC-4) reads
 * it as "is there any eligible catch?"; the simulator (`throwEscalation`, EC-5)
 * builds the scoped, tiered RESOLUTION ON TOP of this same list — consuming the
 * structured `{node, catchKind, matchType}` tuples WITHOUT re-deriving them, so
 * lint and simulation never fork the catch topology.
 *
 * Matching (OMG): a catch with NO ref is a catch-all (matches any throw); a
 * catch with a ref matches only a throw with the SAME ref. A kind-puro throw
 * (`throwRef === undefined`) is caught only by catch-all catches.
 */
export function eligibleEscalationCatches(
  diagram: BpmnDiagram,
  throwRef?: string,
): EscalationCatch[] {
  const catches: EscalationCatch[] = [];
  for (const node of activeNodes(diagram)) {
    if (node.properties.eventDefinition !== 'escalation') continue;
    let catchKind: EscalationCatch['catchKind'] | undefined;
    if (node.type === 'boundaryEvent') {
      catchKind = 'boundary';
    } else if (node.type === 'startEvent') {
      const parentId = nodeParentId(node);
      const parent = parentId ? diagram.nodes[parentId] : undefined;
      if (parent !== undefined && isEventSubprocess(parent)) catchKind = 'esubStart';
    }
    if (catchKind === undefined) continue;
    const catchRef = eventDefinitionRefOf(node);
    if (catchRef === undefined) {
      catches.push({ node, catchKind, matchType: 'catchAll' });
    } else if (throwRef !== undefined && catchRef === throwRef) {
      catches.push({ node, catchKind, matchType: 'exact' });
    }
  }
  return catches;
}
