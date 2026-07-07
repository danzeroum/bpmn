import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  ValidationEngine,
  BUILT_IN_VALIDATION_RULES,
  BpmnXmlConverter,
  RuleEngine,
} from '@bpmn-react/core';
import { BpmnDesigner, resolveEditorConfig } from '@bpmn-react/react';
import {
  domainExamplePlugin,
  DOMAIN_NODE_TYPES,
  gateSinglePredecessorRule,
  squadNeedsPersonaRule,
  handoffNeedsPurposeRule,
} from '../src/index.js';

function registryWithDomain() {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);
  return registry;
}

describe('domain validation rules', () => {
  it('flags gates with multiple predecessors', () => {
    const registry = registryWithDomain();
    const diagram = createDiagram({ name: 'D' });
    const gate = createNode({ type: 'btv:gate', id: 'gate' }, registry);
    const a = createNode({ type: 'btv:persona', id: 'a' }, registry);
    const b = createNode({ type: 'btv:persona', id: 'b' }, registry);
    diagram.nodes = { gate, a, b };
    diagram.edges = {
      e1: createEdge({ id: 'e1', sourceId: 'a', targetId: 'gate' }),
      e2: createEdge({ id: 'e2', sourceId: 'b', targetId: 'gate' }),
    };
    const issues = gateSinglePredecessorRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('GATE_MULTIPLE_PREDECESSORS');
  });

  it('requires squads to have a persona', () => {
    const registry = registryWithDomain();
    const diagram = createDiagram({ name: 'D' });
    diagram.nodes = { squad: createNode({ type: 'btv:squad', id: 'squad' }, registry) };
    expect(squadNeedsPersonaRule(diagram)[0]?.code).toBe('SQUAD_WITHOUT_PERSONA');

    const persona = createNode({ type: 'btv:persona', id: 'p' }, registry);
    diagram.nodes.p = persona;
    diagram.edges = { e: createEdge({ id: 'e', sourceId: 'squad', targetId: 'p' }) };
    expect(squadNeedsPersonaRule(diagram)).toHaveLength(0);
  });

  it('warns about handoffs without purpose', () => {
    const diagram = createDiagram({ name: 'D' });
    diagram.edges = {
      h1: createEdge({ id: 'h1', sourceId: 'a', targetId: 'b', type: 'handoff' }),
      h2: createEdge({ id: 'h2', sourceId: 'a', targetId: 'b', type: 'handoff', purpose: 'review' }),
    };
    const issues = handoffNeedsPurposeRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0].edgeId).toBe('h1');
  });

  it('composes with the built-in ValidationEngine', () => {
    const engine = new ValidationEngine([
      ...BUILT_IN_VALIDATION_RULES,
      ...domainExamplePlugin.validationRules!,
    ]);
    const registry = registryWithDomain();
    const diagram = createDiagram({ name: 'D' });
    diagram.nodes = { squad: createNode({ type: 'btv:squad', id: 'squad' }, registry) };
    const result = engine.validate(diagram);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'SQUAD_WITHOUT_PERSONA')).toBe(true);
  });
});

describe('governance rules', () => {
  it('blocks connections into approved gates', () => {
    const engine = new RuleEngine();
    domainExamplePlugin.registerRules!(engine);
    const registry = registryWithDomain();
    const diagram = createDiagram({ name: 'D' });
    const gate = createNode(
      { type: 'btv:gate', id: 'gate', properties: { approved: true } },
      registry,
    );
    diagram.nodes = { gate };
    const verdict = engine.evaluate(
      'edge.connect.pre',
      { sourceId: 'x', targetId: 'gate' },
      diagram,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/supersede/);
  });
});

describe('rendering and XML round-trip', () => {
  it('renders domain shapes inside the designer', () => {
    const registry = registryWithDomain();
    const diagram = createDiagram({ name: 'D' });
    diagram.nodes = {
      squad: createNode({ type: 'btv:squad', id: 'squad', label: 'Content Squad', x: 0, y: 0 }, registry),
      persona: createNode({ type: 'btv:persona', id: 'persona', label: 'Writer', x: 220, y: 20 }, registry),
    };
    const { container } = render(
      <BpmnDesigner diagram={diagram} plugins={[domainExamplePlugin]} />,
    );
    expect(container.querySelector('[data-node-type="btv:squad"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="btv:persona"]')).toBeInTheDocument();
  });

  it('round-trips domain types through BPMN XML with interoperable tags', () => {
    const config = resolveEditorConfig([domainExamplePlugin]);
    const converter = new BpmnXmlConverter({
      registry: config.registry,
      preferredTypes: config.preferredTypes,
    });
    const diagram = createDiagram({ name: 'D', id: 'd1' });
    diagram.nodes = {
      squad: createNode({ type: 'btv:squad', id: 'squad', x: 10, y: 10 }, config.registry),
      gate: createNode({ type: 'btv:gate', id: 'gate', x: 300, y: 20, properties: { approved: false } }, config.registry),
    };
    diagram.edges = {
      h1: createEdge({ id: 'h1', sourceId: 'squad', targetId: 'gate', type: 'handoff', purpose: 'submit for approval' }),
    };

    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:subProcess id="squad"');
    expect(xml).toContain('<bpmn:inclusiveGateway id="gate"');

    const { diagram: imported } = converter.fromXml(xml);
    expect(imported.nodes.squad.type).toBe('btv:squad');
    expect(imported.nodes.gate.type).toBe('btv:gate');
    expect(imported.edges.h1.type).toBe('handoff');
    expect(imported.edges.h1.purpose).toBe('submit for approval');
  });
});
