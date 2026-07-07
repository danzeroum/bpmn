import type { PaletteItem } from '../plugins/types.js';

/** Default palette: the standard BPMN starter set. */
export const BUILT_IN_PALETTE: PaletteItem[] = [
  { id: 'startEvent', label: 'Start Event', nodeType: 'startEvent', icon: '◯' },
  { id: 'intermediateCatchEvent', label: 'Intermediate Catch', nodeType: 'intermediateCatchEvent', icon: '◎' },
  { id: 'intermediateThrowEvent', label: 'Intermediate Throw', nodeType: 'intermediateThrowEvent', icon: '⦾' },
  { id: 'timerEvent', label: 'Timer Event', nodeType: 'intermediateCatchEvent', icon: '⏲', defaultProperties: { eventDefinition: 'timer' } },
  { id: 'task', label: 'Task', nodeType: 'task', icon: '▭' },
  { id: 'userTask', label: 'User Task', nodeType: 'userTask', icon: '👤' },
  { id: 'serviceTask', label: 'Service Task', nodeType: 'serviceTask', icon: '⚙' },
  { id: 'exclusiveGateway', label: 'Exclusive Gateway', nodeType: 'exclusiveGateway', icon: '◇' },
  { id: 'parallelGateway', label: 'Parallel Gateway', nodeType: 'parallelGateway', icon: '✚' },
  { id: 'subProcess', label: 'Sub-Process', nodeType: 'subProcess', icon: '⧉' },
  { id: 'endEvent', label: 'End Event', nodeType: 'endEvent', icon: '◉' },
  { id: 'pool', label: 'Pool', nodeType: 'pool', icon: '▤' },
  { id: 'lane', label: 'Lane', nodeType: 'lane', icon: '▬' },
];
