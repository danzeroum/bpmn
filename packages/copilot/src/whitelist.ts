import {
  addEdgeCommand,
  addNodeCommand,
  createEdge,
  createNode,
  moveNodeCommand,
  removeEdgeCommand,
  removeNodeCommand,
  updateEdgeCommand,
  updateNodeCommand,
  type BpmnDiagram,
  type Command,
} from '@buildtovalue/core';
import type { ProposedCommand } from './types.js';

/**
 * The command whitelist (§1.3): the ONLY operations an accepted proposal can
 * perform — the draft-editing subset of the core command specs. Everything
 * governance-shaped (promote, sign, approve, lifecycle) is structurally
 * absent: it is not that those commands are rejected, they cannot even be
 * expressed here.
 *
 * Each spec validates its params shape against the CURRENT diagram (ids must
 * resolve; new ids must not collide) and materializes the real core command.
 * Validation errors are returned, never thrown — the caller rejects the
 * proposal INTEGRALLY on the first offending command.
 */
interface CommandSpec {
  validate(params: Record<string, unknown>, diagram: BpmnDiagram, newIds: Set<string>): string | null;
  materialize(params: Record<string, unknown>, diagram: BpmnDiagram): Command;
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const nodeExists = (id: unknown, diagram: BpmnDiagram, newIds: Set<string>): boolean =>
  isString(id) && (diagram.nodes[id] !== undefined || newIds.has(id));

export const COMMAND_WHITELIST: Record<string, CommandSpec> = {
  addNode: {
    validate: (p, diagram, newIds) => {
      if (!isString(p.id)) return "addNode needs a string 'id'";
      if (diagram.nodes[p.id] || newIds.has(p.id)) return `addNode: id '${p.id}' already exists`;
      if (!isString(p.type)) return "addNode needs a string 'type'";
      if (!isString(p.label)) return "addNode needs a string 'label'";
      if (!isNumber(p.x) || !isNumber(p.y)) return "addNode needs numeric 'x' and 'y'";
      if (p.properties !== undefined && !isRecord(p.properties)) {
        return "addNode 'properties' must be an object";
      }
      newIds.add(p.id);
      return null;
    },
    materialize: (p, diagram) =>
      addNodeCommand(
        createNode({
          id: p.id as string,
          type: p.type as string,
          label: p.label as string,
          x: p.x as number,
          y: p.y as number,
          properties: (p.properties as Record<string, unknown>) ?? {},
          versionId: diagram.version.id,
        }),
      ),
  },
  addEdge: {
    validate: (p, diagram, newIds) => {
      if (!isString(p.id)) return "addEdge needs a string 'id'";
      if (diagram.edges[p.id]) return `addEdge: id '${p.id}' already exists`;
      if (!nodeExists(p.sourceId, diagram, newIds)) {
        return `addEdge: unknown sourceId '${String(p.sourceId)}'`;
      }
      if (!nodeExists(p.targetId, diagram, newIds)) {
        return `addEdge: unknown targetId '${String(p.targetId)}'`;
      }
      return null;
    },
    materialize: (p, diagram) =>
      addEdgeCommand(
        createEdge({
          id: p.id as string,
          sourceId: p.sourceId as string,
          targetId: p.targetId as string,
          ...(isString(p.type) ? { type: p.type } : {}),
          ...(isString(p.label) ? { label: p.label } : {}),
          ...(isString(p.purpose) ? { purpose: p.purpose } : {}),
          versionId: diagram.version.id,
        }),
      ),
  },
  updateNode: {
    validate: (p, diagram, newIds) => {
      if (!nodeExists(p.id, diagram, newIds)) return `updateNode: unknown id '${String(p.id)}'`;
      if (p.label !== undefined && typeof p.label !== 'string') return "updateNode 'label' must be a string";
      if (p.properties !== undefined && !isRecord(p.properties)) {
        return "updateNode 'properties' must be an object";
      }
      return null;
    },
    materialize: (p) =>
      updateNodeCommand(p.id as string, {
        ...(p.label !== undefined ? { label: p.label as string } : {}),
        ...(p.properties !== undefined ? { properties: p.properties as Record<string, unknown> } : {}),
      }),
  },
  updateEdge: {
    validate: (p, diagram) => {
      if (!isString(p.id) || !diagram.edges[p.id]) return `updateEdge: unknown id '${String(p.id)}'`;
      if (p.properties !== undefined && !isRecord(p.properties)) {
        return "updateEdge 'properties' must be an object";
      }
      return null;
    },
    materialize: (p) =>
      updateEdgeCommand(p.id as string, {
        ...(p.label !== undefined ? { label: p.label as string } : {}),
        ...(p.purpose !== undefined ? { purpose: p.purpose as string } : {}),
        ...(p.properties !== undefined ? { properties: p.properties as Record<string, unknown> } : {}),
      }),
  },
  moveNode: {
    validate: (p, diagram, newIds) => {
      if (!nodeExists(p.id, diagram, newIds)) return `moveNode: unknown id '${String(p.id)}'`;
      if (!isNumber(p.x) || !isNumber(p.y)) return "moveNode needs numeric 'x' and 'y'";
      return null;
    },
    materialize: (p, diagram) => {
      const node = diagram.nodes[p.id as string];
      return moveNodeCommand(
        p.id as string,
        { x: node?.x ?? 0, y: node?.y ?? 0 },
        { x: p.x as number, y: p.y as number },
      );
    },
  },
  removeNode: {
    validate: (p, diagram) => {
      if (!isString(p.id) || !diagram.nodes[p.id]) return `removeNode: unknown id '${String(p.id)}'`;
      return null;
    },
    materialize: (p) => removeNodeCommand(p.id as string),
  },
  removeEdge: {
    validate: (p, diagram) => {
      if (!isString(p.id) || !diagram.edges[p.id]) return `removeEdge: unknown id '${String(p.id)}'`;
      return null;
    },
    materialize: (p) => removeEdgeCommand(p.id as string),
  },
};

/** The whitelisted command names — exported for the anti-drift test. */
export const WHITELISTED_COMMANDS = Object.keys(COMMAND_WHITELIST).sort();

export type { CommandSpec, ProposedCommand };
