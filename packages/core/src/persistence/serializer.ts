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
    return {
      description: '',
      metadata: {},
      ...diagram,
    } as BpmnDiagram;
  }
}
