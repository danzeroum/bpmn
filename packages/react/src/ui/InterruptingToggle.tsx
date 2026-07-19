import {
  isEventSubprocess,
  isNonInterrupting,
  nodeParentId,
  startIsInterrupting,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnNode,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * "Interrompe o escopo" (Handoff 17 ES-3, §4c; extended to boundaries in
 * Handoff 18 §5b): the interrupting toggle serves the two OMG catches whose
 * default the personality flips — an event-subprocess START (`isInterrupting`)
 * and a boundary event (`cancelActivity`). Both sides of every predicate come
 * from the core helpers (`startIsInterrupting`/`isNonInterrupting`), never a
 * local reimplementation. The commit is one undoable `updateNodeCommand`; the
 * OMG default (interrupting) is the ABSENT field, so toggling back to
 * interrupting removes the property entirely.
 */
export function isEventSubprocessStart(diagram: BpmnDiagram, node: BpmnNode): boolean {
  if (node.type !== 'startEvent') return false;
  const parentId = nodeParentId(node);
  const parent = parentId ? diagram.nodes[parentId] : undefined;
  return parent !== undefined && isEventSubprocess(parent);
}

/** The node kinds the interrupting toggle applies to (esub start or boundary).
 * A COMPENSATION boundary (Handoff 19 §6b) is excluded: it fires AFTER its
 * activity completes, so `cancelActivity` does not apply — the boundary is
 * ALWAYS solid and the toggle is absent for this kind. */
export function hasInterruptingToggle(diagram: BpmnDiagram, node: BpmnNode): boolean {
  if (node.type === 'boundaryEvent') return node.properties.eventDefinition !== 'compensate';
  return isEventSubprocessStart(diagram, node);
}

export function InterruptingToggle({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { execute } = useDiagram();
  const t = useT();
  const isBoundary = node.type === 'boundaryEvent';
  // Boundary: cancelActivity===false is non-interrupting. Esub start: the
  // isInterrupting=false field. Interrupting is the ABSENT-field default.
  const interrupting = isBoundary ? !isNonInterrupting(node) : startIsInterrupting(node);
  const field = isBoundary ? 'cancelActivity' : 'isInterrupting';
  return (
    <section className="bpmnr-interrupting" data-testid="interrupting-toggle">
      <label className="bpmnr-interrupting-label">
        <input
          type="checkbox"
          checked={interrupting}
          disabled={readOnly}
          data-testid="interrupting-checkbox"
          onChange={(event) =>
            void execute(
              updateNodeCommand(node.id, {
                properties: { [field]: event.target.checked ? undefined : false },
              }),
            )
          }
        />
        {t('eventSubproc.interrupting.label')}
      </label>
      <p className="bpmnr-interrupting-hint">
        {interrupting
          ? t('eventSubproc.interrupting.on')
          : t('eventSubproc.interrupting.off')}
      </p>
    </section>
  );
}
