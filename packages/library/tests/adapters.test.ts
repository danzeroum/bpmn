import { describe, expect, it, vi } from 'vitest';
import { registerAdapters, type ArtifactAdapter } from '../src/index.js';

function fakeAdapter(overrides: Partial<ArtifactAdapter> = {}): ArtifactAdapter {
  return {
    id: 'fake',
    typeLabel: 'FAKE',
    list: async () => [],
    get: async () => {
      throw new Error('not implemented');
    },
    ...overrides,
  };
}

describe('registerAdapters (§3 rules: warning, never crash)', () => {
  it('accepts valid adapters in order', () => {
    const a = fakeAdapter({ id: 'a' });
    const b = fakeAdapter({ id: 'b' });
    expect(registerAdapters([a, b])).toEqual([a, b]);
  });

  it('drops an adapter with an empty id and warns', () => {
    const onWarning = vi.fn();
    const result = registerAdapters([fakeAdapter({ id: '  ' }), fakeAdapter({ id: 'ok' })], {
      onWarning,
    });
    expect(result.map((a) => a.id)).toEqual(['ok']);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0][0].message).toMatch(/id must be a non-empty string/);
  });

  it('drops an adapter with a missing id and warns', () => {
    const onWarning = vi.fn();
    const broken = fakeAdapter();
    // simulate a JS consumer passing a malformed adapter
    (broken as { id: unknown }).id = undefined;
    expect(registerAdapters([broken], { onWarning })).toEqual([]);
    expect(onWarning).toHaveBeenCalledWith({
      adapterId: '',
      message: 'adapter dropped: id must be a non-empty string',
    });
  });

  it('drops an adapter with an empty typeLabel and warns', () => {
    const onWarning = vi.fn();
    const result = registerAdapters([fakeAdapter({ id: 'x', typeLabel: '' })], { onWarning });
    expect(result).toEqual([]);
    expect(onWarning.mock.calls[0][0]).toEqual({
      adapterId: 'x',
      message: 'adapter dropped: typeLabel must be a non-empty string',
    });
  });

  it('drops a non-string typeLabel and warns', () => {
    const onWarning = vi.fn();
    const broken = fakeAdapter({ id: 'x' });
    (broken as { typeLabel: unknown }).typeLabel = 42;
    expect(registerAdapters([broken], { onWarning })).toEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('keeps the first registration on duplicate ids and warns', () => {
    const onWarning = vi.fn();
    const first = fakeAdapter({ id: 'dup', typeLabel: 'FIRST' });
    const second = fakeAdapter({ id: 'dup', typeLabel: 'SECOND' });
    const result = registerAdapters([first, second], { onWarning });
    expect(result).toEqual([first]);
    expect(onWarning.mock.calls[0][0].message).toMatch(/duplicate id "dup"/);
  });

  it('never throws without an onWarning callback', () => {
    expect(() => registerAdapters([fakeAdapter({ id: '' })])).not.toThrow();
  });
});
