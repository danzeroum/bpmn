import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  BpmnEditor,
  LOAD_PARAM,
  readLoadVersionId,
  resolveDeepLink,
  buildLoadSearch,
  useCanvasStore,
  type VersionResolver,
} from '../src/index.js';

/**
 * Squad Lane SL-12 — the BPMN bridge deep-link (`?load=<versionId>`, closes
 * pendências §1.2). Pure parse + injected resolver (degradable), and the
 * viewport/selection restore the host uses on "voltar".
 */
const diagram = (id: string): BpmnDiagram => {
  const d = createDiagram({ name: id, id });
  d.nodes = { a: createNode({ type: 'startEvent', id: 'a', x: 40, y: 40 }) };
  return d;
};

describe('readLoadVersionId — parse ?load=', () => {
  it('reads the versionId with or without a leading ?', () => {
    expect(readLoadVersionId('?load=onb-v2')).toBe('onb-v2');
    expect(readLoadVersionId('load=onb-v2')).toBe('onb-v2');
    expect(readLoadVersionId('?other=x&load=onb-v2&z=1')).toBe('onb-v2');
  });

  it('is undefined when the param is absent or empty', () => {
    expect(readLoadVersionId('')).toBeUndefined();
    expect(readLoadVersionId('?foo=bar')).toBeUndefined();
    expect(readLoadVersionId('?load=')).toBeUndefined();
  });

  it('LOAD_PARAM is the documented key', () => {
    expect(LOAD_PARAM).toBe('load');
  });
});

describe('resolveDeepLink — parse + injected resolver (degradable)', () => {
  const resolve: VersionResolver = (id) => (id === 'onb-v2' ? diagram('onb-v2') : undefined);

  it('resolves the exact version to its diagram', () => {
    const target = resolveDeepLink('?load=onb-v2', resolve);
    expect(target?.versionId).toBe('onb-v2');
    expect(target?.diagram.nodes.a).toBeDefined();
  });

  it('returns undefined when there is no param (host opens its default)', () => {
    expect(resolveDeepLink('?foo=bar', resolve)).toBeUndefined();
  });

  it('returns undefined when the version does not resolve (never guesses)', () => {
    expect(resolveDeepLink('?load=ghost', resolve)).toBeUndefined();
  });
});

describe('buildLoadSearch — the host pushes this to history', () => {
  it('builds ?load=<versionId>, preserving extra params', () => {
    expect(buildLoadSearch('onb-v2')).toBe('?load=onb-v2');
    // round-trips through the reader
    expect(readLoadVersionId(buildLoadSearch('onb-v2', { drd: '1' }))).toBe('onb-v2');
    expect(new URLSearchParams(buildLoadSearch('onb-v2', { drd: '1' })).get('drd')).toBe('1');
  });
});

describe('viewport/selection restore (voltar) via initialCanvasState', () => {
  it('seeds the canvas viewport + selection so back-navigation restores state', () => {
    const restored = { viewport: { x: 120, y: 60, width: 900, height: 600 }, selectedIds: ['a'] };
    let captured: { x: number; width: number } | undefined;
    let selected: string[] | undefined;
    function Probe() {
      const store = useCanvasStore();
      const s = store.getState();
      captured = { x: s.viewport.x, width: s.viewport.width };
      selected = s.selectedIds;
      return null;
    }
    render(
      <BpmnEditor diagram={diagram('onb-v2')} initialCanvasState={restored}>
        <Probe />
      </BpmnEditor>,
    );
    expect(captured).toEqual({ x: 120, width: 900 });
    expect(selected).toEqual(['a']);
  });
});
