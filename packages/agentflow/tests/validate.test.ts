import { describe, expect, it } from 'vitest';
import {
  type AgentWorkflow,
  isValid,
  RESEARCH_AGENT,
  validateGraph,
} from '../src/index.js';

/** A helper that clones the valid Research Agent and lets a test mutate it. */
function fromResearch(mutate: (wf: AgentWorkflow) => void): AgentWorkflow {
  const wf: AgentWorkflow = structuredClone(RESEARCH_AGENT);
  mutate(wf);
  return wf;
}

const codes = (wf: AgentWorkflow, opts?: Parameters<typeof validateGraph>[1]) =>
  validateGraph(wf, opts).map((i) => i.code);
const errorCodes = (wf: AgentWorkflow, opts?: Parameters<typeof validateGraph>[1]) =>
  validateGraph(wf, opts)
    .filter((i) => i.severity === 'error')
    .map((i) => i.code);

describe('validateGraph — §3 rules', () => {
  it('a well-formed workflow has no errors', () => {
    expect(errorCodes(RESEARCH_AGENT)).toEqual([]);
    expect(isValid(RESEARCH_AGENT)).toBe(true);
  });

  it('rule 1: RETRY_WITHOUT_MAX when a loop-back route lacks maxRetries', () => {
    const wf = fromResearch((w) => {
      const dec = w.nodes.find((n) => n.id === 'dec-3')!;
      if (dec.type === 'decision') delete dec.config.onFalse.maxRetries;
    });
    const found = validateGraph(wf).find((i) => i.code === 'RETRY_WITHOUT_MAX');
    expect(found?.severity).toBe('error');
    expect(found?.remediation).toMatch(/maxRetries/);
  });

  it('rule 2: CYCLE_WITHOUT_STOP when a cycle carries no stopping decision', () => {
    const wf: AgentWorkflow = {
      kind: 'AgentWorkflow',
      id: 'agnt-loop',
      version: '1.0.0',
      name: 'Endless',
      autonomyLevel: 2,
      inputSchema: { x: 'string' },
      outputSchema: { y: 'string' },
      nodes: [
        { id: 'a', type: 'llm', config: { model: 'm', promptRef: 'prm:a@1.0.0' } },
        { id: 'b', type: 'llm', config: { model: 'm', promptRef: 'prm:b@1.0.0' } },
      ],
      edges: [
        { from: 'a', to: 'b', edgeType: 'data' },
        { from: 'b', to: 'a', edgeType: 'data' },
      ],
    };
    expect(errorCodes(wf)).toContain('CYCLE_WITHOUT_STOP');
  });

  it('rule 3: LLM_NOT_STRUCTURED when an LLM feeds a structured decision', () => {
    const wf = fromResearch((w) => {
      const llm = w.nodes.find((n) => n.id === 'llm-1')!;
      if (llm.type === 'llm') llm.config.structuredOutput = false;
    });
    expect(errorCodes(wf)).toContain('LLM_NOT_STRUCTURED');
  });

  it('rule 4: DELEGATE_REF_INVALID for a malformed delegate target', () => {
    const wf = fromResearch((w) => {
      w.autonomyLevel = 4;
      w.edges.push({ from: 'llm-1', to: 'not-a-ref', edgeType: 'delegate' });
    });
    expect(errorCodes(wf)).toContain('DELEGATE_REF_INVALID');
  });

  it('rule 4: DELEGATE_UNRESOLVED is a warning, not an error (degradable)', () => {
    const wf = fromResearch((w) => {
      w.autonomyLevel = 4;
      w.edges.push({ from: 'llm-1', to: 'agnt-verify@1.0.0', edgeType: 'delegate' });
    });
    // no resolver injected
    expect(errorCodes(wf)).toEqual([]);
    const found = validateGraph(wf).find((i) => i.code === 'DELEGATE_UNRESOLVED');
    expect(found?.severity).toBe('warning');
    // resolver that knows the ref clears even the warning
    expect(codes(wf, { resolveDelegate: (r) => r.id === 'agnt-verify' })).not.toContain(
      'DELEGATE_UNRESOLVED',
    );
  });

  it('rule 5: empty schemas and dangling references are errors', () => {
    const emptyIn = fromResearch((w) => {
      w.inputSchema = {};
    });
    expect(errorCodes(emptyIn)).toContain('EMPTY_INPUT_SCHEMA');

    const emptyOut = fromResearch((w) => {
      w.outputSchema = {};
    });
    expect(errorCodes(emptyOut)).toContain('EMPTY_OUTPUT_SCHEMA');

    const danglingEdge = fromResearch((w) => {
      w.edges.push({ from: 'llm-1', to: 'ghost', edgeType: 'data' });
    });
    expect(errorCodes(danglingEdge)).toContain('EDGE_ENDPOINT_MISSING');

    const danglingRoute = fromResearch((w) => {
      const dec = w.nodes.find((n) => n.id === 'dec-3')!;
      if (dec.type === 'decision') dec.config.onTrue.next = 'ghost';
    });
    expect(errorCodes(danglingRoute)).toContain('DECISION_ROUTE_MISSING');
  });
});

describe('validateGraph — §1.4 honest stop', () => {
  it('forbids an implicit confidence metric in a decision', () => {
    const wf = fromResearch((w) => {
      const dec = w.nodes.find((n) => n.id === 'dec-3')!;
      if (dec.type === 'decision') dec.config.condition = 'output.confidence > 0.8';
    });
    const found = validateGraph(wf).find((i) => i.code === 'DECISION_IMPLICIT_METRIC');
    expect(found?.severity).toBe('error');
  });
});

describe('validateGraph — §4 coherence', () => {
  it('a level declared below what the graph justifies is a coherence error', () => {
    const wf = fromResearch((w) => {
      w.autonomyLevel = 1; // but the graph has a bounded retry loop → min 2
    });
    const found = validateGraph(wf).find((i) => i.code === 'AUTONOMY_INCOHERENT');
    expect(found?.severity).toBe('error');
    expect(found?.remediation).toMatch(/Raise autonomyLevel to at least 2/);
  });

  it('a level declared at or above the graph minimum is fine', () => {
    const wf = fromResearch((w) => {
      w.autonomyLevel = 3; // more conservative than the min (2) — allowed
    });
    expect(errorCodes(wf)).toEqual([]);
  });
});
