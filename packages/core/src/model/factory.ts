import type {
  AuditTrail,
  BpmnDiagram,
  BpmnEdge,
  BpmnNode,
  BpmnVersion,
  VersionStatus,
} from './types.js';
import { createDefaultRegistry, type NodeTypeRegistry } from './registry.js';

export function generateId(): string {
  return globalThis.crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

function createAuditTrail(createdBy: string): AuditTrail {
  return { createdAt: nowIso(), createdBy, history: [] };
}

export interface CreateVersionOptions {
  semanticVersion?: string;
  status?: VersionStatus;
  changeSummary?: string;
  createdBy?: string;
  parentVersionId?: string;
}

export function createVersion(options: CreateVersionOptions = {}): BpmnVersion {
  return {
    id: generateId(),
    semanticVersion: options.semanticVersion ?? '0.1.0',
    status: options.status ?? 'draft',
    approvedBy: [],
    changeSummary: options.changeSummary ?? '',
    createdBy: options.createdBy ?? 'anonymous',
    createdAt: nowIso(),
    snapshotHash: '',
    ...(options.parentVersionId ? { parentVersionId: options.parentVersionId } : {}),
  };
}

export interface CreateNodeOptions {
  type: string;
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  createdBy?: string;
  /** Version the node is created in; defaults to '0' for standalone nodes. */
  versionId?: string;
  id?: string;
}

export function createNode(
  options: CreateNodeOptions,
  registry: NodeTypeRegistry = createDefaultRegistry(),
): BpmnNode {
  const def = registry.get(options.type);
  return {
    id: options.id ?? generateId(),
    type: options.type,
    label: options.label ?? def.label,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? def.defaultSize.width,
    height: options.height ?? def.defaultSize.height,
    properties: options.properties ?? {},
    createdInVersion: options.versionId ?? '0',
    audit: createAuditTrail(options.createdBy ?? 'anonymous'),
  };
}

export interface CreateEdgeOptions {
  sourceId: string;
  targetId: string;
  type?: string;
  label?: string;
  purpose?: string;
  properties?: Record<string, unknown>;
  supersedesEdgeId?: string;
  createdBy?: string;
  versionId?: string;
  id?: string;
}

export function createEdge(options: CreateEdgeOptions): BpmnEdge {
  return {
    id: options.id ?? generateId(),
    type: options.type ?? 'sequenceFlow',
    sourceId: options.sourceId,
    targetId: options.targetId,
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.purpose !== undefined ? { purpose: options.purpose } : {}),
    properties: options.properties ?? {},
    createdInVersion: options.versionId ?? '0',
    ...(options.supersedesEdgeId ? { supersedesEdgeId: options.supersedesEdgeId } : {}),
    audit: createAuditTrail(options.createdBy ?? 'anonymous'),
  };
}

export interface CreateDiagramOptions {
  name: string;
  description?: string;
  createdBy?: string;
  id?: string;
}

export function createDiagram(options: CreateDiagramOptions): BpmnDiagram {
  return {
    id: options.id ?? generateId(),
    name: options.name,
    description: options.description ?? '',
    version: createVersion({ createdBy: options.createdBy }),
    nodes: {},
    edges: {},
    metadata: {},
  };
}
