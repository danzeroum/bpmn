import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BpmnDiagram } from '@bpmn-react/core';
import {
  aggregate,
  normalizeName,
  type AggregatedLog,
  type ReplayGraph,
  type Trace,
} from '@bpmn-react/replay';
import { diagramToReplayGraph } from './diagramToReplayGraph.js';

const STEP_MS = 650;

export interface UseReplayResult {
  graph: ReplayGraph;
  log: AggregatedLog;
  /** Index of the deviation highlighted on the canvas / panel, or null. */
  selectedDeviation: number | null;
  selectDeviation: (index: number | null) => void;
  /** Index of the variant currently playing, or null. */
  playingVariant: number | null;
  /** Node id the variant token currently sits on (null when idle). */
  variantTokenNodeId: string | null;
  playVariant: (index: number) => void;
  stopVariant: () => void;
  /** Node id → resolved variant node sequence (for the overlay). */
  formatMs: (ms: number) => string;
}

/**
 * React controller around the headless replay aggregation. It builds the
 * abstract graph from the diagram (host adapter — the engine never imports the
 * model), aggregates the log once, and drives the sampled-variant playback
 * token (one token over a top variant, never one per event — cerca §0.3).
 */
export function useReplay(
  diagram: BpmnDiagram,
  traces: Iterable<Trace>,
  formatMs: (ms: number) => string,
): UseReplayResult {
  const graph = useMemo(() => diagramToReplayGraph(diagram), [diagram]);
  // `traces` is treated as a stable input per diagram; aggregation is one pass.
  const log = useMemo(() => aggregate(graph, traces), [graph, traces]);

  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of graph.nodes) {
      const key = normalizeName(node.name ?? node.id);
      if (!map.has(key)) map.set(key, node.id);
    }
    return map;
  }, [graph]);

  const [selectedDeviation, setSelectedDeviation] = useState<number | null>(null);
  const [playingVariant, setPlayingVariant] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const stopVariant = useCallback(() => {
    clearTimer();
    setPlayingVariant(null);
    setStep(0);
  }, [clearTimer]);

  // Resolve the currently-playing variant to a node-id sequence (mapped only).
  const sequence = useMemo(() => {
    if (playingVariant === null) return [];
    const variant = log.variants[playingVariant];
    if (!variant) return [];
    return variant.activities
      .map((activity) => nameToId.get(normalizeName(activity)))
      .filter((id): id is string => id !== undefined);
  }, [playingVariant, log, nameToId]);

  const playVariant = useCallback(
    (index: number) => {
      clearTimer();
      setPlayingVariant(index);
      setStep(0);
    },
    [clearTimer],
  );

  // Step the token through the resolved sequence; stop at the end.
  useEffect(() => {
    if (playingVariant === null || sequence.length === 0) return;
    clearTimer();
    timer.current = setInterval(() => {
      setStep((current) => {
        if (current + 1 >= sequence.length) {
          clearTimer();
          setPlayingVariant(null);
          return 0;
        }
        return current + 1;
      });
    }, STEP_MS);
    return clearTimer;
  }, [playingVariant, sequence, clearTimer]);

  // Reset transient UI when the diagram/log changes.
  useEffect(() => stopVariant, [stopVariant]);

  const variantTokenNodeId =
    playingVariant !== null && sequence.length > 0 ? (sequence[step] ?? null) : null;

  const selectDeviation = useCallback((index: number | null) => {
    setSelectedDeviation((prev) => (prev === index ? null : index));
  }, []);

  return {
    graph,
    log,
    selectedDeviation,
    selectDeviation,
    playingVariant,
    variantTokenNodeId,
    playVariant,
    stopVariant,
    formatMs,
  };
}
