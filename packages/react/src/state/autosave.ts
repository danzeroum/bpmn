import { computeDiagramHash, type BpmnDiagram } from '@buildtovalue/core';

/**
 * Autosave payload (Handoff 4 §D2). The diagram is stored as its JSON model —
 * lossless by construction — rather than the XML export, which can degrade
 * unsupported elements with warnings. `hash` is the core content hash
 * (audit-independent), used to decide whether an autosave differs from the
 * loaded document: timestamps are unreliable for hosts that regenerate the
 * diagram on load.
 */
export interface AutosavePayload {
  savedAt: string;
  hash: string;
  diagram: BpmnDiagram;
}

/** Debounce between the last command and the localStorage write. */
export const AUTOSAVE_DEBOUNCE_MS = 2000;

export function autosaveKey(diagramId: string): string {
  return `bpmnr:autosave:${diagramId}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // privacy mode / sandboxed iframe
  }
}

/** Best-effort write — quota or privacy failures never break editing. */
export async function writeAutosave(diagram: BpmnDiagram): Promise<void> {
  const store = storage();
  if (!store) return;
  try {
    const hash = await computeDiagramHash(diagram);
    const payload: AutosavePayload = { savedAt: new Date().toISOString(), hash, diagram };
    store.setItem(autosaveKey(diagram.id), JSON.stringify(payload));
  } catch {
    // best effort
  }
}

export function readAutosave(diagramId: string): AutosavePayload | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(autosaveKey(diagramId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosavePayload;
    if (!parsed || typeof parsed.hash !== 'string' || !parsed.diagram) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosave(diagramId: string): void {
  storage()?.removeItem(autosaveKey(diagramId));
}
