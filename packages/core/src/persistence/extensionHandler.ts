import type { XmlBuilder } from '../xml/XmlBuilder.js';
import { firstChildByLocalName, localName, type XmlElement } from '../xml/MiniXmlParser.js';
import type { XmlSubtree } from '../model/types.js';

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
    /**
     * Foreign children (any prefix other than ours — `zeebe:*`, `camunda:*`…)
     * preserved verbatim in original order (passthrough). Empty array when
     * the element carries none.
     */
    foreign: XmlSubtree[];
  } {
    const container = firstChildByLocalName(el, 'extensionElements');
    const properties: Record<string, unknown> = {};
    let meta: Record<string, string> = {};
    const foreign: XmlSubtree[] = [];
    const elements: XmlElement[] = container?.children ?? [];
    for (const child of elements) {
      const tag = localName(child.tag);
      const prefix = child.tag.includes(':') ? child.tag.slice(0, child.tag.indexOf(':')) : '';
      // Ours = our configured prefix, or unprefixed (legacy tolerance — the
      // pre-passthrough reader matched by localName only). A DIFFERENT
      // prefix (`zeebe:`, `camunda:`…) is a foreign extension now preserved
      // verbatim instead of being misread or dropped.
      const ours = prefix === this.ns.prefix || prefix === '';
      if (ours && tag === 'property') {
        const name = child.attributes.name;
        const raw = child.attributes.value;
        if (name !== undefined && raw !== undefined) {
          try {
            properties[name] = JSON.parse(raw);
          } catch {
            properties[name] = raw;
          }
        }
      } else if (ours && tag === 'meta') {
        meta = { ...child.attributes };
      } else if (!ours) {
        foreign.push(toSubtree(child));
      }
    }
    return { properties, meta, elements, foreign };
  }

  /** Re-emits one preserved foreign subtree exactly as stored. */
  writeSubtree(xml: XmlBuilder, subtree: XmlSubtree): void {
    if (subtree.children.length === 0) {
      xml.element(subtree.tag, subtree.attributes, subtree.text || undefined);
      return;
    }
    xml.open(subtree.tag, subtree.attributes);
    for (const child of subtree.children) this.writeSubtree(xml, child);
    xml.close();
  }
}

/** Parser element → JSON-serializable storage shape (structuredClone-safe). */
function toSubtree(el: XmlElement): XmlSubtree {
  return {
    tag: el.tag,
    attributes: { ...el.attributes },
    children: el.children.map(toSubtree),
    text: el.text,
  };
}
