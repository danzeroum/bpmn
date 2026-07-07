import { describe, expect, it } from 'vitest';
import {
  BpmnParseError,
  escapeXmlAttribute,
  escapeXmlText,
  findByLocalName,
  localName,
  MiniXmlParser,
  XmlBuilder,
} from '../src/index.js';

const parse = (xml: string) => new MiniXmlParser().parse(xml);

describe('MiniXmlParser', () => {
  it('parses elements, attributes and nesting', () => {
    const root = parse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <root a="1" b='two'>
        <child x="y"/>
        <child>text</child>
      </root>`,
    );
    expect(root.tag).toBe('root');
    expect(root.attributes).toEqual({ a: '1', b: 'two' });
    expect(root.children).toHaveLength(2);
    expect(root.children[0].attributes.x).toBe('y');
    expect(root.children[1].text).toBe('text');
  });

  it('handles namespaced tags and localName helper', () => {
    const root = parse('<bpmn:definitions xmlns:bpmn="urn:x"><bpmn:process/></bpmn:definitions>');
    expect(root.tag).toBe('bpmn:definitions');
    expect(localName(root.tag)).toBe('definitions');
    expect(findByLocalName(root, 'process')).toHaveLength(1);
  });

  it('decodes predefined entities and numeric references', () => {
    const root = parse('<a t="&lt;&amp;&gt;&quot;&apos;">&#65;&#x42;</a>');
    expect(root.attributes.t).toBe(`<&>"'`);
    expect(root.text).toBe('AB');
  });

  it('handles CDATA and comments', () => {
    const root = parse('<a><!-- ignore --><![CDATA[<raw> & data]]></a>');
    expect(root.text).toBe('<raw> & data');
  });

  it('handles unicode text (accents, emoji, CJK)', () => {
    const root = parse('<a name="Aprovação ✅ 日本語">conteúdo çãé</a>');
    expect(root.attributes.name).toBe('Aprovação ✅ 日本語');
    expect(root.text).toBe('conteúdo çãé');
  });

  it('rejects DOCTYPE (XXE protection)', () => {
    expect(() =>
      parse('<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><a/>'),
    ).toThrow(/DOCTYPE/);
    expect(() => parse('<a><!DOCTYPE inner><b/></a>')).toThrow(/DOCTYPE/);
  });

  it('reports malformed XML with line info', () => {
    expect(() => parse('<a><b></a>')).toThrow(BpmnParseError);
    expect(() => parse('<a attr=oops/>')).toThrow(BpmnParseError);
    expect(() => parse('<a>')).toThrow(/Unclosed/);
    try {
      parse('<a>\n<b>\n</wrong>\n</a>');
    } catch (error) {
      expect((error as BpmnParseError).line).toBeGreaterThan(1);
    }
  });

  it('rejects unknown custom entities', () => {
    expect(() => parse('<a>&custom;</a>')).toThrow(/entity/i);
  });

  it('rejects trailing garbage after the root', () => {
    expect(() => parse('<a/><b/>')).toThrow(/after root/);
  });
});

describe('XmlBuilder', () => {
  it('builds nested documents with declaration', () => {
    const xml = new XmlBuilder()
      .open('root', { a: 1 })
      .element('leaf', { ok: true })
      .element('withText', {}, 'hello')
      .close()
      .toString();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<root a="1">');
    expect(xml).toContain('<leaf ok="true" />');
    expect(xml).toContain('<withText>hello</withText>');
    expect(xml.trim().endsWith('</root>')).toBe(true);
  });

  it('escapes attribute values and text', () => {
    expect(escapeXmlText('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(escapeXmlAttribute('say "hi" <now>')).toBe('say &quot;hi&quot; &lt;now&gt;');
    const xml = new XmlBuilder({ declaration: false })
      .element('a', { label: '<script>"x"</script>' }, '<body> & more')
      .toString();
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
    expect(xml).toContain('&lt;body&gt; &amp; more');
  });

  it('skips undefined attributes and strips control chars', () => {
    const xml = new XmlBuilder({ declaration: false })
      .element('a', { keep: 'v', drop: undefined }, 'bad\u0001char')
      .toString();
    expect(xml).toContain('keep="v"');
    expect(xml).not.toContain('drop');
    expect(xml).toContain('badchar');
  });

  it('throws on unbalanced usage', () => {
    expect(() => new XmlBuilder().open('a').toString()).toThrow(/unclosed/i);
    expect(() => new XmlBuilder().close()).toThrow(/without a matching/);
  });

  it('round-trips through MiniXmlParser', () => {
    const xml = new XmlBuilder()
      .open('root')
      .element('item', { name: 'Aprovação & "revisão" <final>' }, 'texto çãé')
      .close()
      .toString();
    const parsed = parse(xml);
    expect(parsed.children[0].attributes.name).toBe('Aprovação & "revisão" <final>');
    expect(parsed.children[0].text).toBe('texto çãé');
  });
});
