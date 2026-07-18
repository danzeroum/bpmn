import {
  isEventSubprocess,
  nodeParentId,
  startIsInterrupting,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnNode,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * "Interrompe o escopo" (Handoff 17 ES-3, §4c): ONLY on the start event of an
 * event subprocess — both sides of the predicate come from the ES-1 core
 * helpers (`startIsInterrupting` + `isEventSubprocess` on the parent), never
 * a local reimplementation. The commit is one undoable `updateNodeCommand`;
 * the OMG default (interrupting) is the ABSENT field — clean model, so
 * toggling back removes the property entirely.
 */
export function isEventSubprocessStart(diagram: BpmnDiagram, node: BpmnNode): boolean {
  if (node.type !== 'startEvent') return false;
  const parentId = nodeParentId(node);
  const parent = parentId ? diagram.nodes[parentId] : undefined;
  return parent !== undefined && isEventSubprocess(parent);
}

export function InterruptingToggle({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { execute } = useDiagram();
  const t = useT();
  const interrupting = startIsInterrupting(node);
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
                properties: { isInterrupting: event.target.checked ? undefined : false },
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
