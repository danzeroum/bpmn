import { describe, expect, it } from 'vitest';
import { promptCoverage, promptVariables } from '../src/index.js';

describe('promptVariables (Squad Lane SL-5)', () => {
  it('extracts distinct bare {{name}} variables in first-seen order', () => {
    expect(promptVariables('Answer {{query}} using {{locale}}, then {{query}} again.')).toEqual([
      'query',
      'locale',
    ]);
  });

  it('ignores the simulate tool-param form {{node.output.path}} (never a prompt var)', () => {
    expect(promptVariables('use {{llm-1.output.query}} here')).toEqual([]);
    expect(promptVariables('{{ spaced }} and {{tight}}')).toEqual(['spaced', 'tight']);
  });
});

describe('promptCoverage (Squad Lane SL-5)', () => {
  it('is clean when every input variable is referenced', () => {
    expect(promptCoverage(['query', 'locale'], 'Search {{query}} in {{locale}}.')).toEqual([]);
  });

  it('emits a PROMPT_VAR_UNUSED warning (never an error) per unused input variable', () => {
    const issues = promptCoverage(['query', 'locale'], 'Search {{query}}.');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('PROMPT_VAR_UNUSED');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/locale/);
    expect(issues[0].remediation).toMatch(/\{\{locale\}\}/);
  });

  it('is deterministic — issue order follows inputVars', () => {
    const issues = promptCoverage(['a', 'b', 'c'], 'nothing here');
    expect(issues.map((i) => i.message.match(/"(\w)"/)?.[1])).toEqual(['a', 'b', 'c']);
  });
});
