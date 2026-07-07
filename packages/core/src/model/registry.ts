import type { Size } from './types.js';
import { BpmnValidationError } from './errors.js';

export type NodeCategory =
  | 'event'
  | 'activity'
  | 'gateway'
  | 'data'
  | 'artifact'
  | 'container'
  | 'custom';

export interface NodeTypeDefinition {
  /** Type key stored on nodes, e.g. 'userTask' or a custom 'myDomain:thing'. */
  type: string;
  /** Human-readable label for palettes and inspectors. */
  label: string;
  category: NodeCategory;
  defaultSize: Size;
  /**
   * BPMN 2.0 XML mapping. `tag` is the element name inside `<process>` used on
   * export; on import the same tag maps back to this type. Custom types map to
   * a standard BPMN tag so exported files stay interoperable — their identity
   * is preserved via extensionElements.
   */
  xml: { tag: string };
}

/**
 * Registry of node types. The core registers the standard BPMN set; plugins
 * add domain-specific types at runtime.
 */
export class NodeTypeRegistry {
  private readonly definitions = new Map<string, NodeTypeDefinition>();

  register(definition: NodeTypeDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new BpmnValidationError(`Node type already registered: ${definition.type}`);
    }
    this.definitions.set(definition.type, definition);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  get(type: string): NodeTypeDefinition {
    const def = this.definitions.get(type);
    if (!def) throw new BpmnValidationError(`Unknown node type: ${type}`);
    return def;
  }

  list(): NodeTypeDefinition[] {
    return [...this.definitions.values()];
  }

  /**
   * Finds the first type whose XML tag matches. When several types share a tag
   * (e.g. custom types mapped onto `userTask`), the `preferred` list wins.
   */
  typeForXmlTag(tag: string, preferred: string[] = []): NodeTypeDefinition | undefined {
    for (const type of preferred) {
      const def = this.definitions.get(type);
      if (def && def.xml.tag === tag) return def;
    }
    for (const def of this.definitions.values()) {
      if (def.xml.tag === tag) return def;
    }
    return undefined;
  }
}

export const BUILT_IN_NODE_TYPES: NodeTypeDefinition[] = [
  { type: 'startEvent', label: 'Start Event', category: 'event', defaultSize: { width: 36, height: 36 }, xml: { tag: 'startEvent' } },
  { type: 'endEvent', label: 'End Event', category: 'event', defaultSize: { width: 36, height: 36 }, xml: { tag: 'endEvent' } },
  { type: 'task', label: 'Task', category: 'activity', defaultSize: { width: 120, height: 60 }, xml: { tag: 'task' } },
  { type: 'userTask', label: 'User Task', category: 'activity', defaultSize: { width: 120, height: 60 }, xml: { tag: 'userTask' } },
  { type: 'serviceTask', label: 'Service Task', category: 'activity', defaultSize: { width: 120, height: 60 }, xml: { tag: 'serviceTask' } },
  { type: 'scriptTask', label: 'Script Task', category: 'activity', defaultSize: { width: 120, height: 60 }, xml: { tag: 'scriptTask' } },
  { type: 'exclusiveGateway', label: 'Exclusive Gateway', category: 'gateway', defaultSize: { width: 50, height: 50 }, xml: { tag: 'exclusiveGateway' } },
  { type: 'parallelGateway', label: 'Parallel Gateway', category: 'gateway', defaultSize: { width: 50, height: 50 }, xml: { tag: 'parallelGateway' } },
  { type: 'inclusiveGateway', label: 'Inclusive Gateway', category: 'gateway', defaultSize: { width: 50, height: 50 }, xml: { tag: 'inclusiveGateway' } },
  { type: 'subProcess', label: 'Sub-Process', category: 'activity', defaultSize: { width: 200, height: 120 }, xml: { tag: 'subProcess' } },
  { type: 'dataObject', label: 'Data Object', category: 'data', defaultSize: { width: 36, height: 50 }, xml: { tag: 'dataObjectReference' } },
  { type: 'textAnnotation', label: 'Text Annotation', category: 'artifact', defaultSize: { width: 120, height: 40 }, xml: { tag: 'textAnnotation' } },
  { type: 'pool', label: 'Pool', category: 'container', defaultSize: { width: 600, height: 250 }, xml: { tag: 'participant' } },
  { type: 'lane', label: 'Lane', category: 'container', defaultSize: { width: 570, height: 120 }, xml: { tag: 'lane' } },
];

/** Creates a registry pre-populated with the standard BPMN node types. */
export function createDefaultRegistry(): NodeTypeRegistry {
  const registry = new NodeTypeRegistry();
  for (const def of BUILT_IN_NODE_TYPES) registry.register(def);
  return registry;
}
