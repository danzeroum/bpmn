import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  poolBodyOf,
  tileLaneRects,
  POOL_TITLE_BAND,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
} from '@buildtovalue/core';
import type { SquadEdgeKind, SquadManifest } from '@buildtovalue/agentflow';

/**
 * Squad Lane SL-9 — the DETERMINISTIC projection of a `SquadManifest` (the
 * source of truth) into a standard BPMN diagram: a pool with one lane per role
 * (orchestrator + members, plus `humano` when referenced), an `agentTask` in
 * each lane, and the six squad edges (edge.type = the kind). Same manifest →
 * same diagram. The diagram is a PROJECTION; edits flow back through commands
 * that update the manifest (Squad Studio), never a second source of state.
 */

const POOL_X = 40;
const POOL_Y = 40;
const POOL_W = 780;
const LANE_H = 96;
const TASK_W = 180;
const TASK_H = 60;

interface Role {
  role: string;
  agentRef?: string;
  personaRef?: string;
}

/** Projects a manifest to a BPMN diagram. Pure and deterministic. */
export function buildSquadDiagram(manifest: SquadManifest): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: manifest.id, name: manifest.id });
  const versionId = diagram.version.id;

  const roles: Role[] = [
    { role: 'orch', agentRef: manifest.orchestratorRef },
    ...manifest.members.map((m) => ({ role: m.role, agentRef: m.agentRef, personaRef: m.personaRef })),
  ];
  if (manifest.edges.some((e) => e.from === 'humano' || e.to === 'humano')) {
    roles.push({ role: 'humano' });
  }
  const known = new Set(roles.map((r) => r.role));

  const nodes: Record<string, BpmnNode> = {};
  const pool = createNode(
    {
      type: 'pool',
      id: 'squad-pool',
      label: manifest.id,
      x: POOL_X,
      y: POOL_Y,
      width: POOL_W,
      height: POOL_TITLE_BAND + roles.length * LANE_H,
      versionId,
    },
    registry,
  );
  nodes['squad-pool'] = pool;

  const rects = tileLaneRects(poolBodyOf(pool), roles.map(() => 1));
  roles.forEach((role, i) => {
    const rect = rects[i];
    const lane = createNode(
      {
        type: 'lane',
        id: `lane-${role.role}`,
        label: role.role,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        properties: { parentId: 'squad-pool' },
        versionId,
      },
      registry,
    );
    nodes[lane.id] = lane;
    const task = createNode(
      {
        type: 'agentTask',
        id: role.role,
        label: role.role,
        x: rect.x + 60,
        y: rect.y + (rect.height - TASK_H) / 2,
        width: TASK_W,
        height: TASK_H,
        properties: {
          parentId: 'squad-pool',
          ...(role.agentRef ? { agentWorkflowRef: role.agentRef } : {}),
          ...(role.personaRef ? { personaRef: role.personaRef } : {}),
        },
        versionId,
      },
      registry,
    );
    nodes[task.id] = task;
  });

  const edges: Record<string, BpmnEdge> = {};
  let index = 0;
  const link = (from: string, to: string, kind: SquadEdgeKind): void => {
    if (!known.has(from) || !known.has(to) || from === to) return; // unknown role → not drawn
    const id = `e${index++}`;
    edges[id] = createEdge({ id, sourceId: from, targetId: to, type: kind, label: kind, versionId });
  };
  for (const edge of manifest.edges) {
    if (edge.from === '*') {
      // broadcast: every member (not the target, not humano) → the target
      for (const r of roles) if (r.role !== 'humano') link(r.role, edge.to, edge.kind);
    } else {
      link(edge.from, edge.to, edge.kind);
    }
  }

  diagram.nodes = nodes;
  diagram.edges = edges;
  return diagram;
}
