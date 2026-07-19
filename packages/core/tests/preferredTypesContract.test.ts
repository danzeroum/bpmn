import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  createDiagram,
  createNode,
  type BpmnDiagram,
  type NodeTypeRegistry,
} from '../src/index.js';

/**
 * The `preferredTypes` contract matrix (Handoff 21 N-1) — one test per row of
 * the table in docs/format-spec.md ("Type resolution & the preferredTypes
 * contract"). The matrix and this suite MUST NOT drift: each `it` name is the
 * exact string the matrix cites in its "Pinned by" column.
 *
 * The central invariant is the library's fence "declarada, nunca silêncio": the
 * two degradation rows (an unregistered preferred entry; an unregistered
 * meta.type) used to drop the requested identity WITHOUT a warning — now they
 * declare it. The import type-resolution itself is unchanged (a foreign-interop
 * fix, N-1, is measured against this same table when its repro lands).
 */

const PERSONA = {
  type: 'demo:persona',
  label: 'Persona',
  category: 'custom' as const,
  defaultSize: { width: 140, height: 80 },
  xml: { tag: 'userTask' },
};

/** A registry with the custom `demo:persona` type mapped onto the userTask tag. */
function registryWithPersona(): NodeTypeRegistry {
  const registry = createDefaultRegistry();
  registry.register(PERSONA);
  return registry;
}

/** Foreign XML: a plain built-in `userTask` (no bpmnr:meta, since type === tag). */
function foreignUserTaskXml(id = 'u'): string {
  const diagram = createDiagram({ name: 'D', id: 'd' });
  diagram.nodes = { [id]: createNode({ type: 'userTask', id, label: 'U', x: 10, y: 20 }) };
  return new BpmnXmlConverter().toXml(diagram);
}

describe('preferredTypes contract matrix (§ format-spec)', () => {
  it('meta.type registrado vence', () => {
    // bpmnr:meta type=X, X registered → meta wins, identity exact, no warning.
    const registry = registryWithPersona();
    const converter = new BpmnXmlConverter({ registry });
    const diagram: BpmnDiagram = createDiagram({ name: 'D', id: 'd' });
    diagram.nodes = {
      p1: createNode({ type: 'demo:persona', id: 'p1', label: 'Editor', x: 10, y: 20 }, registry),
    };
    const xml = converter.toXml(diagram);
    expect(xml).toContain('type="demo:persona"'); // identity written as meta
    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(imported.nodes.p1.type).toBe('demo:persona');
    expect(warnings).toEqual([]);
  });

  it('preferred registrado vence o built-in', () => {
    // No meta; tag matches a preferred registered type → preferred wins, no warning.
    const converter = new BpmnXmlConverter({
      registry: registryWithPersona(),
      preferredTypes: ['demo:persona'],
    });
    const { diagram: imported, warnings } = converter.fromXml(foreignUserTaskXml());
    expect(imported.nodes.u.type).toBe('demo:persona');
    expect(warnings).toEqual([]);
  });

  it('sem meta nem preferred — built-in da tag', () => {
    // No meta, no preferred → the built-in userTask (interoperable downgrade, no warning).
    const { diagram: imported, warnings } = new BpmnXmlConverter().fromXml(foreignUserTaskXml());
    expect(imported.nodes.u.type).toBe('userTask');
    expect(warnings).toEqual([]);
  });

  it('preferred NÃO registrado — degradação declarada', () => {
    // A preferred entry that isn't registered is skipped by typeForXmlTag — now
    // declared with a warning, ONCE per requested type even across many elements.
    const diagram = createDiagram({ name: 'D', id: 'd' });
    diagram.nodes = {
      u1: createNode({ type: 'userTask', id: 'u1', label: 'U1', x: 10, y: 20 }),
      u2: createNode({ type: 'userTask', id: 'u2', label: 'U2', x: 10, y: 120 }),
    };
    const xml = new BpmnXmlConverter().toXml(diagram);
    const converter = new BpmnXmlConverter({ preferredTypes: ['ghost:persona'] });
    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(imported.nodes.u1.type).toBe('userTask'); // resolution unchanged (built-in)
    const ghostWarnings = warnings.filter((w) => w.includes('Preferred type "ghost:persona" is not registered'));
    expect(ghostWarnings).toHaveLength(1); // dedup: two userTasks, one warning
    // beginImport resets the dedup — a second import re-warns (never swallowed).
    expect(
      converter.fromXml(xml).warnings.filter((w) => w.includes('ghost:persona')),
    ).toHaveLength(1);
  });

  it('meta.type NÃO registrado — degradação declarada', () => {
    // meta.type present but unregistered on the importing side → falls back to the
    // tag, per-element warning naming the dropped identity and the fallback.
    const authoring = registryWithPersona();
    const diagram = createDiagram({ name: 'D', id: 'd' });
    diagram.nodes = {
      p1: createNode({ type: 'demo:persona', id: 'p1', label: 'Editor', x: 10, y: 20 }, authoring),
    };
    const xml = new BpmnXmlConverter({ registry: authoring }).toXml(diagram);
    // Import with a DEFAULT registry that has never seen demo:persona.
    const { diagram: imported, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(imported.nodes.p1.type).toBe('userTask'); // downgraded to the tag
    expect(
      warnings.some((w) => w.includes('meta type "demo:persona"') && w.includes('not registered')),
    ).toBe(true);
  });

  it('tag desconhecida — warning + descartado', () => {
    // A tag that matches no registered type → node dropped with a warning.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="p">
    <bpmn:userTask id="u" name="U" />
    <bpmn:blorp id="b" name="B" />
  </bpmn:process>
</bpmn:definitions>`;
    const { diagram: imported, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(imported.nodes.u).toBeDefined();
    expect(imported.nodes.b).toBeUndefined(); // dropped
    expect(warnings.some((w) => w.includes('Ignored unsupported element') && w.includes('blorp'))).toBe(true);
  });

  it('pool/lane ignora preferredTypes', () => {
    // Pool/lane resolution never consults typeForXmlTag/preferredTypes — a bogus
    // preferred entry cannot change a participant into anything but a pool.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:collaboration id="c">
    <bpmn:participant id="pool1" name="Pool A" processRef="p" />
  </bpmn:collaboration>
  <bpmn:process id="p">
    <bpmn:userTask id="u" name="U" />
  </bpmn:process>
</bpmn:definitions>`;
    const converter = new BpmnXmlConverter({ preferredTypes: ['whatever:type'] });
    const { diagram: imported } = converter.fromXml(xml);
    expect(Object.values(imported.nodes).some((n) => n.type === 'pool')).toBe(true);
  });
});
