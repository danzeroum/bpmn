import type { PaletteGroup, PaletteItem } from '../plugins/types.js';
import { CORE_PALETTE_ICONS } from './paletteIcons.js';
import { buildEscalationBoundaryInsert, buildEventSubprocessInsert } from './paletteInsert.js';

/** Built-in palette sections: the standard set plus the F6 event sub-menu. */
export const BUILT_IN_PALETTE_GROUPS: PaletteGroup[] = [
  { id: 'core', label: 'Core BPMN' },
  { id: 'events', label: 'Events', badge: 'F6' },
];

/** Default palette: the standard BPMN starter set, grouped. */
export const BUILT_IN_PALETTE: PaletteItem[] = [
  { id: 'startEvent', label: 'Start Event', nodeType: 'startEvent', icon: CORE_PALETTE_ICONS.startEvent, group: 'core' },
  { id: 'task', label: 'Task', nodeType: 'task', icon: CORE_PALETTE_ICONS.task, group: 'core' },
  { id: 'userTask', label: 'User Task', nodeType: 'userTask', icon: CORE_PALETTE_ICONS.userTask, group: 'core' },
  { id: 'serviceTask', label: 'Service Task', nodeType: 'serviceTask', icon: CORE_PALETTE_ICONS.serviceTask, group: 'core' },
  { id: 'sendTask', label: 'Send Task', nodeType: 'sendTask', icon: CORE_PALETTE_ICONS.sendTask, group: 'core' },
  { id: 'receiveTask', label: 'Receive Task', nodeType: 'receiveTask', icon: CORE_PALETTE_ICONS.receiveTask, group: 'core' },
  { id: 'manualTask', label: 'Manual Task', nodeType: 'manualTask', icon: CORE_PALETTE_ICONS.manualTask, group: 'core' },
  { id: 'businessRuleTask', label: 'Business Rule Task', nodeType: 'businessRuleTask', icon: CORE_PALETTE_ICONS.businessRuleTask, group: 'core' },
  { id: 'exclusiveGateway', label: 'Exclusive Gateway', nodeType: 'exclusiveGateway', icon: CORE_PALETTE_ICONS.exclusiveGateway, group: 'core' },
  { id: 'parallelGateway', label: 'Parallel Gateway', nodeType: 'parallelGateway', icon: CORE_PALETTE_ICONS.parallelGateway, group: 'core' },
  { id: 'subProcess', label: 'Sub-Process', nodeType: 'subProcess', icon: CORE_PALETTE_ICONS.subProcess, group: 'core' },
  { id: 'callActivity', label: 'Call Activity', nodeType: 'callActivity', icon: CORE_PALETTE_ICONS.callActivity, group: 'core' },
  { id: 'dataStore', label: 'Data Store', nodeType: 'dataStore', icon: CORE_PALETTE_ICONS.dataStore, group: 'core' },
  { id: 'group', label: 'Group', nodeType: 'group', icon: CORE_PALETTE_ICONS.group, group: 'core' },
  { id: 'endEvent', label: 'End Event', nodeType: 'endEvent', icon: CORE_PALETTE_ICONS.endEvent, group: 'core' },
  { id: 'pool', label: 'Pool', nodeType: 'pool', icon: CORE_PALETTE_ICONS.pool, group: 'core' },
  { id: 'lane', label: 'Lane', nodeType: 'lane', icon: CORE_PALETTE_ICONS.lane, group: 'core' },
  { id: 'intermediateCatchEvent', label: 'Intermediate Catch', nodeType: 'intermediateCatchEvent', icon: CORE_PALETTE_ICONS.intermediateCatchEvent, group: 'events' },
  { id: 'intermediateThrowEvent', label: 'Intermediate Throw', nodeType: 'intermediateThrowEvent', icon: CORE_PALETTE_ICONS.intermediateThrowEvent, group: 'events' },
  { id: 'timerEvent', label: 'Timer Event', nodeType: 'intermediateCatchEvent', icon: CORE_PALETTE_ICONS.timerEvent, defaultProperties: { eventDefinition: 'timer' }, group: 'events' },
  { id: 'messageEvent', label: 'Message Event', nodeType: 'intermediateCatchEvent', icon: CORE_PALETTE_ICONS.messageEvent, defaultProperties: { eventDefinition: 'message' }, group: 'events' },
  { id: 'boundaryNonInterrupting', label: 'Boundary (NI)', nodeType: 'boundaryEvent', icon: CORE_PALETTE_ICONS.boundaryNonInterrupting, defaultProperties: { cancelActivity: false }, group: 'events' },
  // Handoff 17 ES-2 (§4b): composite item — container + typed start + named
  // definition in ONE undo, lint-clean by construction (the 4d fix's FORM).
  { id: 'eventSubprocess', label: 'Event Subprocess', nodeType: 'subProcess', icon: CORE_PALETTE_ICONS.eventSubprocess, group: 'events', build: buildEventSubprocessInsert },
  // Handoff 18 ES-2 mould (§5b, decisão 3): composite escalation boundary —
  // boundary + local definition + ref, cancelActivity:false explicit; the drop
  // must land on a host activity (reforço 7) or it declines with a veto.
  { id: 'escalationBoundary', label: 'Escalation (boundary)', nodeType: 'boundaryEvent', icon: CORE_PALETTE_ICONS.escalationBoundary, group: 'events', build: buildEscalationBoundaryInsert },
  { id: 'eventBasedGateway', label: 'Event Gateway', nodeType: 'eventBasedGateway', icon: CORE_PALETTE_ICONS.eventBasedGateway, group: 'events' },
];
