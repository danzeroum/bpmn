import { useState } from 'react';
import type { Decision, PendingChoice } from '@buildtovalue/simulation';
import { useT } from '../i18n/I18nContext.js';

export interface GatewayChoiceCardProps {
  choice: PendingChoice;
  gatewayLabel: string;
  onChoose: (decision: Decision) => void;
}

/** Touch targets are ≥44px (Handoff 7 §8 / WCAG 2.5.5). */
const TOUCH = 44;

/**
 * The gateway choice, as a floating card at the **base of the canvas** — never
 * a popover on the node, so a finger never occludes the diagram (Handoff 7A
 * §3, touch-first). One ≥44px button per outgoing flow; the inclusive (OR)
 * gateway is a multi-select with an explicit confirm.
 */
export function GatewayChoiceCard({ choice, gatewayLabel, onChoose }: GatewayChoiceCardProps) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (edgeId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      return next;
    });

  return (
    <div className="bpmnr-sim-choice" role="group" aria-label={t('sim.gateway.aria', { label: gatewayLabel })} data-sim-choice>
      <span className="bpmnr-sim-choice-title">
        {t('sim.gateway.chooseExit', { label: gatewayLabel })}
      </span>
      <div className="bpmnr-sim-choice-options">
        {choice.options.map((option) =>
          choice.multiple ? (
            <button
              key={option.edgeId}
              type="button"
              data-sim-choice-option={option.edgeId}
              aria-pressed={selected.has(option.edgeId)}
              onClick={() => toggle(option.edgeId)}
              className="bpmnr-sim-choice-btn"
              data-selected={selected.has(option.edgeId) || undefined}
              style={{ minHeight: TOUCH, minWidth: TOUCH }}
            >
              {selected.has(option.edgeId) ? '☑ ' : '☐ '}
              {option.label}
            </button>
          ) : (
            <button
              key={option.edgeId}
              type="button"
              data-sim-choice-option={option.edgeId}
              onClick={() =>
                onChoose({
                  // Non-multiple ⇒ kind is exclusive | eventBased (never inclusive).
                  kind: choice.kind as 'exclusive' | 'eventBased',
                  gateway: choice.nodeId,
                  edge: option.edgeId,
                })
              }
              className="bpmnr-sim-choice-btn"
              style={{ minHeight: TOUCH, minWidth: TOUCH }}
            >
              {option.label}
            </button>
          ),
        )}
      </div>
      {choice.multiple && (
        <button
          type="button"
          data-sim-choice-confirm
          disabled={selected.size === 0}
          onClick={() => onChoose({ kind: 'inclusive', gateway: choice.nodeId, edges: [...selected] })}
          className="bpmnr-sim-choice-btn bpmnr-sim-choice-confirm"
          style={{ minHeight: TOUCH }}
        >
          {t('sim.choice.confirm', { n: selected.size })}
        </button>
      )}
      {choice.approximate && (
        <span className="bpmnr-sim-approx" data-sim-approx>
          {t('sim.choice.approx')}
        </span>
      )}
    </div>
  );
}
