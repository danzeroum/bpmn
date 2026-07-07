import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDefaultRegistry, createDiagram, createNode } from '@bpmn-react/core';
import { BpmnViewer } from '@bpmn-react/react';
import { DOMAIN_NODE_TYPES, domainExamplePlugin } from '../src/index.js';

/**
 * Renders every one of the 6 domain-example shapes at least once (only
 * Squad/Persona were previously exercised), plus both states of the Gate
 * shape (pending vs. approved), so a shape refactor can't silently break
 * Prompt/Connector/Deliverable or the approval glyph without a test noticing.
 */
function registryWithDomain() {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);
  return registry;
}

interface Expectation {
  type: string;
  label: string;
  properties?: Record<string, unknown>;
  check: (root: Element) => void;
}

const EXPECTATIONS: Expectation[] = [
  {
    type: 'btv:squad',
    label: 'Content',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('circle')).toHaveLength(2); // two team-member heads
    },
  },
  {
    type: 'btv:persona',
    label: 'Writer',
    properties: { role: 'copywriting' },
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('circle')).toHaveLength(2); // avatar + head icon
      expect(root.textContent).toContain('copywriting');
    },
  },
  {
    type: 'btv:gate',
    label: 'Pending gate',
    properties: { approved: false },
    check: (root) => {
      expect(root.querySelectorAll('polygon')).toHaveLength(1);
      expect(root.textContent).toContain('✋');
      expect(root.textContent).not.toContain('✓');
    },
  },
  {
    type: 'btv:gate',
    label: 'Approved gate',
    properties: { approved: true },
    check: (root) => {
      expect(root.querySelectorAll('polygon')).toHaveLength(1);
      expect(root.textContent).toContain('✓');
      expect(root.textContent).not.toContain('✋');
    },
  },
  {
    type: 'btv:prompt',
    label: 'Draft',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(1);
      expect(root.querySelectorAll('line')).toHaveLength(2);
    },
  },
  {
    type: 'btv:connector',
    label: 'Publish',
    check: (root) => {
      const rect = root.querySelector('rect')!;
      expect(rect.getAttribute('stroke-dasharray')).toBe('6,3');
      expect(root.querySelectorAll('path').length).toBeGreaterThanOrEqual(3); // plug glyph
    },
  },
  {
    type: 'btv:deliverable',
    label: 'Post',
    check: (root) => {
      expect(root.querySelectorAll('rect')).toHaveLength(0);
      expect(root.querySelectorAll('path')).toHaveLength(1); // flag/banner outline
    },
  },
];

describe('domain-example shapes render correctly', () => {
  it.each(EXPECTATIONS)(
    'renders $type ($label) with its distinguishing glyph',
    ({ type, label, properties, check }) => {
      const registry = registryWithDomain();
      const diagram = createDiagram({ name: 'Shapes' });
      diagram.nodes = {
        n1: createNode({ type, id: 'n1', label, x: 20, y: 20, properties }, registry),
      };

      const { container } = render(<BpmnViewer diagram={diagram} plugins={[domainExamplePlugin]} />);
      const root = container.querySelector(`[data-node-type="${type}"]`)!;
      expect(root).toBeInTheDocument();
      check(root);
    },
  );

  it('covers exactly the 6 registered domain node types', () => {
    const uniqueTypes = [...new Set(EXPECTATIONS.map((e) => e.type))].sort();
    expect(uniqueTypes).toEqual(DOMAIN_NODE_TYPES.map((t) => t.type).sort());
  });
});
