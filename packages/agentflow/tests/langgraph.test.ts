import { describe, expect, it } from 'vitest';
import {
  APPROVAL_GATE_AGENT,
  DOCUMENT_REVIEW_AGENT,
  exportLangGraph,
  importLangGraph,
  LangGraphImportError,
  RESEARCH_AGENT,
  type LangGraphJson,
} from '../src/index.js';

describe('LangGraph import (documented subset, §9.8)', () => {
  const base: LangGraphJson = {
    id: 'agnt-x',
    name: 'X',
    version: '1.0.0',
    input_schema: { q: 'string' },
    output_schema: { a: 'string' },
    nodes: [
      { id: 'llm-1', type: 'llm', data: { model: 'gpt-4o', promptRef: 'prm:x@1.0.0', structuredOutput: true } },
      { id: 'dec-1', type: 'decision', data: { condition: 'output.done === true', onTrue: { next: 'end' }, onFalse: { next: 'end' } } },
    ],
    edges: [{ source: 'llm-1', target: 'dec-1', data: { edgeType: 'data' } }],
  };

  it('maps the subset into an AgentWorkflow and recomputes autonomyLevel', () => {
    const { workflow, warnings } = importLangGraph(base);
    expect(workflow.id).toBe('agnt-x');
    expect(workflow.nodes.map((n) => n.type)).toEqual(['llm', 'decision']);
    expect(workflow.edges[0]).toMatchObject({ from: 'llm-1', to: 'dec-1', edgeType: 'data' });
    expect(workflow.autonomyLevel).toBe(1); // loop-free → recomputed
    expect(warnings).toEqual([]);
  });

  it('preserves a conditional edge label (data.when)', () => {
    const { workflow } = importLangGraph({
      ...base,
      edges: [{ source: 'dec-1', target: 'llm-1', conditional: true, data: { edgeType: 'data', when: 'retry' } }],
    });
    expect(workflow.edges[0]).toMatchObject({ from: 'dec-1', to: 'llm-1', edgeType: 'data', when: 'retry' });
  });

  it('IGNORES out-of-subset fields and DECLARES them (never silent)', () => {
    const { warnings } = importLangGraph({
      ...base,
      interrupts: ['llm-1'],
      checkpointer: { kind: 'memory' },
      streaming: true,
    } as LangGraphJson);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Ignored out-of-subset field "interrupts"/),
        expect.stringMatching(/Ignored out-of-subset field "checkpointer"/),
        expect.stringMatching(/Ignored out-of-subset field "streaming"/),
      ]),
    );
  });

  it('FAILS with a named error on an unmappable node type (no silent loss)', () => {
    const bad: LangGraphJson = { ...base, nodes: [{ id: 'weird-1', type: 'retriever' }] };
    expect(() => importLangGraph(bad)).toThrow(LangGraphImportError);
    try {
      importLangGraph(bad);
    } catch (err) {
      expect((err as LangGraphImportError).nodeId).toBe('weird-1');
      expect((err as Error).message).toMatch(/unmappable type "retriever"/);
    }
  });
});

describe('LangGraph export (subset only, §9.8)', () => {
  it('always declares autonomyLevel as left out', () => {
    const { warnings } = exportLangGraph(APPROVAL_GATE_AGENT);
    expect(warnings.some((w) => /autonomyLevel .* not represented/.test(w))).toBe(true);
  });

  it('declares dropped decorators and delegate edges', () => {
    const wf = structuredClone(RESEARCH_AGENT); // memory + errorBoundary on llm-1
    wf.edges.push({ from: 'llm-1', to: 'agnt-verify@1.0.0', edgeType: 'delegate' });
    const { json, warnings } = exportLangGraph(wf);
    expect(warnings.some((w) => /decorators \[memory, errorBoundary\]/.test(w))).toBe(true);
    expect(warnings.some((w) => /Delegate edge .* dropped/.test(w))).toBe(true);
    // the delegate edge is NOT in the exported subset
    expect(json.edges.some((e) => e.target.startsWith('agnt-verify'))).toBe(false);
  });
});

describe('LangGraph round-trip (subset equivalence, §9.8)', () => {
  it('a decorator-free, delegate-free workflow round-trips to an equivalent graph', () => {
    for (const wf of [APPROVAL_GATE_AGENT, DOCUMENT_REVIEW_AGENT]) {
      const { json } = exportLangGraph(wf);
      const { workflow } = importLangGraph(json);
      // identity + schemas preserved
      expect(workflow.id).toBe(wf.id);
      expect(workflow.name).toBe(wf.name);
      expect(workflow.version).toBe(wf.version);
      expect(workflow.inputSchema).toEqual(wf.inputSchema);
      expect(workflow.outputSchema).toEqual(wf.outputSchema);
      // node graph preserved (id/type/config)
      expect(workflow.nodes).toEqual(wf.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })));
      // edges preserved (these templates have no delegate edge)
      expect(workflow.edges).toEqual(wf.edges);
      // autonomyLevel recomputed to the same value the graph justifies
      expect(workflow.autonomyLevel).toBe(wf.autonomyLevel);
    }
  });
});
