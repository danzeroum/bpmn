import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  createDiagram,
  createNode,
  normalizeForDiff,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { BpmnDesigner, Palette, resolveEditorConfig } from '@bpmn-react/react';
import {
  clinicalDecisionLinkedRule,
  HC_DECISION_UNLINKED,
  HC_NODE_TYPES,
  healthcarePlugin,
} from '../src/index.js';

afterEach(cleanup);

/** Minimal clinical pathway: task → decision (unlinked) → gate + guideline. */
function pathwayDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of HC_NODE_TYPES) registry.register(def);
  const diagram = createDiagram({ name: 'Protocolo sepse', id: 'sepsis' });
  const make = (type: string, id: string, label: string, x: number, y: number, properties = {}) =>
    createNode({ type, id, label, x, y, properties }, registry);
  diagram.nodes = {
    triage: make('hc:clinicalTask', 'triage', 'Triagem', 40, 40),
    decide: make('hc:clinicalDecision', 'decide', 'Iniciar antibiótico?', 240, 40),
    linked: make('hc:clinicalDecision', 'linked', 'Escalonar dose?', 240, 160, {
      decisionRef: 'dmn-dose',
    }),
    protocol: make('hc:guideline', 'protocol', 'Protocolo 2026', 40, 160),
    gate: make('hc:pathwayGate', 'gate', 'Via crítica?', 460, 44),
  };
  return diagram;
}

describe('healthcarePlugin (Handoff 5 §6 — degrau 305°)', () => {
  it('claims the 305° step and renders the family palette group', () => {
    const { container, getByText } = render(
      <BpmnDesigner diagram={pathwayDiagram()} plugins={[healthcarePlugin]}>
        <Palette />
      </BpmnDesigner>,
    );
    expect(healthcarePlugin.colorWheelDegree).toBe(305);
    expect(getByText('HEALTHCARE')).not.toBeNull();
    expect(getByText('305°')).not.toBeNull();
    for (const label of ['Clinical Task', 'Clinical Decision', 'Guideline', 'Pathway Gate']) {
      expect(container.querySelector(`[aria-label="Add ${label}"]`)).not.toBeNull();
    }
  });

  it('warns on a wheel collision and never uses reserved gold/green as body color', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveEditorConfig([healthcarePlugin, { id: 'x', colorWheelDegree: 305 }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('color wheel collision'));
    warn.mockClear();
    resolveEditorConfig([healthcarePlugin, { id: 'dmn-ish', colorWheelDegree: 185 }]);
    expect(warn).not.toHaveBeenCalled(); // 305° × 185°: no collision, no reserve breach
    warn.mockRestore();
  });

  it('renders the plugin signature: gold chamfer + small-caps type tag', () => {
    const { container } = render(<BpmnDesigner diagram={pathwayDiagram()} plugins={[healthcarePlugin]} />);
    const task = container.querySelector('[data-node-id="triage"]')!;
    expect(task.querySelector('[data-shape-tag]')?.textContent).toBe('CLINICAL TASK');
    // Gold chamfer stroke on the card corner.
    expect(task.innerHTML).toContain('--btv-gold');
    // Clinical violet family tokens, never reserved colors as body.
    expect(task.innerHTML).toContain('--btv-hc-fill');
  });
});

describe('validação visível (§6 — decisão clínica sem DMN)', () => {
  it('shows the amber ▲ chip in the badge slot ONLY while unlinked', () => {
    const { container } = render(<BpmnDesigner diagram={pathwayDiagram()} plugins={[healthcarePlugin]} />);
    const unlinked = container.querySelector('[data-node-id="decide"]')!;
    const warning = unlinked.querySelector('[data-hc-warning]')!;
    expect(warning).not.toBeNull();
    expect(warning.querySelector('title')?.textContent).toBe('sem tabela DMN vinculada');
    expect(unlinked.querySelector('[data-decision-link]')).toBeNull();

    // Linked decision: gold DMN badge in the same slot, no warning chip.
    const linked = container.querySelector('[data-node-id="linked"]')!;
    expect(linked.querySelector('[data-hc-warning]')).toBeNull();
    expect(linked.querySelector('[data-decision-link]')).not.toBeNull();
    expect(linked.querySelector('[data-decision-link] title')?.textContent).toBe(
      'Decisão vinculada: dmn-dose',
    );
  });

  it('surfaces HC_DECISION_UNLINKED as a warning through the validation rule', () => {
    const issues = clinicalDecisionLinkedRule(pathwayDiagram());
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: HC_DECISION_UNLINKED,
      severity: 'warning',
      nodeId: 'decide',
    });
    // Closed decisions stay out of the report.
    const diagram = pathwayDiagram();
    diagram.nodes.decide = { ...diagram.nodes.decide, removedInVersion: diagram.version.id };
    expect(clinicalDecisionLinkedRule(diagram)).toHaveLength(0);
  });

  it('the amber chip and the link badge occupy the same slot geometry', () => {
    const { container } = render(<BpmnDesigner diagram={pathwayDiagram()} plugins={[healthcarePlugin]} />);
    const warning = container.querySelector('[data-node-id="decide"] [data-hc-warning]')!;
    const badge = container.querySelector('[data-node-id="linked"] [data-decision-link]')!;
    expect(warning.getAttribute('transform')).toBe(badge.getAttribute('transform'));
  });
});

describe('export interoperável (§6 — bpmnr:meta type)', () => {
  it('maps every clinical type to a standard BPMN tag and round-trips losslessly', () => {
    const config = resolveEditorConfig([healthcarePlugin]);
    const converter = new BpmnXmlConverter({
      registry: config.registry,
      preferredTypes: config.preferredTypes,
    });
    const diagram = pathwayDiagram();
    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:userTask');
    expect(xml).toContain('<bpmn:businessRuleTask');
    expect(xml).toContain('<bpmn:dataObjectReference');
    expect(xml).toContain('<bpmn:exclusiveGateway');
    expect(xml).toContain('hc:clinicalTask'); // identity preserved in bpmnr:meta

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.nodes.triage.type).toBe('hc:clinicalTask');
    expect(imported.nodes.decide.type).toBe('hc:clinicalDecision');
    expect(imported.nodes.protocol.type).toBe('hc:guideline');
    expect(imported.nodes.gate.type).toBe('hc:pathwayGate');
    expect(normalizeForDiff(imported)).toEqual(normalizeForDiff(diagram));
    // Byte-stable re-export.
    expect(converter.toXml(imported)).toBe(xml);
  });

  it('a plain-BPMN consumer (no plugin) still reads the standard elements', () => {
    const config = resolveEditorConfig([healthcarePlugin]);
    const converter = new BpmnXmlConverter({
      registry: config.registry,
      preferredTypes: config.preferredTypes,
    });
    const xml = converter.toXml(pathwayDiagram());
    const vanilla = new BpmnXmlConverter();
    const { diagram: imported } = vanilla.fromXml(xml);
    expect(imported.nodes.triage.type).toBe('userTask');
    expect(imported.nodes.decide.type).toBe('businessRuleTask');
    expect(imported.nodes.gate.type).toBe('exclusiveGateway');
  });

  it('palette icons render for all four clinical types', () => {
    const { container } = render(
      <BpmnDesigner diagram={pathwayDiagram()} plugins={[healthcarePlugin]}>
        <Palette />
      </BpmnDesigner>,
    );
    const group = [...container.querySelectorAll('[data-palette-group="healthcare"] svg')];
    expect(group.length).toBeGreaterThanOrEqual(4);
  });

  it('fireEvent smoke: adding a clinical task from the palette goes through the stack', () => {
    const { container } = render(
      <BpmnDesigner diagram={pathwayDiagram()} plugins={[healthcarePlugin]}>
        <Palette />
      </BpmnDesigner>,
    );
    const before = container.querySelectorAll('[data-node-id]').length;
    fireEvent.click(container.querySelector('[aria-label="Add Clinical Task"]')!);
    expect(container.querySelectorAll('[data-node-id]').length).toBe(before + 1);
  });
});
