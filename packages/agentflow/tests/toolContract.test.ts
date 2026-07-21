import { describe, expect, it } from 'vitest';
import {
  effectRequiresGate,
  isToolRef,
  matchToolParams,
  type ToolSchema,
} from '../src/index.js';

describe('isToolRef (Squad Lane SL-1)', () => {
  it('accepts a well-formed versioned tool ref', () => {
    expect(isToolRef('tool:browser-search@1.2.0')).toBe(true);
    // abbreviated versions parse (normalized upstream) — still a tool ref
    expect(isToolRef('tool:browser-search@1')).toBe(true);
    // the {id,version} object form is accepted too
    expect(isToolRef({ id: 'tool:x', version: '1.0.0' })).toBe(true);
  });

  it('rejects bare names, non-tool refs and malformed input', () => {
    expect(isToolRef('browser_search')).toBe(false); // no @, not a ref
    expect(isToolRef('browser-search@1.2.0')).toBe(false); // ref, but not tool:
    expect(isToolRef('agnt-rsch@2.1.0')).toBe(false); // an agent ref, not a tool
    expect(isToolRef('tool:x@abc')).toBe(false); // invalid version
  });
});

describe('matchToolParams (Squad Lane SL-1)', () => {
  const inputSchema: ToolSchema = {
    query: { type: 'string', required: true },
    limit: { type: 'number' },
  };

  it('is clean when required inputs are present and no unknown params appear', () => {
    expect(matchToolParams({ query: '{{x}}' }, inputSchema)).toEqual({
      missingRequired: [],
      unknownParams: [],
    });
    expect(matchToolParams({ query: '{{x}}', limit: 5 }, inputSchema)).toEqual({
      missingRequired: [],
      unknownParams: [],
    });
  });

  it('reports missing required inputs and unknown params by key', () => {
    expect(matchToolParams({}, inputSchema).missingRequired).toEqual(['query']);
    expect(matchToolParams({ query: '{{x}}', bogus: 1 }, inputSchema).unknownParams).toEqual([
      'bogus',
    ]);
  });
});

describe('effectRequiresGate (Squad Lane SL-1)', () => {
  it('classifies exactly the irreversible/committing effects as gate-requiring', () => {
    expect(effectRequiresGate('write-irreversible')).toBe(true);
    expect(effectRequiresGate('external-commitment')).toBe(true);
    expect(effectRequiresGate('read')).toBe(false);
    expect(effectRequiresGate('propose')).toBe(false);
    expect(effectRequiresGate('notify')).toBe(false);
    expect(effectRequiresGate('write-reversible')).toBe(false);
  });
});
