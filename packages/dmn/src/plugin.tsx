import type { ReactNode } from 'react';
import type { BpmnPlugin } from '@bpmn-react/react';
import { DMN_NODE_TYPES } from './model.js';
import {
  DmnBusinessKnowledgeModelShape,
  DmnDecisionShape,
  DmnInputDataShape,
  DmnKnowledgeSourceShape,
} from './shapes.js';

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
 * The DMN family plugin (Handoff 5 §4): DRD node types + shapes, the three
 * requirement edge styles (one family color, straight routing, form-coded
 * tips) and the DMN palette group. Claims the 185° step of the color wheel
 * (§7.3) and declares its body color so the plugin lint can enforce the
 * gold/green reserve (§10.3).
 */
export const dmnPlugin: BpmnPlugin = {
  id: 'bpmn-react/dmn',
  name: 'DMN (DRD)',
  colorWheelDegree: 185,
  bodyColor: 'var(--btv-dmn-fill, #e2f0ee)',
  nodeTypes: DMN_NODE_TYPES,
  shapes: {
    'dmn:decision': DmnDecisionShape,
    'dmn:inputData': DmnInputDataShape,
    'dmn:knowledgeSource': DmnKnowledgeSourceShape,
    'dmn:businessKnowledgeModel': DmnBusinessKnowledgeModelShape,
  },
  edgeStyles: {
    'dmn:informationRequirement': {
      stroke: 'var(--btv-dmn-edge, #26766b)',
      marker: 'filled',
      routing: 'straight',
    },
    'dmn:knowledgeRequirement': {
      stroke: 'var(--btv-dmn-edge, #26766b)',
      dash: '5,4',
      marker: 'open',
      routing: 'straight',
    },
    'dmn:authorityRequirement': {
      stroke: 'var(--btv-dmn-edge, #26766b)',
      dash: '2,4',
      marker: 'disc',
      routing: 'straight',
    },
  },
  paletteGroups: [{ id: 'dmn', label: 'DMN', badge: '185°' }],
  paletteItems: [
    {
      id: 'dmn:decision',
      label: 'Decision',
      nodeType: 'dmn:decision',
      group: 'dmn',
      icon: (
        <Icon>
          <rect x={2.5} y={5} width={13} height={8} />
          <path d="M 2.5 8 H 15.5 M 7 8 V 13" strokeWidth={1.1} />
        </Icon>
      ),
    },
    {
      id: 'dmn:inputData',
      label: 'Input Data',
      nodeType: 'dmn:inputData',
      group: 'dmn',
      icon: (
        <Icon>
          <rect x={2.5} y={5.5} width={13} height={7} rx={3.5} />
        </Icon>
      ),
    },
    {
      id: 'dmn:knowledgeSource',
      label: 'Knowledge Source',
      nodeType: 'dmn:knowledgeSource',
      group: 'dmn',
      icon: (
        <Icon>
          <path d="M 2.5 4 H 15.5 V 12 C 12 10, 11 14, 9 12 C 7 10, 6 14, 2.5 12 Z" />
        </Icon>
      ),
    },
    {
      id: 'dmn:businessKnowledgeModel',
      label: 'Knowledge Model',
      nodeType: 'dmn:businessKnowledgeModel',
      group: 'dmn',
      icon: (
        <Icon>
          <polygon points="6,4.5 15.5,4.5 15.5,10 12,13.5 2.5,13.5 2.5,8" />
          <path d="M 6 4.5 L 6 8 L 2.5 8" strokeWidth={1} />
        </Icon>
      ),
    },
  ],
};
