import { BpmnError } from '../model/errors.js';

/** Escapes character data (text nodes). */
export function escapeXmlText(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes attribute values (double-quoted). TAB/LF/CR are written as
 * character references — a strict parser normalizes the literal characters
 * to spaces on re-read, which would break exact round-trips.
 */
export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;')
    .replace(/\t/g, '&#9;')
    .replace(/\r/g, '&#13;');
}

/** Removes characters that are invalid in XML 1.0 documents. */
function stripInvalidXmlChars(value: string): string {
   
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

export type XmlAttributes = Record<string, string | number | boolean | undefined>;

/**
 * Incremental XML writer with automatic escaping and indentation.
 * Undefined attribute values are skipped, so callers can pass optional
 * fields without pre-filtering.
 */
export class XmlBuilder {
  private readonly parts: string[] = [];
  private readonly stack: string[] = [];
  private readonly indent: string;

  constructor(options: { indent?: string; declaration?: boolean } = {}) {
    this.indent = options.indent ?? '  ';
    if (options.declaration !== false) {
      this.parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    }
  }

  private pad(): string {
    return this.indent.repeat(this.stack.length);
  }

  private renderAttributes(attributes: XmlAttributes = {}): string {
    const rendered = Object.entries(attributes)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => `${name}="${escapeXmlAttribute(String(value))}"`)
      .join(' ');
    return rendered.length > 0 ? ' ' + rendered : '';
  }

  /** Opens a container element; must be balanced with {@link close}. */
  open(tag: string, attributes: XmlAttributes = {}): this {
    this.parts.push(`${this.pad()}<${tag}${this.renderAttributes(attributes)}>`);
    this.stack.push(tag);
    return this;
  }

  /** Writes a self-closing element, or one with escaped text content. */
  element(tag: string, attributes: XmlAttributes = {}, text?: string): this {
    const attrs = this.renderAttributes(attributes);
    if (text === undefined || text === '') {
      this.parts.push(`${this.pad()}<${tag}${attrs} />`);
    } else {
      this.parts.push(`${this.pad()}<${tag}${attrs}>${escapeXmlText(text)}</${tag}>`);
    }
    return this;
  }

  close(): this {
    const tag = this.stack.pop();
    if (!tag) throw new BpmnError('XML', 'XmlBuilder: close() without a matching open()');
    this.parts.push(`${this.pad()}</${tag}>`);
    return this;
  }

  toString(): string {
    if (this.stack.length > 0) {
      throw new BpmnError('XML', `XmlBuilder: unclosed elements: ${this.stack.join(', ')}`);
    }
    return this.parts.join('\n') + '\n';
  }
}
