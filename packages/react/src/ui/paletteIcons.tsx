import type { ReactNode } from 'react';

/**
 * Line icons for the built-in palette (BTV Notation sheet §07): 18px grid,
 * 1.5 stroke, `currentColor` so they follow the button's text color in both
 * themes. Purely presentational — consumers can still pass any ReactNode.
 */
function Icon({ strokeWidth = 1.5, children }: { strokeWidth?: number; children: ReactNode }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const CORE_PALETTE_ICONS: Record<string, ReactNode> = {
  startEvent: (
    <Icon>
      <circle cx={9} cy={9} r={6.5} />
    </Icon>
  ),
  endEvent: (
    <Icon strokeWidth={2.4}>
      <circle cx={9} cy={9} r={6} />
    </Icon>
  ),
  intermediateCatchEvent: (
    <Icon>
      <circle cx={9} cy={9} r={6.5} />
      <circle cx={9} cy={9} r={4.2} strokeWidth={1.2} />
    </Icon>
  ),
  intermediateThrowEvent: (
    <Icon>
      <circle cx={9} cy={9} r={6.5} />
      <circle cx={9} cy={9} r={2.4} fill="currentColor" stroke="none" />
    </Icon>
  ),
  timerEvent: (
    <Icon>
      <circle cx={9} cy={9} r={6.5} />
      <path d="M 9 5.8 V 9 L 11.4 10.6" strokeWidth={1.3} />
    </Icon>
  ),
  messageEvent: (
    <Icon>
      <circle cx={9} cy={9} r={6.5} />
      <rect x={5.8} y={6.9} width={6.4} height={4.4} rx={0.8} strokeWidth={1.1} />
      <path d="M 6.1 7.4 L 9 9.4 L 11.9 7.4" strokeWidth={1.1} />
    </Icon>
  ),
  boundaryNonInterrupting: (
    <Icon>
      <circle cx={9} cy={9} r={6.5} strokeDasharray="2.8,2.2" strokeWidth={1.3} />
      <circle cx={9} cy={9} r={4.2} strokeDasharray="2.2,1.8" strokeWidth={1.1} />
    </Icon>
  ),
  task: (
    <Icon>
      <rect x={2.5} y={4.75} width={13} height={8.5} rx={2} />
    </Icon>
  ),
  userTask: (
    <Icon>
      <circle cx={9} cy={6.2} r={2.6} />
      <path d="M 3.8 14.5 C 3.8 10.8 14.2 10.8 14.2 14.5" />
    </Icon>
  ),
  serviceTask: (
    <Icon>
      <circle cx={9} cy={9} r={2.6} />
      <path
        d="M 15 9 H 13.2 M 9 15 V 13.2 M 3 9 H 4.8 M 9 3 V 4.8 M 13.24 13.24 L 11.97 11.97 M 4.76 13.24 L 6.03 11.97 M 4.76 4.76 L 6.03 6.03 M 13.24 4.76 L 11.97 6.03"
        strokeWidth={1.3}
      />
    </Icon>
  ),
  sendTask: (
    <Icon>
      <rect x={2.5} y={5} width={13} height={8} rx={1} fill="currentColor" />
      <path d="M 3 5.75 L 9 10 L 15 5.75" stroke="var(--bpmnr-panel-bg, #ffffff)" strokeWidth={1.3} />
    </Icon>
  ),
  receiveTask: (
    <Icon>
      <rect x={2.5} y={5} width={13} height={8} rx={1} />
      <path d="M 3 5.75 L 9 10 L 15 5.75" strokeWidth={1.3} />
    </Icon>
  ),
  manualTask: (
    <Icon strokeWidth={1.3}>
      <path d="M 6 13.5 V 6.8 a 1 1 0 0 1 2 0 V 9 M 8 8.2 V 5.6 a 1 1 0 0 1 2 0 V 9 M 10 8.6 V 6.6 a 1 1 0 0 1 2 0 V 9.5 Q 12 13.5 9.5 13.5 H 8.5 Q 6 13.5 6 11" />
    </Icon>
  ),
  exclusiveGateway: (
    <Icon>
      <path d="M 9 2.8 L 15.2 9 L 9 15.2 L 2.8 9 Z" />
      <path d="M 6.9 6.9 L 11.1 11.1 M 11.1 6.9 L 6.9 11.1" strokeWidth={1.3} />
    </Icon>
  ),
  parallelGateway: (
    <Icon>
      <path d="M 9 2.8 L 15.2 9 L 9 15.2 L 2.8 9 Z" />
      <path d="M 9 5.8 V 12.2 M 5.8 9 H 12.2" strokeWidth={1.3} />
    </Icon>
  ),
  eventBasedGateway: (
    <Icon>
      <path d="M 9 2.8 L 15.2 9 L 9 15.2 L 2.8 9 Z" />
      <circle cx={9} cy={9} r={3.1} strokeWidth={1.1} />
      <circle cx={9} cy={9} r={2} strokeWidth={1.1} />
    </Icon>
  ),
  subProcess: (
    <Icon>
      <rect x={2.5} y={4} width={13} height={10} rx={2} />
      <rect x={7.5} y={10.6} width={3} height={2.6} rx={0.5} strokeWidth={1.1} />
      <path d="M 9 11.3 V 13.2 M 8.3 12.25 H 9.7" strokeWidth={1.1} />
    </Icon>
  ),
  businessRuleTask: (
    <Icon>
      <rect x={2.5} y={4.75} width={13} height={8.5} rx={2} />
      <path d="M 2.5 8 H 15.5 M 7 8 V 13.25" strokeWidth={1.2} />
    </Icon>
  ),
  callActivity: (
    <Icon strokeWidth={2.2}>
      <rect x={2.5} y={4} width={13} height={10} rx={2} />
      <path d="M 9 10.6 V 13 M 7.8 11.8 H 10.2" strokeWidth={1.1} />
    </Icon>
  ),
  dataStore: (
    <Icon>
      <path d="M 3.5 5 A 5.5 1.8 0 0 1 14.5 5 V 13 A 5.5 1.8 0 0 1 3.5 13 Z" />
      <path d="M 3.5 5 A 5.5 1.8 0 0 0 14.5 5" strokeWidth={1.1} />
    </Icon>
  ),
  group: (
    <Icon>
      <rect x={3} y={3.5} width={12} height={11} rx={2.5} strokeDasharray="3,2.4" />
    </Icon>
  ),
  pool: (
    <Icon>
      <rect x={2} y={4.5} width={14} height={9} />
      <path d="M 5 4.5 V 13.5 M 5 9 H 16" strokeWidth={1.2} />
    </Icon>
  ),
  lane: (
    <Icon>
      <rect x={2} y={6} width={14} height={6} rx={1} />
      <path d="M 4.8 6 V 12" strokeWidth={1.2} />
    </Icon>
  ),
};
