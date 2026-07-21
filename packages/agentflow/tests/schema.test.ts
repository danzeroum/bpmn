import { describe, expect, it } from 'vitest';
import {
  isSchemaNode,
  normalizeSchema,
  normalizeSchemaField,
  requiredKeys,
  unsupportedKeywords,
  type SchemaNode,
  type SchemaShape,
} from '../src/index.js';

describe('schema normalization (Squad Lane SL-4)', () => {
  it('lifts a legacy string field to { type } and passes a SchemaNode through', () => {
    expect(normalizeSchemaField('string')).toEqual({ type: 'string' });
    const node: SchemaNode = { type: 'string', required: true };
    expect(normalizeSchemaField(node)).toBe(node);
    expect(isSchemaNode('string')).toBe(false);
    expect(isSchemaNode({ type: 'string' })).toBe(true);
  });

  it('normalizes a whole shape (legacy strings stay meaning-stable)', () => {
    const shape: SchemaShape = { q: 'string', answer: { type: 'string', required: true } };
    expect(normalizeSchema(shape)).toEqual({
      q: { type: 'string' },
      answer: { type: 'string', required: true },
    });
  });

  it('requiredKeys counts only SchemaNode fields with required:true (never a legacy string)', () => {
    const shape: SchemaShape = { a: 'string', b: { type: 'string', required: true }, c: { type: 'number' } };
    expect(requiredKeys(shape)).toEqual(['b']);
  });

  it('unsupportedKeywords flags keywords outside the honest subset, recursing', () => {
    expect(unsupportedKeywords({ type: 'string' })).toEqual([]);
    expect(unsupportedKeywords({ type: 'string', format: 'email' } as unknown as SchemaNode)).toContain(
      'format',
    );
    const nested = {
      type: 'array',
      items: { type: 'object', properties: { u: { type: 'string', pattern: 'x' } } },
    } as unknown as SchemaNode;
    expect(unsupportedKeywords(nested)).toContain('pattern');
  });
});
