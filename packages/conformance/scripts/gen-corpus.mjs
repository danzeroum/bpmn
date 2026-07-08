/**
 * Interoperability corpus generator (Handoff 4 §A1).
 *
 * The corpus files are STRUCTURAL EQUIVALENTS of real-world exports
 * (Camunda Modeler, bpmn.io demos, OMG spec examples): same element mix,
 * namespaces, DI layout conventions and quirks — but generated content, so
 * no proprietary material is redistributed (allowed explicitly by the
 * handoff when originals cannot be included). Each file header documents
 * the pattern it mirrors.
 *
 * Deterministic: re-running produces byte-identical files.
 *   node scripts/gen-corpus.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus');
mkdirSync(OUT, { recursive: true });

const NS =
  'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
  'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
  'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ' +
  'xmlns:di="http://www.omg.org/spec/DD/20100524/DI"';

/** Node: { tag, id, name?, attrs?, children?, w?, h? } laid out on a grid. */
function processXml(defId, procId, nodes, flows, { collaboration, laneSet } = {}) {
  const size = (n) =>
    n.w
      ? [n.w, n.h]
      : n.tag.endsWith('Event')
        ? [36, 36]
        : n.tag.endsWith('Gateway')
          ? [50, 50]
          : [120, 60];
  const pos = new Map();
  nodes.forEach((n, index) => {
    const col = index % 6;
    const row = Math.floor(index / 6);
    pos.set(n.id, { x: 160 + col * 170, y: 100 + row * 140 });
  });

  const nodeXml = nodes
    .map((n) => {
      const attrs = [
        `id="${n.id}"`,
        n.name ? `name="${n.name}"` : '',
        ...(n.attrs ? Object.entries(n.attrs).map(([k, v]) => `${k}="${v}"`) : []),
      ]
        .filter(Boolean)
        .join(' ');
      return n.children
        ? `    <bpmn:${n.tag} ${attrs}>\n${n.children.map((c) => `      ${c}`).join('\n')}\n    </bpmn:${n.tag}>`
        : `    <bpmn:${n.tag} ${attrs} />`;
    })
    .join('\n');

  const flowXml = flows
    .map(
      (f) =>
        `    <bpmn:${f.tag ?? 'sequenceFlow'} id="${f.id}" sourceRef="${f.source}" targetRef="${f.target}"${
          f.name ? ` name="${f.name}"` : ''
        } />`,
    )
    .join('\n');

  const shapes = nodes
    .map((n) => {
      const [w, h] = size(n);
      const p = pos.get(n.id);
      return `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">\n        <dc:Bounds x="${p.x}" y="${p.y}" width="${w}" height="${h}" />\n      </bpmndi:BPMNShape>`;
    })
    .join('\n');
  const diEdges = flows
    .map((f) => {
      const a = pos.get(f.source) ?? { x: 0, y: 0 };
      const b = pos.get(f.target) ?? { x: 0, y: 0 };
      return `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n        <di:waypoint x="${a.x + 60}" y="${a.y + 30}" />\n        <di:waypoint x="${b.x}" y="${b.y + 30}" />\n      </bpmndi:BPMNEdge>`;
    })
    .join('\n');

  return `<bpmn:definitions ${NS} id="${defId}" targetNamespace="http://bpmn.io/schema/bpmn">
${collaboration ?? ''}  <bpmn:process id="${procId}" isExecutable="true">
${laneSet ?? ''}${nodeXml}
${flowXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="${defId}_diagram">
    <bpmndi:BPMNPlane id="${defId}_plane" bpmnElement="${collaboration ? 'Collab_1' : procId}">
${shapes}
${diEdges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

function header(source, description) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!--\n  Interoperability corpus (bpmn-react). Structural equivalent of: ${source}.\n  Pattern: ${description}.\n  Generated content (scripts/gen-corpus.mjs) - no proprietary material.\n  License: Apache-2.0.\n-->\n`;
}

const chain = (ids) =>
  ids.slice(0, -1).map((id, index) => ({ id: `Flow_${id}_${ids[index + 1]}`, source: id, target: ids[index + 1] }));

/** Scenario builders — each takes a variant index for structural diversity. */
const SCENARIOS = [
  {
    name: 'linear-approval',
    source: 'Camunda Modeler quickstart export',
    description: 'start -> user task -> service task -> end',
    build: (v) =>
      processXml(`Definitions_lin${v}`, `Process_lin${v}`, [
        { tag: 'startEvent', id: 'Start_1', name: 'Request received' },
        { tag: 'userTask', id: 'Task_review', name: `Review request ${v}` },
        { tag: 'serviceTask', id: 'Task_persist', name: 'Persist decision' },
        ...(v > 0 ? [{ tag: 'manualTask', id: 'Task_file', name: 'File paperwork' }] : []),
        { tag: 'endEvent', id: 'End_1', name: 'Done' },
      ], chain(v > 0 ? ['Start_1', 'Task_review', 'Task_persist', 'Task_file', 'End_1'] : ['Start_1', 'Task_review', 'Task_persist', 'End_1'])),
  },
  {
    name: 'exclusive-gateway',
    source: 'bpmn.io starter diagram',
    description: 'XOR split/join with named flows',
    build: (v) =>
      processXml(`Definitions_xor${v}`, `Process_xor${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'exclusiveGateway', id: 'Gw_split', name: 'Approved?' },
        { tag: 'task', id: 'Task_yes', name: 'Fulfil' },
        { tag: 'task', id: 'Task_no', name: `Reject (${v})` },
        { tag: 'exclusiveGateway', id: 'Gw_join' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Gw_split' },
        { id: 'Flow_yes', source: 'Gw_split', target: 'Task_yes', name: 'yes' },
        { id: 'Flow_no', source: 'Gw_split', target: 'Task_no', name: 'no' },
        { id: 'Flow_3', source: 'Task_yes', target: 'Gw_join' },
        { id: 'Flow_4', source: 'Task_no', target: 'Gw_join' },
        { id: 'Flow_5', source: 'Gw_join', target: 'End_1' },
      ]),
  },
  {
    name: 'parallel-fork',
    source: 'Camunda Modeler example export',
    description: 'AND split/join, parallel service tasks',
    build: (v) =>
      processXml(`Definitions_and${v}`, `Process_and${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'parallelGateway', id: 'Gw_fork' },
        { tag: 'serviceTask', id: 'Task_a', name: 'Charge card' },
        { tag: 'serviceTask', id: 'Task_b', name: `Reserve stock ${v}` },
        ...(v > 1 ? [{ tag: 'serviceTask', id: 'Task_c', name: 'Notify CRM' }] : []),
        { tag: 'parallelGateway', id: 'Gw_join' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Gw_fork' },
        { id: 'Flow_a', source: 'Gw_fork', target: 'Task_a' },
        { id: 'Flow_b', source: 'Gw_fork', target: 'Task_b' },
        ...(v > 1 ? [{ id: 'Flow_c', source: 'Gw_fork', target: 'Task_c' }, { id: 'Flow_c2', source: 'Task_c', target: 'Gw_join' }] : []),
        { id: 'Flow_a2', source: 'Task_a', target: 'Gw_join' },
        { id: 'Flow_b2', source: 'Task_b', target: 'Gw_join' },
        { id: 'Flow_2', source: 'Gw_join', target: 'End_1' },
      ]),
  },
  {
    name: 'inclusive-gateway',
    source: 'OMG BPMN 2.0 spec example (order handling)',
    description: 'OR split with default-style continuation',
    build: (v) =>
      processXml(`Definitions_or${v}`, `Process_or${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'inclusiveGateway', id: 'Gw_or', name: 'Extras?' },
        { tag: 'task', id: 'Task_wrap', name: 'Gift wrap' },
        { tag: 'task', id: 'Task_note', name: `Add note v${v}` },
        { tag: 'inclusiveGateway', id: 'Gw_merge' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Gw_or' },
        { id: 'Flow_w', source: 'Gw_or', target: 'Task_wrap' },
        { id: 'Flow_n', source: 'Gw_or', target: 'Task_note' },
        { id: 'Flow_w2', source: 'Task_wrap', target: 'Gw_merge' },
        { id: 'Flow_n2', source: 'Task_note', target: 'Gw_merge' },
        { id: 'Flow_2', source: 'Gw_merge', target: 'End_1' },
      ]),
  },
  {
    name: 'event-based-gateway',
    source: 'Camunda docs pattern (race between message and timer)',
    description: 'event gateway -> message catch | timer catch',
    build: (v) =>
      processXml(`Definitions_evgw${v}`, `Process_evgw${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'eventBasedGateway', id: 'Gw_race' },
        { tag: 'intermediateCatchEvent', id: 'Catch_msg', name: 'Reply', children: ['<bpmn:messageEventDefinition id="Md_1" />'] },
        { tag: 'intermediateCatchEvent', id: 'Catch_timer', name: `Timeout ${v}h`, children: ['<bpmn:timerEventDefinition id="Td_1" />'] },
        { tag: 'task', id: 'Task_go', name: 'Proceed' },
        { tag: 'task', id: 'Task_remind', name: 'Send reminder' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Gw_race' },
        { id: 'Flow_m', source: 'Gw_race', target: 'Catch_msg' },
        { id: 'Flow_t', source: 'Gw_race', target: 'Catch_timer' },
        { id: 'Flow_m2', source: 'Catch_msg', target: 'Task_go' },
        { id: 'Flow_t2', source: 'Catch_timer', target: 'Task_remind' },
        { id: 'Flow_g', source: 'Task_go', target: 'End_1' },
        { id: 'Flow_r', source: 'Task_remind', target: 'End_1' },
      ]),
  },
  {
    name: 'boundary-events',
    source: 'Camunda Modeler export with attached events',
    description: 'interrupting timer + non-interrupting message boundaries',
    build: (v) =>
      processXml(`Definitions_bnd${v}`, `Process_bnd${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'userTask', id: 'Task_work', name: `Long running work ${v}` },
        { tag: 'boundaryEvent', id: 'Bnd_timer', name: 'Deadline', attrs: { attachedToRef: 'Task_work' }, children: ['<bpmn:timerEventDefinition id="Td_b" />'] },
        { tag: 'boundaryEvent', id: 'Bnd_msg', name: 'Update', attrs: { attachedToRef: 'Task_work', cancelActivity: 'false' }, children: ['<bpmn:messageEventDefinition id="Md_b" />'] },
        { tag: 'task', id: 'Task_escalate', name: 'Escalate' },
        { tag: 'task', id: 'Task_log', name: 'Log update' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Task_work' },
        { id: 'Flow_2', source: 'Task_work', target: 'End_1' },
        { id: 'Flow_esc', source: 'Bnd_timer', target: 'Task_escalate' },
        { id: 'Flow_log', source: 'Bnd_msg', target: 'Task_log' },
        { id: 'Flow_e2', source: 'Task_escalate', target: 'End_1' },
        { id: 'Flow_l2', source: 'Task_log', target: 'End_1' },
      ]),
  },
  {
    name: 'typed-throw-events',
    source: 'OMG spec examples (signals and escalations)',
    description: 'signal/escalation/link throw events + terminate end',
    build: (v) =>
      processXml(`Definitions_thr${v}`, `Process_thr${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'intermediateThrowEvent', id: 'Throw_signal', name: 'Broadcast', children: ['<bpmn:signalEventDefinition id="Sd_1" />'] },
        { tag: 'intermediateThrowEvent', id: 'Throw_esc', name: `Escalate ${v}`, children: ['<bpmn:escalationEventDefinition id="Ed_1" />'] },
        ...(v > 0 ? [{ tag: 'intermediateThrowEvent', id: 'Throw_link', name: 'Jump', children: ['<bpmn:linkEventDefinition id="Ld_1" />'] }] : []),
        { tag: 'endEvent', id: 'End_term', name: 'Kill all', children: ['<bpmn:terminateEventDefinition id="Kd_1" />'] },
      ], chain(v > 0 ? ['Start_1', 'Throw_signal', 'Throw_esc', 'Throw_link', 'End_term'] : ['Start_1', 'Throw_signal', 'Throw_esc', 'End_term'])),
  },
  {
    name: 'error-conditional',
    source: 'Camunda docs pattern (error handling)',
    description: 'error boundary + conditional catch',
    build: (v) =>
      processXml(`Definitions_err${v}`, `Process_err${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'serviceTask', id: 'Task_call', name: `Call API ${v}` },
        { tag: 'boundaryEvent', id: 'Bnd_err', name: 'Failed', attrs: { attachedToRef: 'Task_call' }, children: ['<bpmn:errorEventDefinition id="ErrD_1" />'] },
        { tag: 'intermediateCatchEvent', id: 'Catch_cond', name: 'Quota OK', children: ['<bpmn:conditionalEventDefinition id="Cd_1" />'] },
        { tag: 'task', id: 'Task_retry', name: 'Retry later' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Task_call' },
        { id: 'Flow_2', source: 'Task_call', target: 'Catch_cond' },
        { id: 'Flow_3', source: 'Catch_cond', target: 'End_1' },
        { id: 'Flow_e', source: 'Bnd_err', target: 'Task_retry' },
        { id: 'Flow_r', source: 'Task_retry', target: 'End_1' },
      ]),
  },
  {
    name: 'subprocess',
    source: 'Camunda Modeler embedded sub-process export',
    description: 'expanded subProcess with inner start/task/end and child DI',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_sub${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_sub${v}" isExecutable="true">
    <bpmn:startEvent id="Start_1" />
    <bpmn:subProcess id="Sub_1" name="Handle order ${v}">
      <bpmn:startEvent id="Sub_start" />
      <bpmn:task id="Sub_task" name="Pick items" />
      <bpmn:endEvent id="Sub_end" />
      <bpmn:sequenceFlow id="Sub_f1" sourceRef="Sub_start" targetRef="Sub_task" />
      <bpmn:sequenceFlow id="Sub_f2" sourceRef="Sub_task" targetRef="Sub_end" />
    </bpmn:subProcess>
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Sub_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Sub_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_sub${v}">
    <bpmndi:BPMNPlane id="Plane_sub${v}" bpmnElement="Process_sub${v}">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="160" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_1_di" bpmnElement="Sub_1" isExpanded="true">
        <dc:Bounds x="260" y="100" width="420" height="220" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_start_di" bpmnElement="Sub_start">
        <dc:Bounds x="290" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_task_di" bpmnElement="Sub_task">
        <dc:Bounds x="380" y="170" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_end_di" bpmnElement="Sub_end">
        <dc:Bounds x="560" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="740" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Sub_f1_di" bpmnElement="Sub_f1">
        <di:waypoint x="326" y="200" />
        <di:waypoint x="380" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Sub_f2_di" bpmnElement="Sub_f2">
        <di:waypoint x="500" y="200" />
        <di:waypoint x="560" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="196" y="210" />
        <di:waypoint x="260" y="210" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="680" y="210" />
        <di:waypoint x="740" y="210" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`,
  },
  {
    name: 'loop-markers',
    source: 'Camunda Modeler export with loop characteristics',
    description: 'standard loop + sequential/parallel multi-instance',
    build: (v) =>
      processXml(`Definitions_loop${v}`, `Process_loop${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'task', id: 'Task_loop', name: 'Poll status', children: ['<bpmn:standardLoopCharacteristics id="Lc_1" />'] },
        { tag: 'userTask', id: 'Task_mi', name: `Approve items ${v}`, children: [`<bpmn:multiInstanceLoopCharacteristics id="Mi_1"${v % 2 === 0 ? ' isSequential="true"' : ''} />`] },
        { tag: 'endEvent', id: 'End_1' },
      ], chain(['Start_1', 'Task_loop', 'Task_mi', 'End_1'])),
  },
  {
    name: 'data-artifacts',
    source: 'OMG spec example (artifacts)',
    description: 'data object + association + text annotation + group',
    build: (v) =>
      processXml(`Definitions_data${v}`, `Process_data${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'task', id: 'Task_fill', name: `Fill form ${v}` },
        { tag: 'dataObjectReference', id: 'Data_form', name: 'Form', w: 36, h: 50 },
        { tag: 'textAnnotation', id: 'Note_1', w: 120, h: 40, children: ['<bpmn:text>Reviewed quarterly</bpmn:text>'] },
        { tag: 'group', id: 'Group_1', w: 220, h: 140 },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Task_fill' },
        { id: 'Flow_2', source: 'Task_fill', target: 'End_1' },
        { id: 'Assoc_1', tag: 'association', source: 'Task_fill', target: 'Note_1' },
        { id: 'Assoc_2', tag: 'association', source: 'Task_fill', target: 'Data_form' },
      ]),
  },
  {
    name: 'send-receive',
    source: 'Camunda docs messaging pattern',
    description: 'sendTask/receiveTask pair with script post-processing',
    build: (v) =>
      processXml(`Definitions_msg${v}`, `Process_msg${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'sendTask', id: 'Task_send', name: `Send quote ${v}` },
        { tag: 'receiveTask', id: 'Task_recv', name: 'Await answer' },
        { tag: 'scriptTask', id: 'Task_calc', name: 'Compute totals' },
        { tag: 'endEvent', id: 'End_1' },
      ], chain(['Start_1', 'Task_send', 'Task_recv', 'Task_calc', 'End_1'])),
  },
  {
    name: 'degraded-elements',
    source: 'Signavio-style export with elements outside the profile',
    description: 'complexGateway degrades with a warning; businessRuleTask (F-A) and callActivity (F7-3) import natively',
    build: (v) =>
      processXml(`Definitions_deg${v}`, `Process_deg${v}`, [
        { tag: 'startEvent', id: 'Start_1' },
        { tag: 'businessRuleTask', id: 'Task_rules', name: `Score ${v}` },
        { tag: 'complexGateway', id: 'Gw_complex' },
        { tag: 'callActivity', id: 'Call_1', name: 'Shared subflow' },
        { tag: 'task', id: 'Task_ok', name: 'Continue' },
        { tag: 'endEvent', id: 'End_1' },
      ], [
        { id: 'Flow_1', source: 'Start_1', target: 'Task_ok' },
        { id: 'Flow_2', source: 'Task_ok', target: 'End_1' },
      ]),
  },
  {
    name: 'no-di',
    source: 'headless engine export (no diagram interchange)',
    description: 'model without BPMNDI — automatic layout warning expected',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_nodi${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_nodi${v}" isExecutable="true">
    <bpmn:startEvent id="Start_1" />
    <bpmn:task id="Task_a" name="Step A${v}" />
    <bpmn:task id="Task_b" name="Step B" />
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_a" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_a" targetRef="Task_b" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_b" targetRef="End_1" />
  </bpmn:process>
</bpmn:definitions>
`,
  },
  {
    name: 'collaboration-lanes',
    source: 'Camunda Modeler collaboration export',
    description: 'participant pool + two lanes + flowNodeRefs',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_col${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Pool_ops" name="Operations ${v}" processRef="Process_col${v}" />
  </bpmn:collaboration>
  <bpmn:process id="Process_col${v}" isExecutable="true">
    <bpmn:laneSet id="Lanes_1">
      <bpmn:lane id="Lane_front" name="Front office">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_intake</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_back" name="Back office">
        <bpmn:flowNodeRef>Task_process</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" />
    <bpmn:userTask id="Task_intake" name="Intake" />
    <bpmn:serviceTask id="Task_process" name="Process" />
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_intake" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_intake" targetRef="Task_process" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_process" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_col${v}">
    <bpmndi:BPMNPlane id="Plane_col${v}" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="Pool_ops_di" bpmnElement="Pool_ops" isHorizontal="true">
        <dc:Bounds x="120" y="60" width="740" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_front_di" bpmnElement="Lane_front" isHorizontal="true">
        <dc:Bounds x="150" y="60" width="710" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_back_di" bpmnElement="Lane_back" isHorizontal="true">
        <dc:Bounds x="150" y="210" width="710" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="200" y="112" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_intake_di" bpmnElement="Task_intake">
        <dc:Bounds x="300" y="100" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_process_di" bpmnElement="Task_process">
        <dc:Bounds x="480" y="250" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="680" y="262" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`,
  },
  {
    name: 'message-flow',
    source: 'OMG spec collaboration example',
    description: 'two participants with a message flow between activities',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_mf${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Pool_customer" name="Customer" processRef="Process_mf${v}" />
    <bpmn:participant id="Pool_supplier" name="Supplier ${v}" processRef="Process_mf${v}" />
    <bpmn:messageFlow id="Mf_order" name="order" sourceRef="Task_order" targetRef="Task_fulfil" />
  </bpmn:collaboration>
  <bpmn:process id="Process_mf${v}" isExecutable="true">
    <bpmn:startEvent id="Start_1" />
    <bpmn:task id="Task_order" name="Place order" />
    <bpmn:task id="Task_fulfil" name="Fulfil order" />
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_order" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_fulfil" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_mf${v}">
    <bpmndi:BPMNPlane id="Plane_mf${v}" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="160" y="112" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_order_di" bpmnElement="Task_order">
        <dc:Bounds x="260" y="100" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_fulfil_di" bpmnElement="Task_fulfil">
        <dc:Bounds x="260" y="300" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="460" y="312" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Mf_order_di" bpmnElement="Mf_order">
        <di:waypoint x="320" y="160" />
        <di:waypoint x="320" y="300" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`,
  },
  {
    name: 'dangling-reference',
    source: 'hand-edited export with a broken flow reference',
    description: 'sequence flow referencing a missing node (warning expected)',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_dang${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_dang${v}" isExecutable="true">
    <bpmn:startEvent id="Start_1" />
    <bpmn:task id="Task_a" name="Step ${v}" />
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_a" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_a" targetRef="End_1" />
    <bpmn:sequenceFlow id="Flow_ghost" sourceRef="Task_a" targetRef="Task_missing" />
  </bpmn:process>
</bpmn:definitions>
`,
  },
  {
    name: 'nested-subprocess',
    source: 'Camunda Modeler export with two nesting levels',
    description: 'collapsed inner subProcess inside an expanded outer one',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_nest${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_nest${v}" isExecutable="true">
    <bpmn:startEvent id="Start_1" />
    <bpmn:subProcess id="Outer_1" name="Fulfilment ${v}">
      <bpmn:startEvent id="Outer_start" />
      <bpmn:userTask id="Outer_task" name="Prepare" />
      <bpmn:subProcess id="Inner_1" name="Quality check">
        <bpmn:task id="Inner_task" name="Inspect" />
      </bpmn:subProcess>
      <bpmn:endEvent id="Outer_end" />
      <bpmn:sequenceFlow id="Of_1" sourceRef="Outer_start" targetRef="Outer_task" />
      <bpmn:sequenceFlow id="Of_2" sourceRef="Outer_task" targetRef="Inner_1" />
      <bpmn:sequenceFlow id="Of_3" sourceRef="Inner_1" targetRef="Outer_end" />
    </bpmn:subProcess>
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Outer_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Outer_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_nest${v}">
    <bpmndi:BPMNPlane id="Plane_nest${v}" bpmnElement="Process_nest${v}">
      <bpmndi:BPMNShape id="Outer_1_di" bpmnElement="Outer_1" isExpanded="true">
        <dc:Bounds x="240" y="80" width="520" height="260" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Inner_1_di" bpmnElement="Inner_1" isExpanded="false">
        <dc:Bounds x="520" y="170" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Outer_task_di" bpmnElement="Outer_task">
        <dc:Bounds x="340" y="180" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="150" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="800" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`,
  },
  {
    name: 'call-activity-data',
    source: 'bpmn.io export with call activity and data elements',
    description: 'callActivity (calledElement) + dataObject/dataStore references + data input/output associations',
    build: (v) => `<bpmn:definitions ${NS} id="Definitions_cad${v}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_cad${v}" isExecutable="true">
    <bpmn:startEvent id="Start_1" />
    <bpmn:callActivity id="Call_billing" name="Charge customer ${v}" calledElement="Process_billing" />
    <bpmn:task id="Task_pack" name="Pack order">
      <bpmn:property id="Property_1" name="__targetRef_placeholder" />
      <bpmn:dataInputAssociation id="Din_1">
        <bpmn:sourceRef>Data_order</bpmn:sourceRef>
        <bpmn:targetRef>Property_1</bpmn:targetRef>
      </bpmn:dataInputAssociation>
      <bpmn:dataOutputAssociation id="Dout_1">
        <bpmn:targetRef>Store_crm</bpmn:targetRef>
      </bpmn:dataOutputAssociation>
    </bpmn:task>
    <bpmn:dataObject id="DataObject_1" />
    <bpmn:dataObjectReference id="Data_order" name="Order" dataObjectRef="DataObject_1" />
    <bpmn:dataStoreReference id="Store_crm" name="CRM" dataStoreRef="DataStore_1" />
    <bpmn:endEvent id="End_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Call_billing" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Call_billing" targetRef="Task_pack" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_pack" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_cad${v}">
    <bpmndi:BPMNPlane id="Plane_cad${v}" bpmnElement="Process_cad${v}">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="160" y="112" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Call_billing_di" bpmnElement="Call_billing">
        <dc:Bounds x="260" y="100" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_pack_di" bpmnElement="Task_pack">
        <dc:Bounds x="440" y="100" width="120" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Data_order_di" bpmnElement="Data_order">
        <dc:Bounds x="420" y="240" width="36" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Store_crm_di" bpmnElement="Store_crm">
        <dc:Bounds x="540" y="240" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="640" y="112" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Din_1_di" bpmnElement="Din_1">
        <di:waypoint x="456" y="240" />
        <di:waypoint x="480" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Dout_1_di" bpmnElement="Dout_1">
        <di:waypoint x="520" y="160" />
        <di:waypoint x="560" y="240" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`,
  },
];

const VARIANTS = 3;
let written = 0;
for (const scenario of SCENARIOS) {
  for (let v = 0; v < VARIANTS; v++) {
    const file = `${String(written + 1).padStart(2, '0')}-${scenario.name}-v${v + 1}.bpmn`;
    writeFileSync(
      join(OUT, file),
      header(scenario.source, `${scenario.description} (variant ${v + 1})`) + scenario.build(v),
    );
    written += 1;
  }
}
console.log(`corpus: ${written} files written to ${OUT}`);
