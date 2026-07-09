import type { XmlBuilder } from '../xml/XmlBuilder.js';
import { firstChildByLocalName, localName, type XmlElement } from '../xml/MiniXmlParser.js';

/** Namespace under which bpmn-react writes its `<extensionElements>` payload. */
export interface ExtensionNamespace {
  prefix: string;
  uri: string;
}

/**
 * Reads and writes the vendor `<bpmn:extensionElements>` payload bpmn-react
 * uses to round-trip model facts the standard BPMN elements can't hold
 * (element `type`, version lineage, arbitrary `properties`).
 *
 * Extracted from `BpmnXmlConverter` so the write pattern (a `bpmnr:meta`
 * element plus JSON-encoded `bpmnr:property` entries) lives in exactly one
 * place instead of being duplicated across every node/edge/association writer —
 * and so `DmnXmlConverter` can share the same encoding rather than reimplement
 * it. Output is byte-for-byte identical to the previous inline logic.
 */
export class ExtensionHandler {
  constructor(private readonly ns: ExtensionNamespace) {}

  get prefix(): string {
    return this.ns.prefix;
  }

  get uri(): string {
    return this.ns.uri;
  }

  /** Opens `<bpmn:extensionElements>`, runs `inner` (which emits the prefixed
   * children), then closes it. */
  writeExtensionElements(xml: XmlBuilder, inner: () => void): void {
    xml.open('bpmn:extensionElements');
    inner();
    xml.close();
  }

  /** A single `<bpmnr:meta …>` element carrying the reserved model attributes. */
  writeMeta(xml: XmlBuilder, attrs: Record<string, string | undefined>): void {
    xml.element(`${this.ns.prefix}:meta`, attrs);
  }

  /** One `<bpmnr:property name="…" value="<json>"/>` element. */
  writeProperty(xml: XmlBuilder, name: string, value: unknown): void {
    xml.element(`${this.ns.prefix}:property`, { name, value: JSON.stringify(value) });
  }

  /** The `<bpmnr:property>` list for a bag of model properties. */
  writeProperties(xml: XmlBuilder, entries: Iterable<[string, unknown]>): void {
    for (const [name, value] of entries) this.writeProperty(xml, name, value);
  }

  /** Convenience for the common node/edge/association shape: a `bpmnr:meta`
   * element followed by the property list, wrapped in `extensionElements`. */
  writeMetaBlock(
    xml: XmlBuilder,
    metaAttrs: Record<string, string | undefined>,
    properties: Iterable<[string, unknown]>,
  ): void {
    this.writeExtensionElements(xml, () => {
      this.writeMeta(xml, metaAttrs);
      this.writeProperties(xml, properties);
    });
  }

  /**
   * Reads an element's `<extensionElements>` back into the model fields:
   * `bpmnr:property` entries are JSON-parsed (falling back to the raw string),
   * `bpmnr:meta` attributes become the `meta` bag, and the raw child list is
   * returned for callers that need the custom `bpmnr:*` elements (diagram,
   * version).
   */
  readExtensionElements(el: XmlElement): {
    properties: Record<string, unknown>;
    meta: Record<string, string>;
    elements: XmlElement[];
  } {
    const container = firstChildByLocalName(el, 'extensionElements');
    const properties: Record<string, unknown> = {};
    let meta: Record<string, string> = {};
    const elements: XmlElement[] = container?.children ?? [];
    for (const child of elements) {
      const tag = localName(child.tag);
      if (tag === 'property') {
        const name = child.attributes.name;
        const raw = child.attributes.value;
        if (name !== undefined && raw !== undefined) {
          try {
            properties[name] = JSON.parse(raw);
          } catch {
            properties[name] = raw;
          }
        }
      } else if (tag === 'meta') {
        meta = { ...child.attributes };
      }
    }
    return { properties, meta, elements };
  }
}
