import type { AgentEdge, AgentNode, AgentWorkflow, DecoratorType, EdgeType, NodeType } from '@buildtovalue/agentflow';

/**
 * Pure edit transforms + an ISOLATED undo stack for the Agent Studio's
 * sub-workflow (Handoff 12 §5/§6). This stack is entirely separate from the
 * Designer's BPMN CommandStack: undo inside the modal never touches the macro
 * diagram behind it. Every transform returns a NEW AgentWorkflow (never
 * mutates), so the reducer can keep an immutable past/future history.
 */

/** One editor action's effect, for N-3 event emission from the modal. */
export interface EditEffect {
  event: 'element.added' | 'element.changed' | 'element.removed';
  kind: 'node' | 'edge';
  id?: string;
  elementType?: string;
}

export interface EditResult {
  workflow: AgentWorkflow;
  effect: EditEffect;
}

const DEFAULT_CONFIG: Record<NodeType, AgentNode['config']> = {
  llm: { model: 'gpt-4o', promptRef: 'prm:new@1.0.0', structuredOutput: false },
  tool: { usesTool: 'tool', timeoutMs: 30_000 },
  decision: { condition: 'output.is_complete === true', onTrue: { next: 'end' }, onFalse: { next: 'end' } },
};

/** Deterministic node id: `<type>-<n>` where n avoids collisions. */
export function nextNodeId(workflow: AgentWorkflow, type: NodeType): string {
  let n = workflow.nodes.filter((node) => node.type === type).length + 1;
  const existing = new Set(workflow.nodes.map((node) => node.id));
  while (existing.has(`${type}-${n}`)) n += 1;
  return `${type}-${n}`;
}

/** Adds a node of `type` with default config. */
export function addNode(workflow: AgentWorkflow, type: NodeType): EditResult {
  const id = nextNodeId(workflow, type);
  const node = { id, type, config: DEFAULT_CONFIG[type] } as AgentNode;
  return {
    workflow: { ...workflow, nodes: [...workflow.nodes, node] },
    effect: { event: 'element.added', kind: 'node', id, elementType: type },
  };
}

/** Replaces a node's config (shallow merge into the existing config). */
export function updateNodeConfig(
  workflow: AgentWorkflow,
  id: string,
  patch: Record<string, unknown>,
): EditResult {
  const nodes = workflow.nodes.map((node) =>
    node.id === id ? ({ ...node, config: { ...node.config, ...patch } } as AgentNode) : node,
  );
  return {
    workflow: { ...workflow, nodes },
    effect: { event: 'element.changed', kind: 'node', id },
  };
}

/** Removes a node and every edge touching it. */
export function removeNode(workflow: AgentWorkflow, id: string): EditResult {
  return {
    workflow: {
      ...workflow,
      nodes: workflow.nodes.filter((node) => node.id !== id),
      edges: workflow.edges.filter((edge) => edge.from !== id && edge.to !== id),
    },
    effect: { event: 'element.removed', kind: 'node', id },
  };
}

/** Adds an edge (skips exact duplicates). */
export function addEdge(workflow: AgentWorkflow, from: string, to: string, edgeType: EdgeType): EditResult {
  const exists = workflow.edges.some((e) => e.from === from && e.to === to && e.edgeType === edgeType);
  const edges: AgentEdge[] = exists ? workflow.edges : [...workflow.edges, { from, to, edgeType }];
  return {
    workflow: { ...workflow, edges },
    effect: { event: 'element.added', kind: 'edge', id: `${from}->${to}`, elementType: edgeType },
  };
}

/** Toggles a decorator on a node (adds a default of that type, or removes it). */
export function toggleDecorator(workflow: AgentWorkflow, id: string, type: DecoratorType): EditResult {
  const nodes = workflow.nodes.map((node) => {
    if (node.id !== id) return node;
    const current = node.decorators ?? [];
    const has = current.some((d) => d.type === type);
    const decorators = has
      ? current.filter((d) => d.type !== type)
      : [...current, defaultDecorator(type)];
    return { ...node, decorators } as AgentNode;
  });
  return {
    workflow: { ...workflow, nodes },
    effect: { event: 'element.changed', kind: 'node', id },
  };
}

function defaultDecorator(type: DecoratorType) {
  if (type === 'memory') return { type, scope: 'short' } as const;
  if (type === 'planner') return { type, strategy: 'static' } as const;
  return { type: 'errorBoundary', maxRetries: 3, backoff: 'exponential' } as const;
}

// ── isolated undo stack ────────────────────────────────────────────────────

export interface AgentEditorState {
  past: AgentWorkflow[];
  present: AgentWorkflow;
  future: AgentWorkflow[];
  /** The last effect, so the view can emit the matching N-3 event. */
  lastEffect: EditEffect | null;
  /** Bumped on undo/redo so the view can emit command.undone, etc. */
  historyOp: 'apply' | 'undo' | 'redo' | 'reset' | null;
}

export type AgentEditorAction =
  | { type: 'apply'; result: EditResult }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; workflow: AgentWorkflow };

/** Reducer for the isolated history — the modal's own command/undo stack. */
export function agentEditorReducer(state: AgentEditorState, action: AgentEditorAction): AgentEditorState {
  switch (action.type) {
    case 'apply':
      return {
        past: [...state.past, state.present],
        present: action.result.workflow,
        future: [],
        lastEffect: action.result.effect,
        historyOp: 'apply',
      };
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastEffect: null,
        historyOp: 'undo',
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        lastEffect: null,
        historyOp: 'redo',
      };
    }
    case 'reset':
      return { past: [], present: action.workflow, future: [], lastEffect: null, historyOp: 'reset' };
  }
}

export function initEditorState(workflow: AgentWorkflow): AgentEditorState {
  return { past: [], present: workflow, future: [], lastEffect: null, historyOp: null };
}

// ── deterministic canvas layout ────────────────────────────────────────────

export interface NodeLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A simple deterministic layered layout: entry-first BFS assigns columns,
 * siblings stack in rows. No coordinates live in the schema (§3 is a pure
 * graph), so the Studio derives them — same input → same layout.
 */
export function layoutWorkflow(workflow: AgentWorkflow): NodeLayout[] {
  const COL = 200;
  const ROW = 110;
  const W = 150;
  const H = 66;
  const succ = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (edge.edgeType === 'delegate') continue;
    succ.set(edge.from, [...(succ.get(edge.from) ?? []), edge.to]);
  }
  const column = new Map<string, number>();
  // entry nodes: no incoming non-delegate edge
  const hasIncoming = new Set(workflow.edges.filter((e) => e.edgeType !== 'delegate').map((e) => e.to));
  const queue = workflow.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
  for (const id of queue) column.set(id, 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const col = column.get(id) ?? 0;
    for (const to of succ.get(id) ?? []) {
      if (!column.has(to) || column.get(to)! <= col) {
        column.set(to, col + 1);
        queue.push(to);
      }
    }
  }
  // nodes not reached (isolated) get appended columns by array order
  let fallback = 0;
  for (const node of workflow.nodes) {
    if (!column.has(node.id)) column.set(node.id, fallback++);
  }
  const rowByCol = new Map<number, number>();
  return workflow.nodes.map((node) => {
    const col = column.get(node.id) ?? 0;
    const row = rowByCol.get(col) ?? 0;
    rowByCol.set(col, row + 1);
    return { id: node.id, x: 24 + col * COL, y: 24 + row * ROW, width: W, height: H };
  });
}
