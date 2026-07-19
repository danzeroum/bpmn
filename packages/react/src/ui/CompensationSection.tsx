import {
  compensableActivitiesOf,
  flowScopeOf,
  updateNodeCommand,
  type BpmnNode,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';

/** True for a compensate THROW (intermediate/end) — the only node with a target. */
export function isCompensationThrow(node: BpmnNode): boolean {
  return (
    node.properties.eventDefinition === 'compensate' &&
    (node.type === 'intermediateThrowEvent' || node.type === 'endEvent')
  );
}

/**
 * "Compensação" section (Handoff 19 §6b): the throw's target picker. It lists
 * the ACTIVITIES of the throw's OWN scope that are compensable (carry a ⟲
 * boundary) — never definitions (compensation has no named bucket) — via the
 * single-source `compensableActivitiesOf`. Broadcast (whole scope) is the
 * declared DEFAULT option; picking an activity settles `compensateActivityRef`,
 * which the transient chip then reads.
 */
export function CompensationSection({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { diagram, execute } = useDiagram();
  const t = useT();
  if (!isCompensationThrow(node)) return null;
  const scope = flowScopeOf(diagram, node);
  const activities = compensableActivitiesOf(diagram, scope);
  const current =
    typeof node.properties.compensateActivityRef === 'string'
      ? node.properties.compensateActivityRef
      : '';
  return (
    <section className="bpmnr-compensation-section" data-testid="compensation-section">
      <label className="bpmnr-compensation-label" htmlFor="comp-target">
        {t('compensation.target.label')}
      </label>
      <select
        id="comp-target"
        data-testid="compensation-target"
        className="bpmnr-compensation-select"
        value={current}
        disabled={readOnly}
        onChange={(event) =>
          void execute(
            updateNodeCommand(node.id, {
              properties: { compensateActivityRef: event.target.value || undefined },
            }),
          )
        }
      >
        <option value="">{t('compensation.target.broadcast')}</option>
        {activities.map((activity) => (
          <option key={activity.activityId} value={activity.activityId}>
            {activity.label}
          </option>
        ))}
      </select>
      <p className="bpmnr-compensation-hint">
        {current === ''
          ? t('compensation.target.broadcastHint')
          : t('compensation.target.specificHint')}
      </p>
    </section>
  );
}
