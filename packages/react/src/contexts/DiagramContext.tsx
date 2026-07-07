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
} from '@bpmn-react/core';

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
  onChange?: (diagram: BpmnDiagram) => void;
  children: ReactNode;
}

export function DiagramProvider({ diagram, ruleEngine, onChange, children }: DiagramProviderProps) {
  const stackRef = useRef<CommandStack | null>(null);
  if (stackRef.current === null) {
    stackRef.current = new CommandStack(diagram, { interceptor: ruleEngine });
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
      stack.reset(next);
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
