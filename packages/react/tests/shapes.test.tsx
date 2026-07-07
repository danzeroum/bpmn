import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDiagram, createNode } from '@bpmn-react/core';
import { BpmnViewer } from '../src/index.js';

/**
 * Renders every one of the 12 built-in BPMN shapes at least once and checks
 * a couple of type-specific visual properties, so a rendering refactor that
 * silently breaks an untouched shape (previously: 8 of 12 were never
 * rendered by any test) is caught.
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

  it('covers exactly the 12 registered built-in types (fails loudly if one is added without a fixture)', () => {
    expect(EXPECTATIONS.map((e) => e.type).sort()).toEqual(
      [
        'dataObject',
        'endEvent',
        'exclusiveGateway',
        'inclusiveGateway',
        'parallelGateway',
        'scriptTask',
        'serviceTask',
        'startEvent',
        'subProcess',
        'task',
        'textAnnotation',
        'userTask',
      ].sort(),
    );
  });
});
