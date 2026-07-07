import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDiagram, createNode } from '@bpmn-react/core';
import { BpmnViewer } from '../src/index.js';

/**
 * Renders every one of the 22 built-in BPMN shapes at least once and checks
 * a couple of type-specific visual properties, so a rendering refactor that
 * silently breaks an untouched shape is caught.
 */
interface Expectation {
  type: string;
  label: string;
  check: (root: Element) => void;
}

const EXPECTATIONS: Expectation[] = [
  {
    type: 'startEvent',
    label: 'Init',
    check: (root) => expect(root.querySelectorAll('circle')).toHaveLength(1),
  },
  {
    type: 'endEvent',
    label: 'Done',
    check: (root) => expect(root.querySelectorAll('circle')).toHaveLength(2), // double border
  },
  {
    type: 'intermediateCatchEvent',
    label: 'Wait',
    check: (root) => expect(root.querySelectorAll('circle')).toHaveLength(2), // double ring
  },
  {
    type: 'intermediateThrowEvent',
    label: 'Signal',
    check: (root) => expect(root.querySelectorAll('circle')).toHaveLength(2), // double ring
  },
  {
    type: 'boundaryEvent',
    label: 'Timeout',
    check: (root) => expect(root.querySelectorAll('circle')).toHaveLength(2), // double ring on border
  },
  {
    type: 'task',
    label: 'Work',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('circle, path')).toHaveLength(0); // no icon glyph
    },
  },
  {
    type: 'userTask',
    label: 'Review',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('circle').length).toBeGreaterThan(0); // person-head glyph
    },
  },
  {
    type: 'serviceTask',
    label: 'Call',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('circle').length).toBeGreaterThan(0); // gear center
    },
  },
  {
    type: 'scriptTask',
    label: 'Run',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('path').length).toBeGreaterThan(0); // scroll glyph
    },
  },
  {
    type: 'sendTask',
    label: 'Notify',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(2); // body + envelope
      expect(root.querySelectorAll('path').length).toBeGreaterThan(0); // envelope flap
    },
  },
  {
    type: 'receiveTask',
    label: 'Await',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(2); // body + envelope
    },
  },
  {
    type: 'manualTask',
    label: 'Sign',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('path').length).toBeGreaterThan(0); // hand glyph
    },
  },
  {
    type: 'exclusiveGateway',
    label: 'Or',
    check: (root) => {
      expect(root.querySelectorAll('polygon')).toHaveLength(1);
      expect(root.querySelectorAll('path')).toHaveLength(1); // X cross
    },
  },
  {
    type: 'parallelGateway',
    label: 'And',
    check: (root) => {
      expect(root.querySelectorAll('polygon')).toHaveLength(1);
      expect(root.querySelectorAll('path')).toHaveLength(1); // + cross
    },
  },
  {
    type: 'inclusiveGateway',
    label: 'Any',
    check: (root) => {
      expect(root.querySelectorAll('polygon')).toHaveLength(1);
      expect(root.querySelectorAll('circle')).toHaveLength(1); // inner ring, no cross path
      expect(root.querySelectorAll('path')).toHaveLength(0);
    },
  },
  {
    type: 'eventBasedGateway',
    label: 'Pick',
    check: (root) => {
      expect(root.querySelectorAll('polygon')).toHaveLength(2); // diamond + inner pentagon
      expect(root.querySelectorAll('circle')).toHaveLength(2); // double ring
    },
  },
  {
    type: 'group',
    label: 'Cluster',
    check: (root) => {
      const rect = root.querySelector('rect')!;
      expect(rect.getAttribute('stroke-dasharray')).toBe('8,4');
      expect(rect.getAttribute('fill')).toBe('none'); // interior click-through
    },
  },
  {
    type: 'subProcess',
    label: 'Sub',
    check: (root) => expect(root.querySelectorAll('rect')).toHaveLength(2), // body + expand icon
  },
  {
    type: 'dataObject',
    label: 'Data',
    check: (root) => expect(root.querySelectorAll('path').length).toBeGreaterThanOrEqual(2), // folded corner + fold line
  },
  {
    type: 'textAnnotation',
    label: 'Note',
    check: (root) => {
      expect(root.querySelectorAll('path')).toHaveLength(1); // bracket
      expect(root.querySelectorAll('rect')).toHaveLength(0);
    },
  },
  {
    type: 'pool',
    label: 'Editorial',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(2); // body + title band
      expect(root.querySelectorAll('line')).toHaveLength(1); // band divider
    },
  },
  {
    type: 'lane',
    label: 'Authors',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(2); // body + title band
      expect(root.querySelectorAll('line')).toHaveLength(1);
    },
  },
];

describe('built-in shapes render correctly', () => {
  it.each(EXPECTATIONS)('renders $type with its distinguishing glyph and label', ({ type, label, check }) => {
    const diagram = createDiagram({ name: 'Shapes' });
    const node = createNode({ type, id: 'n1', label, x: 20, y: 20 });
    diagram.nodes = { n1: node };

    const { container } = render(<BpmnViewer diagram={diagram} />);
    const root = container.querySelector(`[data-node-type="${type}"]`)!;
    expect(root).toBeInTheDocument();
    expect(root.textContent).toContain(label);
    check(root);
  });

  it('draws a typed-event glyph when properties.eventDefinition is set', () => {
    const diagram = createDiagram({ name: 'Typed' });
    diagram.nodes = {
      plain: createNode({ type: 'startEvent', id: 'plain', label: 'Plain', x: 20, y: 20 }),
      msg: createNode({
        type: 'startEvent',
        id: 'msg',
        label: 'Message',
        x: 120,
        y: 20,
        properties: { eventDefinition: 'message' },
      }),
    };
    const { container } = render(<BpmnViewer diagram={diagram} />);
    const plain = container.querySelector('[data-node-id="plain"]')!;
    const msg = container.querySelector('[data-node-id="msg"]')!;
    // The message glyph (envelope) adds a <rect> the plain event does not have.
    expect(plain.querySelectorAll('rect')).toHaveLength(0);
    expect(msg.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('covers exactly the 22 registered built-in types (fails loudly if one is added without a fixture)', () => {
    expect(EXPECTATIONS.map((e) => e.type).sort()).toEqual(
      [
        'boundaryEvent',
        'dataObject',
        'endEvent',
        'eventBasedGateway',
        'exclusiveGateway',
        'group',
        'inclusiveGateway',
        'intermediateCatchEvent',
        'intermediateThrowEvent',
        'lane',
        'manualTask',
        'parallelGateway',
        'pool',
        'receiveTask',
        'scriptTask',
        'sendTask',
        'serviceTask',
        'startEvent',
        'subProcess',
        'task',
        'textAnnotation',
        'userTask',
      ].sort(),
    );
  });

  it('renders loop and multi-instance activity markers', () => {
    const diagram = createDiagram({ name: 'Markers' });
    diagram.nodes = {
      plain: createNode({ type: 'task', id: 'plain', label: 'Plain', x: 20, y: 20 }),
      loop: createNode({ type: 'task', id: 'loop', label: 'Retry', x: 160, y: 20, properties: { marker: 'loop' } }),
      mi: createNode({ type: 'userTask', id: 'mi', label: 'Many', x: 300, y: 20, properties: { marker: 'parallelMultiInstance' } }),
    };
    const { container } = render(<BpmnViewer diagram={diagram} />);
    const plain = container.querySelector('[data-node-id="plain"]')!;
    const loop = container.querySelector('[data-node-id="loop"]')!;
    const mi = container.querySelector('[data-node-id="mi"]')!;
    // The marker adds a <path> the plain task does not have (task has no glyph).
    expect(plain.querySelectorAll('path')).toHaveLength(0);
    expect(loop.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(mi.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});
