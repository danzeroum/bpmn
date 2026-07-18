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
import type { EdgeRouterFn, EditorEventName, EditorEventPayloads } from '../plugins/types.js';

type EmitEditorEvent = <T extends EditorEventName>(type: T, meta?: EditorEventPayloads[T]) => void;

/** N-3: audit event type → catalog element.* event (default: element.changed). */
const ELEMENT_ADDED = new Set(['NODE_ADDED', 'EDGE_CREATED']);
const ELEMENT_REMOVED = new Set(['NODE_REMOVED', 'EDGE_REMOVED']);

function emitElementEvent(emit: EmitEditorEvent, command: Command): void {
  const audit = command.toAuditEvent?.();
  if (!audit) return;
  const details = audit.details as { nodeId?: string; edgeId?: string; nodeType?: string };
  const kind: 'node' | 'edge' = details.edgeId ? 'edge' : 'node';
  const id = details.nodeId ?? details.edgeId;
  if (ELEMENT_ADDED.has(audit.type)) {
    emit('element.added', { ...(id ? { id } : {}), ...(details.nodeType ? { elementType: details.nodeType } : {}), kind });
  } else if (ELEMENT_REMOVED.has(audit.type)) {
    emit('element.removed', { ...(id ? { id } : {}), kind });
  } else {
    emit('element.changed', {
      ...(id ? { id } : {}),
      ...(audit.type === 'COMPOSITE' ? { composite: true } : {}),
      description: command.description,
    });
  }
}

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
  /**
   * Declared GESTURE veto channel (Handoff 17 ES-3): surfaces a veto that
   * happened OUTSIDE the command stack (a rejected connect drop, a Tab on the
   * event-subprocess shell) on the SAME 🔒 surface as `lastVeto`, with the
   * same lifecycle — replaced by the next veto, cleared by the next
   * successful command. Never a silent gesture, never an unbounded channel.
   */
  announceVeto: (reason: string) => void;
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
  /**
   * N-3: the editor's typed event channel. When present, the provider emits
   * `diagram.loaded`, `command.executed|undone` and the `element.*` family;
   * omitted → no emissions (the channel stays an injected callback).
   */
  emitEditorEvent?: EmitEditorEvent;
  children: ReactNode;
}

export function DiagramProvider({
  diagram,
  ruleEngine,
  edgeRouter,
  onChange,
  emitEditorEvent,
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

  const emitRef = useRef(emitEditorEvent);
  emitRef.current = emitEditorEvent;
  const emitLoaded = useCallback((loaded: BpmnDiagram) => {
    emitRef.current?.('diagram.loaded', {
      diagramId: loaded.id,
      name: loaded.name,
      nodes: Object.keys(loaded.nodes).length,
      edges: Object.keys(loaded.edges).length,
    });
  }, []);
  // N-3 `diagram.loaded`: once per mounted diagram (imports re-emit below).
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    emitLoaded(stack.current);
  }, [emitLoaded, stack]);

  const execute = useCallback(
    (command: Command): RuleVerdict => {
      const verdict = stack.execute(command);
      setLastVeto(verdict.allowed ? null : (verdict.reason ?? 'Command rejected'));
      if (verdict.allowed && emitRef.current) {
        emitRef.current('command.executed', {
          commandId: command.id,
          description: command.description,
          ...(command.toAuditEvent ? { auditType: command.toAuditEvent().type } : {}),
        });
        emitElementEvent(emitRef.current, command);
      }
      return verdict;
    },
    [stack],
  );

  const replaceDiagram = useCallback(
    (next: BpmnDiagram) => {
      const router = edgeRouterRef.current;
      stack.reset(router ? deriveAstarRoutes(next, router) : next);
      setLastVeto(null);
      emitLoaded(stack.current);
    },
    [emitLoaded, stack],
  );

  // ES-3: gesture vetoes share the lastVeto slot — replaced by the next veto,
  // cleared by the next successful execute (same lifecycle, no extra memory).
  const announceVeto = useCallback((reason: string) => setLastVeto(reason), []);

  const value = useMemo<DiagramContextValue>(
    () => ({
      diagram: current,
      stack,
      execute,
      undo: () => {
        if (stack.canUndo) emitRef.current?.('command.undone', {});
        stack.undo();
      },
      redo: () => stack.redo(),
      canUndo: stack.canUndo,
      canRedo: stack.canRedo,
      lastVeto,
      announceVeto,
      replaceDiagram,
    }),
    [current, stack, execute, lastVeto, announceVeto, replaceDiagram],
  );

  return <DiagramContext.Provider value={value}>{children}</DiagramContext.Provider>;
}

export function useDiagram(): DiagramContextValue {
  const value = useContext(DiagramContext);
  if (!value) throw new Error('useDiagram must be used inside <BpmnDesigner>/<BpmnViewer>');
  return value;
}

/**
 * Tolerant variant for PURE shapes (Handoff 17 ES-2): a shape that needs
 * sibling/child context (e.g. the collapsed event-subprocess trigger glyph)
 * reads it through this and DEGRADES to `null` outside a provider — so
 * standalone rendering (snapshots, server markup) never throws.
 */
export function useDiagramOrNull(): DiagramContextValue | null {
  return useContext(DiagramContext);
}
