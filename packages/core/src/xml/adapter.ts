import { BpmnParseError } from '../model/errors.js';
import { MiniXmlParser, type XmlElement } from './MiniXmlParser.js';

/**
 * Environment-agnostic XML parsing seam. The bundled {@link MiniXmlAdapter}
 * works everywhere (browser, Node, workers); {@link DomXmlAdapter} delegates
 * to the browser's native `DOMParser` for hosts that prefer it.
 */
export interface XmlParserAdapter {
  parse(xml: string): XmlElement;
}

export class MiniXmlAdapter implements XmlParserAdapter {
  parse(xml: string): XmlElement {
    return new MiniXmlParser().parse(xml);
  }
}

export class DomXmlAdapter implements XmlParserAdapter {
  parse(xml: string): XmlElement {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry seam: payload types vary per event/tag and are narrowed at the call site
    const DomParserCtor = (globalThis as Record<string, any>).DOMParser;
    if (typeof DomParserCtor !== 'function') {
      throw new BpmnParseError('DOMParser is not available in this environment — use MiniXmlAdapter');
    }
    if (/<!DOCTYPE/i.test(xml)) {
      throw new BpmnParseError('DOCTYPE declarations are not allowed (XXE protection)');
    }
    const doc = new DomParserCtor().parseFromString(xml, 'application/xml');
    const error = doc.querySelector('parsererror');
    if (error) {
      throw new BpmnParseError(`Invalid XML: ${error.textContent ?? 'unknown parser error'}`);
    }
    if (!doc.documentElement) throw new BpmnParseError('Empty XML document');
    return convertDomElement(doc.documentElement);
  }
}

function convertDomElement(el: Element): XmlElement {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) attributes[attr.name] = attr.value;
  const children: XmlElement[] = [];
  let text = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) children.push(convertDomElement(child as Element));
    else if (child.nodeType === 3 || child.nodeType === 4) text += child.nodeValue ?? '';
  }
  return { tag: el.tagName, attributes, children, text: text.trim() };
}

export function getDefaultXmlAdapter(): XmlParserAdapter {
  return new MiniXmlAdapter();
}
