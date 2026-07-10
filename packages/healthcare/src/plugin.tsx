import type { ReactNode } from 'react';
import { activeNodes, type BpmnDiagram, type ValidationIssue, type ValidationRule } from '@buildtovalue/core';
import type { BpmnPlugin } from '@buildtovalue/react';
import { HC_NODE_TYPES } from './model.js';
import {
  ClinicalDecisionShape,
  ClinicalTaskShape,
  GuidelineShape,
  PathwayGateShape,
} from './shapes.js';

/** Stable code surfaced by Validate for unlinked clinical decisions (§6). */
export const HC_DECISION_UNLINKED = 'HC_DECISION_UNLINKED';

/**
 * Visible validation (§6): a clinical decision without a linked DMN table
 * warns — the shape already shows the amber ▲ chip in the badge slot; this
 * rule carries the same fact into Validate/promotion surfaces.
 */
export const clinicalDecisionLinkedRule: ValidationRule = (diagram: BpmnDiagram) => {
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram).filter((n) => n.type === 'hc:clinicalDecision')) {
    if (typeof node.properties.decisionRef !== 'string' || node.properties.decisionRef === '') {
      issues.push({
        code: HC_DECISION_UNLINKED,
        severity: 'warning',
        message: `Decisão clínica "${node.label}" sem tabela DMN vinculada`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * The healthcare pack (Handoff 5 §6): 305° clinical-violet step of the
 * family wheel, clinical vocabulary mapped to interoperable BPMN elements
 * (`bpmnr:meta type` preserves identity), and the visible validation for
 * unlinked clinical decisions. Declares its body color so the plugin lint
 * enforces the gold/green reserve (§10.3).
 */
export const healthcarePlugin: BpmnPlugin = {
  id: 'bpmn-react/healthcare',
  name: 'Healthcare',
  colorWheelDegree: 305,
  bodyColor: 'var(--btv-hc-fill, #f2e9f6)',
  nodeTypes: HC_NODE_TYPES,
  shapes: {
    'hc:clinicalTask': ClinicalTaskShape,
    'hc:clinicalDecision': ClinicalDecisionShape,
    'hc:guideline': GuidelineShape,
    'hc:pathwayGate': PathwayGateShape,
  },
  validationRules: [clinicalDecisionLinkedRule],
  paletteGroups: [{ id: 'healthcare', label: 'HEALTHCARE', badge: '305°' }],
  paletteItems: [
    {
      id: 'hc:clinicalTask',
      label: 'Clinical Task',
      nodeType: 'hc:clinicalTask',
      group: 'healthcare',
      icon: (
        <Icon>
          <rect x={2.5} y={4} width={13} height={10} rx={2} />
          <path d="M 9 7 V 11 M 7 9 H 11" />
        </Icon>
      ),
    },
    {
      id: 'hc:clinicalDecision',
      label: 'Clinical Decision',
      nodeType: 'hc:clinicalDecision',
      group: 'healthcare',
      icon: (
        <Icon>
          <rect x={2.5} y={4} width={13} height={10} rx={2} />
          <path d="M 2.5 7.5 H 15.5 M 7 7.5 V 14" strokeWidth={1.1} />
        </Icon>
      ),
    },
    {
      id: 'hc:guideline',
      label: 'Guideline',
      nodeType: 'hc:guideline',
      group: 'healthcare',
      icon: (
        <Icon>
          <path d="M 4 2.5 H 11.5 L 14.5 5.5 V 15.5 H 4 Z" />
          <path d="M 11.5 2.5 V 5.5 H 14.5" strokeWidth={1.1} />
        </Icon>
      ),
    },
    {
      id: 'hc:pathwayGate',
      label: 'Pathway Gate',
      nodeType: 'hc:pathwayGate',
      group: 'healthcare',
      icon: (
        <Icon>
          <polygon points="9,2 16,9 9,16 2,9" />
        </Icon>
      ),
    },
  ],
};
