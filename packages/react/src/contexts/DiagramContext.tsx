import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  CommandStack,
  type BpmnDiagram,
  type Command,
  type RuleEngine,
  type RuleVerdict,
} from '@buildtovalue/core';
import { deriveAstarRoutes } from '../canvas/routeEdge.js';
import type { EdgeRouterFn } from '../plugins/types.js';

export interface DiagramContextValue {
  diagram: BpmnDiagram;
  stack: CommandStack;
  execute: (command: Command) => RuleVerdict;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Reason of the most recent vetoed command (cleared on next success). */
  lastVeto: string | null;
  /** Replaces the whole diagram (import) and clears history. */
  replaceDiagram: (diagram: BpmnDiagram) => void;
}

const DiagramContext = createContext<DiagramContextValue | null>(null);

export interface DiagramProviderProps {
  diagram: BpmnDiagram;
  ruleEngine?: RuleEngine;
  /**
   * The editor's default router (Handoff 10 R-2b). When present, A* routes for
   * `astar` edges without waypoints are DERIVED — not committed — into the
   * initial diagram (and on every `replaceDiagram`), so cached waypoints exist
   * before the first render without an undo entry or ledger record. Omitted →
   * no derivation (non-astar editors pay nothing).
   */
  edgeRouter?: EdgeRouterFn;
  onChange?: (diagram: BpmnDiagram) => void;
  children: ReactNode;
}

export function DiagramProvider({
  diagram,
  ruleEngine,
  edgeRouter,
  onChange,
  children,
}: DiagramProviderProps) {
  // Presentation derivation, NOT an edit: seed the stack with cached A* routes
  // so it never enters undo history or the audit ledger (Handoff 10 R-2b).
  const edgeRouterRef = useRef(edgeRouter);
  edgeRouterRef.current = edgeRouter;

  const stackRef = useRef<CommandStack | null>(null);
  if (stackRef.current === null) {
    const seeded = edgeRouter ? deriveAstarRoutes(diagram, edgeRouter) : diagram;
    stackRef.current = new CommandStack(seeded, { interceptor: ruleEngine });
  }
  const stack = stackRef.current;

  const current = useSyncExternalStore(
    useCallback((notify: () => void) => stack.subscribe(notify), [stack]),
    () => stack.current,
    () => stack.current,
  );

  const [lastVeto, setLastVeto] = useState<string | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    return stack.subscribe((next) => onChangeRef.current?.(next));
  }, [stack]);

  const execute = useCallback(
    (command: Command): RuleVerdict => {
      const verdict = stack.execute(command);
      setLastVeto(verdict.allowed ? null : (verdict.reason ?? 'Command rejected'));
      return verdict;
    },
    [stack],
  );

  const replaceDiagram = useCallback(
    (next: BpmnDiagram) => {
      const router = edgeRouterRef.current;
      stack.reset(router ? deriveAstarRoutes(next, router) : next);
      setLastVeto(null);
    },
    [stack],
  );

  const value = useMemo<DiagramContextValue>(
    () => ({
      diagram: current,
      stack,
      execute,
      undo: () => stack.undo(),
      redo: () => stack.redo(),
      canUndo: stack.canUndo,
      canRedo: stack.canRedo,
      lastVeto,
      replaceDiagram,
    }),
    [current, stack, execute, lastVeto, replaceDiagram],
  );

  return <DiagramContext.Provider value={value}>{children}</DiagramContext.Provider>;
}

export function useDiagram(): DiagramContextValue {
  const value = useContext(DiagramContext);
  if (!value) throw new Error('useDiagram must be used inside <BpmnDesigner>/<BpmnViewer>');
  return value;
}
