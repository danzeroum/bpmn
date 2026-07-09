import type { ReplayGraph, Trace } from '../src/index.js';

/** A tiny linear model A → B → C → D (names match the activities). */
export const linearGraph: ReplayGraph = {
  nodes: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
    { id: 'cd', source: 'c', target: 'd' },
  ],
};

/** Helper to build a trace from activities and optional epoch-ms timestamps. */
export function trace(caseId: string, activities: string[], timestamps?: number[]): Trace {
  return {
    caseId,
    events: activities.map((activity, i) => ({
      activity,
      ...(timestamps ? { timestamp: timestamps[i] } : {}),
    })),
  };
}
