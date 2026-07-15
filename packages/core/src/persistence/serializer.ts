import type { BpmnDiagram } from '../model/types.js';
import { BpmnParseError } from '../model/errors.js';

/** Pluggable serialization seam (JSON and XML ship built-in). */
export interface Serializer<T> {
  serialize(diagram: BpmnDiagram): T;
  deserialize(data: T): BpmnDiagram;
}

export class JsonSerializer implements Serializer<string> {
  serialize(diagram: BpmnDiagram): string {
    return JSON.stringify(diagram, null, 2);
  }

  deserialize(data: string): BpmnDiagram {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch (error) {
      throw new BpmnParseError(`Invalid JSON: ${(error as Error).message}`);
    }
    if (parsed === null || typeof parsed !== 'object') {
      throw new BpmnParseError('Expected a JSON object');
    }
    const diagram = parsed as Partial<BpmnDiagram>;
    for (const field of ['id', 'name', 'version', 'nodes', 'edges'] as const) {
      if (diagram[field] === undefined) {
        throw new BpmnParseError(`Missing required diagram field: ${field}`);
      }
    }
    assertRecordOfObjects(diagram.nodes, 'nodes');
    assertRecordOfObjects(diagram.edges, 'edges');
    for (const [id, node] of Object.entries(diagram.nodes as Record<string, unknown>)) {
      assertElementShape(node, `nodes.${id}`);
    }
    for (const [id, edge] of Object.entries(diagram.edges as Record<string, unknown>)) {
      assertElementShape(edge, `edges.${id}`);
      const e = edge as Record<string, unknown>;
      for (const ref of ['sourceId', 'targetId'] as const) {
        if (typeof e[ref] !== 'string') {
          throw new BpmnParseError(`Expected string "${ref}" at edges.${id}`);
        }
      }
    }
    if (typeof diagram.version !== 'object' || diagram.version === null) {
      throw new BpmnParseError('Expected "version" to be an object');
    }
    if (typeof (diagram.version as { id?: unknown }).id !== 'string') {
      throw new BpmnParseError('Expected string "version.id"');
    }
    return {
      description: '',
      metadata: {},
      ...diagram,
    } as BpmnDiagram;
  }
}

function assertRecordOfObjects(value: unknown, field: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BpmnParseError(`Expected "${field}" to be an object keyed by element id`);
  }
}

function assertElementShape(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BpmnParseError(`Expected an object at ${path}`);
  }
  const el = value as Record<string, unknown>;
  if (typeof el.id !== 'string') throw new BpmnParseError(`Expected string "id" at ${path}`);
  if (typeof el.type !== 'string') throw new BpmnParseError(`Expected string "type" at ${path}`);
}
