import { useEffect, useRef, useState } from 'react';
import { computeDiagramHash, restoreDiagramCommand } from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import {
  AUTOSAVE_DEBOUNCE_MS,
  clearAutosave,
  readAutosave,
  writeAutosave,
  type AutosavePayload,
} from '../state/autosave.js';

/**
 * Editor resilience (Handoff 4 §D2/§D3): debounced autosave to localStorage,
 * a recovery banner when an unsaved draft differs from the loaded document,
 * and a beforeunload guard while there are commands since the last export.
 * Opt-out with `autosave: false` on any plugin.
 */
export function ResilienceLayer() {
  const config = useEditorConfig();
  const { diagram, execute } = useDiagram();
  const { stack } = useDiagram();
  const store = useCanvasStore();
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const [recovery, setRecovery] = useState<AutosavePayload | null>(null);

  // Debounced autosave on every command; also raises the dirty flag.
  useEffect(() => {
    if (!config.autosave) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = stack.subscribe(() => {
      store.setState({ dirtySinceExport: true });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void writeAutosave(diagramRef.current), AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [config.autosave, stack, store]);

  // Recovery detection on mount: an autosave whose content hash differs from
  // the loaded document is offered for restore.
  useEffect(() => {
    if (!config.autosave) return;
    const saved = readAutosave(diagramRef.current.id);
    if (!saved) return;
    let stale = false;
    void computeDiagramHash(diagramRef.current).then((hash) => {
      if (!stale && hash !== saved.hash) setRecovery(saved);
    });
    return () => {
      stale = true;
    };
  }, [config.autosave]);

  // Exit guard while dirty (§D3) — opt-out together with autosave.
  useEffect(() => {
    if (!config.autosave) return;
    const guard = (event: BeforeUnloadEvent) => {
      if (!store.getState().dirtySinceExport) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [config.autosave, store]);

  if (!recovery) return null;

  const restore = () => {
    // Through the command bus: undoable, audited, subject to the rules engine.
    const verdict = execute(restoreDiagramCommand(recovery.diagram));
    if (verdict.allowed) setRecovery(null);
  };

  const discard = () => {
    clearAutosave(recovery.diagram.id);
    setRecovery(null);
  };

  return (
    <div className="bpmnr-recovery" role="alert">
      <span>Rascunho não salvo de {formatTime(recovery.savedAt)} encontrado</span>
      <button type="button" onClick={restore}>
        Restaurar
      </button>
      <button type="button" onClick={discard}>
        Descartar
      </button>
    </div>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}
