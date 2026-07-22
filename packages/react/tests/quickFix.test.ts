import { describe, expect, it } from 'vitest';
import { RESEARCH_AGENT, type AgentWorkflow, type ValidationIssue } from '@buildtovalue/agentflow';
import { hasQuickFix, quickFixFor, SAFE_QUICK_FIX_CODES } from '../src/agent/quickFix.js';

const issue = (code: string, nodeId?: string): ValidationIssue => ({
  code,
  severity: 'error',
  message: '',
  nodeId,
});

describe('quickFix (Squad Lane SL-6)', () => {
  it('offers a fix only for safe, non-I/O codes', () => {
    expect(SAFE_QUICK_FIX_CODES).toEqual(['RETRY_WITHOUT_MAX', 'LLM_NOT_STRUCTURED']);
    expect(hasQuickFix('RETRY_WITHOUT_MAX')).toBe(true);
    expect(hasQuickFix('LLM_NOT_STRUCTURED')).toBe(true);
    for (const code of [
      'TOOL_EFFECT_UNGATED',
      'TOOL_PARAMS_MISMATCH',
      'DELEGATE_CONTRACT_MISMATCH',
      'EMPTY_INPUT_SCHEMA',
      'EMPTY_OUTPUT_SCHEMA',
    ]) {
      expect(hasQuickFix(code)).toBe(false);
    }
  });

  it('RETRY_WITHOUT_MAX → bounds the looping route, never touching the I/O schema', () => {
    const wf = structuredClone(RESEARCH_AGENT) as AgentWorkflow;
    const dec = wf.nodes.find((n) => n.id === 'dec-3')!;
    if (dec.type === 'decision') delete dec.config.onFalse.maxRetries;
    const result = quickFixFor(issue('RETRY_WITHOUT_MAX', 'dec-3'), wf);
    expect(result).not.toBeNull();
    const fixed = result!.workflow.nodes.find((n) => n.id === 'dec-3')!;
    expect(fixed.type === 'decision' && fixed.config.onFalse.maxRetries).toBe(3);
    expect(result!.workflow.inputSchema).toEqual(wf.inputSchema);
    expect(result!.workflow.outputSchema).toEqual(wf.outputSchema);
  });

  it('LLM_NOT_STRUCTURED → sets structuredOutput (config only)', () => {
    const result = quickFixFor(issue('LLM_NOT_STRUCTURED', 'llm-1'), RESEARCH_AGENT);
    const node = result!.workflow.nodes.find((n) => n.id === 'llm-1')!;
    expect(node.type === 'llm' && node.config.structuredOutput).toBe(true);
  });

  it('returns null for a code with no safe fix, or an unknown node', () => {
    expect(quickFixFor(issue('TOOL_EFFECT_UNGATED', 'tool-2'), RESEARCH_AGENT)).toBeNull();
    expect(quickFixFor(issue('RETRY_WITHOUT_MAX', 'ghost'), RESEARCH_AGENT)).toBeNull();
    expect(quickFixFor(issue('EMPTY_INPUT_SCHEMA'), RESEARCH_AGENT)).toBeNull();
  });
});
