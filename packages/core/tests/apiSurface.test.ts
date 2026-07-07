import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the *runtime* public API surface of
 * @bpmn-react/core (classes, functions, consts — type-only exports are
 * erased at compile time and never appear here, so type-level breaks are
 * caught separately by `tsc` in consuming packages).
 *
 * A failing diff here means an export was added, renamed, or removed.
 * Adding an export just requires updating EXPECTED_EXPORTS. Renaming or
 * removing one is a breaking change — bump the major/minor version
 * accordingly (see docs/versioning.md) before updating this fixture.
 */
const EXPECTED_EXPORTS = [
  'AuditLedger',
  'BPMNDI_NS',
  'BPMN_NS',
  'BUILT_IN_EDGE_TYPES',
  'BUILT_IN_NODE_TYPES',
  'BUILT_IN_VALIDATION_RULES',
  'BpmnAuditError',
  'BpmnError',
  'BpmnLifecycleError',
  'BpmnParseError',
  'BpmnRuleError',
  'BpmnValidationError',
  'BpmnXmlConverter',
  'CommandStack',
  'DC_NS',
  'DEFAULT_EXTENSION_NS',
  'DEFAULT_TRANSITIONS',
  'DI_NS',
  'DomXmlAdapter',
  'EventBus',
  'JsonSerializer',
  'LifecycleEngine',
  'MiniXmlAdapter',
  'MiniXmlParser',
  'NodeTypeRegistry',
  'RuleEngine',
  'ValidationEngine',
  'XmlBuilder',
  'activeEdges',
  'activeNodes',
  'addEdgeCommand',
  'addNodeCommand',
  'bumpSemver',
  'canonicalJson',
  'childrenByLocalName',
  'clamp',
  'collapseWaypoints',
  'compositeCommand',
  'computeDiagramHash',
  'computeDiff',
  'createDefaultRegistry',
  'createDefaultRuleEngine',
  'createDiagram',
  'createEdge',
  'createNode',
  'createSnapshot',
  'createVersion',
  'cubicBezierConnection',
  'cubicBezierPoint',
  'distance',
  'escapeXmlAttribute',
  'escapeXmlText',
  'eventFlowDirectionRule',
  'findByLocalName',
  'firstChildByLocalName',
  'generateId',
  'getAnchorPoint',
  'getAnchorSide',
  'getBoundingBox',
  'getDefaultXmlAdapter',
  'getEdgeChain',
  'isEmptyDiff',
  'localName',
  'missingStartEventRule',
  'moveNodeCommand',
  'normalizeForDiff',
  'nowIso',
  'orphanEdgeRule',
  'orthogonalConnection',
  'rectCenter',
  'rectContains',
  'rectsIntersect',
  'registerDefaultRules',
  'removeEdgeCommand',
  'removeNodeCommand',
  'resizeNodeCommand',
  'roundCoord',
  'routeOrthogonal',
  'selfConnectionRule',
  'sha256Hex',
  'snapToGrid',
  'supersedeEdgeCommand',
  'unknownTypeRule',
  'unreachableNodeRule',
  'updateEdgeCommand',
  'updateNodeCommand',
  'verifySnapshot',
  'waypointsToPath',
].sort();

describe('@bpmn-react/core public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined (catches a barrel re-export of a missing name)', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
