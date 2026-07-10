import {
  addNodeCommand,
  attachBoundaryCommand,
  boundaryNodePosition,
  compositeCommand,
  createNode,
  type BpmnDiagram,
  type Command,
} from '@buildtovalue/core';

/**
 * Agent Lane (Handoff 12 §5) — the ONE undoable command that PROPOSES an error
 * boundary event on the macro agentTask when the sub-workflow carries an
 * errorBoundary decorator. It reuses N-1's parametric boundary anchoring
 * (`attachBoundaryCommand` + `boundaryNodePosition`): a boundary event node is
 * created and attached to the host in a single composite, so one undo removes
 * the whole proposal. Returns `null` when the host node is absent (nothing to
 * anchor to) — the Studio then simply doesn't offer the proposal.
 *
 * The command is NEVER dispatched silently: the Studio shows an accept/refuse
 * card and only executes this on accept.
 */
export function proposeErrorBoundaryCommand(diagram: BpmnDiagram, hostId: string): Command | null {
  const host = diagram.nodes[hostId];
  if (!host) return null;
  const id = `${hostId}_errBoundary`;
  const size = { width: 36, height: 36 };
  const position = boundaryNodePosition(host, 'bottom', 0.75, size);
  const node = createNode({
    type: 'boundaryEvent',
    id,
    label: 'Error',
    x: position.x,
    y: position.y,
    properties: { eventDefinition: 'error' },
  });
  return compositeCommand('Propose agent error boundary', [
    addNodeCommand(node),
    attachBoundaryCommand(id, hostId, 'bottom', 0.75, position),
  ]);
}
