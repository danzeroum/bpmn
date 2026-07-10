import { useState } from 'react';
import type { BlockedDecision, Decision, PendingDecisionInput } from '@buildtovalue/simulation';
import { useT } from '../i18n/I18nContext.js';

/**
 * Decision-input card (Handoff 9 SF-2): when the token rests on a
 * businessRuleTask with an evaluable table, the session asks for the input
 * values — the S-FEEL counterpart of the gateway choice card. Values are
 * coerced by shape: `true`/`false` → boolean, numeric text → number,
 * anything else → string.
 */
export function DecisionInputCard({
  pending,
  onDecide,
}: {
  pending: PendingDecisionInput;
  onDecide: (decision: Decision) => void;
}) {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <form
      className="bpmnr-sim-decision-card"
      data-testid="decision-input-card"
      onSubmit={(event) => {
        event.preventDefault();
        const context: Record<string, number | string | boolean> = {};
        for (const input of pending.inputs) context[input] = coerce(values[input] ?? '');
        onDecide({ kind: 'decision', node: pending.nodeId, context });
      }}
    >
      <strong>{t('sim.decision.label', { label: pending.label })}</strong>
      {pending.inputs.map((input) => (
        <label key={input} className="bpmnr-field">
          <span>{input}</span>
          <input
            type="text"
            value={values[input] ?? ''}
            onChange={(event) => setValues((v) => ({ ...v, [input]: event.target.value }))}
          />
        </label>
      ))}
      <button type="submit">{t('sim.decision.evaluate')}</button>
    </form>
  );
}

/**
 * The honest stop (§5): the decision cannot be simulated — the notice names
 * the cell and the reason, and points at the documented subset. The token
 * stays where it is; there is no silent guess to continue with.
 */
export function BlockedDecisionNotice({ blocked }: { blocked: BlockedDecision }) {
  const t = useT();
  return (
    <div className="bpmnr-sim-decision-blocked" role="alert" data-testid="decision-blocked">
      <strong>⚠ {t('sim.decision.blocked')}</strong>
      <p>
        {blocked.cell ? t('sim.decision.cell', { cell: blocked.cell }) : ''}
        {blocked.reason}
      </p>
      <p>
        {t('sim.decision.seeSubset')}
        <a href="https://github.com/danzeroum/bpmn/blob/main/docs/limitations.md" target="_blank" rel="noreferrer">
          limitations.md
        </a>
        .
      </p>
    </div>
  );
}

function coerce(raw: string): number | string | boolean {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}
