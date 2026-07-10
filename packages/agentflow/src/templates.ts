/**
 * The three starter templates (Handoff 12 §6). Each is a valid
 * {@link AgentWorkflow} — `validateGraph` returns no error for any of them —
 * and each cleanly exemplifies one rung of the normative autonomy scale (§4):
 *
 *   - Approval Gate Agent ★ (default) — autonomy 1, Loop-free. Governance as
 *     the first experience: an LLM review feeds a decision; the process is
 *     expected to place a btv:gate downstream (level ≤ 3 requires it).
 *   - Research Agent — autonomy 2, Bounded Loop. The prototype's retry pattern:
 *     search → decide is_complete → retry with maxRetries.
 *   - Document Review Agent — autonomy 3, Decision Tree. Extract → validate →
 *     branch into classify vs. finish (distinct forward paths).
 *
 * Note (registered in pendencias): the prototype canvas also DEMOS a `delegate`
 * edge on the Research Agent while displaying "2 · Bounded Loop". Normatively a
 * delegate edge forces autonomy 4 (§4, "o grafo é quem manda"), so the template
 * stays a faithful level-2 loop and delegate/level-4 is exercised by tests.
 */

import type { AgentWorkflow } from './types.js';

/** Approval Gate Agent — autonomy 1 (Loop-free); the ★ default. */
export const APPROVAL_GATE_AGENT: AgentWorkflow = {
  kind: 'AgentWorkflow',
  id: 'agnt-approval-gate',
  version: '1.0.0',
  name: 'Approval Gate Agent',
  autonomyLevel: 1,
  inputSchema: { request: 'string' },
  outputSchema: { approved: 'boolean', rationale: 'string' },
  nodes: [
    {
      id: 'llm-review',
      type: 'llm',
      config: { model: 'gpt-4o', promptRef: 'prm:approval-review@1.0.0', structuredOutput: true },
    },
    {
      id: 'dec-approve',
      type: 'decision',
      config: {
        condition: 'output.approved === true',
        onTrue: { next: 'end' },
        onFalse: { next: 'end' },
      },
    },
  ],
  edges: [{ from: 'llm-review', to: 'dec-approve', edgeType: 'data' }],
};

/** Research Agent — autonomy 2 (Bounded Loop); the prototype pattern (§3). */
export const RESEARCH_AGENT: AgentWorkflow = {
  kind: 'AgentWorkflow',
  id: 'agnt-rsch',
  version: '2.1.0',
  name: 'Research Agent',
  autonomyLevel: 2,
  inputSchema: { query: 'string' },
  outputSchema: { answer: 'string', sources: 'string[]', is_complete: 'boolean' },
  nodes: [
    {
      id: 'llm-1',
      type: 'llm',
      config: { model: 'gpt-4o', promptRef: 'prm:research@2.0.0', structuredOutput: true },
      decorators: [
        { type: 'memory', scope: 'short', expiry: '6h' },
        { type: 'errorBoundary', maxRetries: 3, backoff: 'exponential' },
      ],
    },
    {
      id: 'tool-2',
      type: 'tool',
      config: { usesTool: 'browser_search', params: { query: '{{llm-1.output.query}}' }, timeoutMs: 30000 },
    },
    {
      id: 'dec-3',
      type: 'decision',
      config: {
        condition: 'output.is_complete === true',
        onTrue: { next: 'end' },
        onFalse: { next: 'llm-1', maxRetries: 3 },
      },
    },
  ],
  edges: [
    { from: 'llm-1', to: 'tool-2', edgeType: 'toolCall' },
    { from: 'tool-2', to: 'dec-3', edgeType: 'data' },
    { from: 'dec-3', to: 'llm-1', edgeType: 'data', when: 'retry' },
  ],
};

/** Document Review Agent — autonomy 3 (Decision Tree). */
export const DOCUMENT_REVIEW_AGENT: AgentWorkflow = {
  kind: 'AgentWorkflow',
  id: 'agnt-doc-review',
  version: '1.0.0',
  name: 'Document Review Agent',
  autonomyLevel: 3,
  inputSchema: { document: 'string' },
  outputSchema: { category: 'string', extracted: 'string', is_valid: 'boolean' },
  nodes: [
    {
      id: 'llm-extract',
      type: 'llm',
      config: { model: 'gpt-4o', promptRef: 'prm:doc-extract@1.0.0', structuredOutput: true },
    },
    {
      id: 'dec-validate',
      type: 'decision',
      config: {
        condition: 'output.is_valid === true',
        onTrue: { next: 'llm-classify' },
        onFalse: { next: 'end' },
      },
    },
    {
      id: 'llm-classify',
      type: 'llm',
      config: { model: 'gpt-4o', promptRef: 'prm:doc-classify@1.0.0', structuredOutput: true },
    },
  ],
  edges: [{ from: 'llm-extract', to: 'dec-validate', edgeType: 'data' }],
};

/** The id of the ★ default template surfaced first in the palette (§6). */
export const DEFAULT_TEMPLATE_ID = APPROVAL_GATE_AGENT.id;

/** All templates, in palette order (default first). */
export const TEMPLATES: readonly AgentWorkflow[] = [
  APPROVAL_GATE_AGENT,
  RESEARCH_AGENT,
  DOCUMENT_REVIEW_AGENT,
];
