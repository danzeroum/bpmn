import { describe, expect, it } from 'vitest';
import {
  APPROVAL_GATE_AGENT,
  DEFAULT_TEMPLATE_ID,
  isValid,
  TEMPLATES,
  validateGraph,
} from '../src/index.js';

describe('starter templates (§6)', () => {
  it('ships exactly three templates', () => {
    expect(TEMPLATES).toHaveLength(3);
    expect(TEMPLATES.map((t) => t.name)).toEqual([
      'Approval Gate Agent',
      'Research Agent',
      'Document Review Agent',
    ]);
  });

  it('the ★ default is the Approval Gate Agent, first in palette order', () => {
    expect(DEFAULT_TEMPLATE_ID).toBe(APPROVAL_GATE_AGENT.id);
    expect(TEMPLATES[0]).toBe(APPROVAL_GATE_AGENT);
  });

  it('every template validates with zero errors and zero warnings', () => {
    for (const template of TEMPLATES) {
      const issues = validateGraph(template);
      expect(issues, `${template.name} should be clean`).toEqual([]);
      expect(isValid(template)).toBe(true);
    }
  });

  it('every template uses full id@semver promptRefs (no abbreviated storage)', () => {
    for (const template of TEMPLATES) {
      for (const node of template.nodes) {
        if (node.type === 'llm') {
          expect(node.config.promptRef, `${template.name}/${node.id}`).toMatch(/@\d+\.\d+\.\d+$/);
        }
      }
    }
  });
});
