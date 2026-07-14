import { BpmnParseError } from '../model/errors.js';

/**
 * Parsed XML element. `tag` keeps the prefix as written (`bpmn:process`);
 * use {@link localName} to compare namespace-agnostically.
 */
export interface XmlElement {
  tag: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** Concatenated, trimmed character data directly inside this element. */
  text: string;
}

export function localName(tag: string): string {
  const colon = tag.indexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

/** Depth-first search for descendants matching a local name. */
export function findByLocalName(root: XmlElement, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const walk = (el: XmlElement) => {
    if (localName(el.tag) === name) found.push(el);
    el.children.forEach(walk);
  };
  walk(root);
  return found;
}

export function childrenByLocalName(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c) => localName(c.tag) === name);
}

export function firstChildByLocalName(el: XmlElement, name: string): XmlElement | undefined {
  return el.children.find((c) => localName(c.tag) === name);
}

const NAME_START = /[A-Za-z_]/;
const NAME_CHAR = /[A-Za-z0-9_.:-]/;

/**
 * Minimal, dependency-free XML parser covering the subset needed for BPMN
 * documents: elements, attributes (single/double quotes), namespaced names,
 * character data, CDATA sections, comments, processing instructions and the
 * five predefined entities plus numeric character references.
 *
 * Security: any `<!DOCTYPE`/DTD is rejected outright, which makes the parser
 * immune to XXE and entity-expansion attacks by construction.
 */
export class MiniXmlParser {
  private source = '';
  private pos = 0;

  parse(xml: string): XmlElement {
    this.source = xml;
    this.pos = 0;

    this.skipProlog();
    const root = this.parseElement();
    this.skipMisc();
    if (this.pos < this.source.length) {
      this.fail('Unexpected content after root element');
    }
    return root;
  }

  private line(): number {
    let line = 1;
    for (let i = 0; i < this.pos && i < this.source.length; i++) {
      if (this.source[i] === '\n') line++;
    }
    return line;
  }

  private fail(message: string): never {
    throw new BpmnParseError(message, this.line());
  }

  private peekStartsWith(prefix: string): boolean {
    return this.source.startsWith(prefix, this.pos);
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) this.pos++;
  }

  private skipProlog(): void {
    this.skipMisc();
    if (this.peekStartsWith('<?xml')) {
      const end = this.source.indexOf('?>', this.pos);
      if (end < 0) this.fail('Unterminated XML declaration');
      this.pos = end + 2;
    }
    this.skipMisc();
  }

  /** Skips whitespace, comments and processing instructions between nodes. */
  private skipMisc(): void {
    for (;;) {
      this.skipWhitespace();
      if (this.peekStartsWith('<!DOCTYPE') || this.peekStartsWith('<!doctype')) {
        this.fail('DOCTYPE declarations are not allowed (XXE protection)');
      }
      if (this.peekStartsWith('<!--')) {
        const end = this.source.indexOf('-->', this.pos + 4);
        if (end < 0) this.fail('Unterminated comment');
        this.pos = end + 3;
        continue;
      }
      if (this.peekStartsWith('<?')) {
        const end = this.source.indexOf('?>', this.pos + 2);
        if (end < 0) this.fail('Unterminated processing instruction');
        this.pos = end + 2;
        continue;
      }
      return;
    }
  }

  private parseName(): string {
    const start = this.pos;
    if (this.pos >= this.source.length || !NAME_START.test(this.source[this.pos])) {
      this.fail('Expected a name');
    }
    while (this.pos < this.source.length && NAME_CHAR.test(this.source[this.pos])) this.pos++;
    return this.source.slice(start, this.pos);
  }

  private parseAttributes(): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (;;) {
      this.skipWhitespace();
      const ch = this.source[this.pos];
      if (ch === '>' || ch === '/' || ch === undefined) return attributes;
      const name = this.parseName();
      this.skipWhitespace();
      if (this.source[this.pos] !== '=') this.fail(`Expected '=' after attribute "${name}"`);
      this.pos++;
      this.skipWhitespace();
      const quote = this.source[this.pos];
      if (quote !== '"' && quote !== "'") this.fail(`Expected quoted value for "${name}"`);
      this.pos++;
      const end = this.source.indexOf(quote, this.pos);
      if (end < 0) this.fail(`Unterminated attribute value for "${name}"`);
      attributes[name] = decodeEntities(this.source.slice(this.pos, end), () => this.line());
      this.pos = end + 1;
    }
  }

  private parseElement(): XmlElement {
    if (this.source[this.pos] !== '<') this.fail('Expected element');
    this.pos++;
    const tag = this.parseName();
    const attributes = this.parseAttributes();
    this.skipWhitespace();

    if (this.peekStartsWith('/>')) {
      this.pos += 2;
      return { tag, attributes, children: [], text: '' };
    }
    if (this.source[this.pos] !== '>') this.fail(`Malformed start tag <${tag}>`);
    this.pos++;

    const children: XmlElement[] = [];
    let text = '';

    for (;;) {
      if (this.pos >= this.source.length) this.fail(`Unclosed element <${tag}>`);

      if (this.peekStartsWith('<![CDATA[')) {
        const end = this.source.indexOf(']]>', this.pos + 9);
        if (end < 0) this.fail('Unterminated CDATA section');
        text += this.source.slice(this.pos + 9, end);
        this.pos = end + 3;
        continue;
      }
      if (this.peekStartsWith('<!--')) {
        const end = this.source.indexOf('-->', this.pos + 4);
        if (end < 0) this.fail('Unterminated comment');
        this.pos = end + 3;
        continue;
      }
      if (this.peekStartsWith('<!DOCTYPE') || this.peekStartsWith('<!doctype')) {
        this.fail('DOCTYPE declarations are not allowed (XXE protection)');
      }
      if (this.peekStartsWith('<?')) {
        const end = this.source.indexOf('?>', this.pos + 2);
        if (end < 0) this.fail('Unterminated processing instruction');
        this.pos = end + 2;
        continue;
      }
      if (this.peekStartsWith('</')) {
        this.pos += 2;
        const closing = this.parseName();
        if (closing !== tag) this.fail(`Mismatched closing tag: expected </${tag}>, got </${closing}>`);
        this.skipWhitespace();
        if (this.source[this.pos] !== '>') this.fail(`Malformed closing tag </${closing}>`);
        this.pos++;
        return { tag, attributes, children, text: text.trim() };
      }
      if (this.source[this.pos] === '<') {
        children.push(this.parseElement());
        continue;
      }
      const next = this.source.indexOf('<', this.pos);
      const chunk = next < 0 ? this.source.slice(this.pos) : this.source.slice(this.pos, next);
      text += decodeEntities(chunk, () => this.line());
      this.pos = next < 0 ? this.source.length : next;
    }
  }
}

// `lineAt` is a thunk so the O(pos) line scan only runs on the error path —
// computing it eagerly per attribute/text chunk made parsing O(n²).
function decodeEntities(value: string, lineAt: () => number): string {
  return value.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (Number.isNaN(code)) {
        throw new BpmnParseError(`Invalid character reference ${match}`, lineAt());
      }
      return String.fromCodePoint(code);
    }
    switch (body) {
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'amp':
        return '&';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        throw new BpmnParseError(`Unknown entity &${body}; (custom entities are not supported)`, lineAt());
    }
  });
}
