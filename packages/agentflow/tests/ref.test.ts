import { describe, expect, it } from 'vitest';
import { AgentRefError, formatRef, isValidRef, parseRef, toRef } from '../src/index.js';

/**
 * A-1 locked decision: the canonical ref form is the `id@semver` STRING
 * (identical to callActivity `calledElement`). One parser normalizes the three
 * shapes already in the tree — callActivity `id@semver` strings, copilot
 * `{ id, version }` objects, and the prototype's abbreviated display forms.
 */
describe('parseRef', () => {
  it('parses the canonical id@semver string (callActivity form)', () => {
    const { ref, warnings } = parseRef('agnt-rsch@2.1.0');
    expect(ref).toEqual({ id: 'agnt-rsch', version: '2.1.0' });
    expect(warnings).toEqual([]);
  });

  it('parses the {id, version} object (copilot PromptTemplateRef form)', () => {
    const { ref, warnings } = parseRef({ id: 'prm:research', version: '2.0.0' });
    expect(ref).toEqual({ id: 'prm:research', version: '2.0.0' });
    expect(warnings).toEqual([]);
  });

  it('normalizes the abbreviated @major display form with a warning', () => {
    const { ref, warnings } = parseRef('prm:research@2');
    expect(ref).toEqual({ id: 'prm:research', version: '2.0.0' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/normalized to "2\.0\.0"/);
  });

  it('normalizes the abbreviated @major.minor display form with a warning', () => {
    const { ref, warnings } = parseRef('agnt-verify@1.0');
    expect(ref).toEqual({ id: 'agnt-verify', version: '1.0.0' });
    expect(warnings).toHaveLength(1);
  });

  it('normalizes an abbreviated version inside the object form too', () => {
    const { ref, warnings } = parseRef({ id: 'prm:x', version: '3' });
    expect(ref.version).toBe('3.0.0');
    expect(warnings).toHaveLength(1);
  });

  it('treats ":" and "-" as id characters, splitting only on the last @', () => {
    expect(toRef('a:b-c@1.2.3')).toEqual({ id: 'a:b-c', version: '1.2.3' });
  });

  it('throws AgentRefError when the version is missing', () => {
    expect(() => parseRef('agnt-rsch')).toThrow(AgentRefError);
  });

  it('throws AgentRefError on an empty id', () => {
    expect(() => parseRef('@1.0.0')).toThrow(AgentRefError);
    expect(() => parseRef({ id: '  ', version: '1.0.0' })).toThrow(AgentRefError);
  });

  it('throws AgentRefError on a non-numeric version', () => {
    expect(() => parseRef('agnt@latest')).toThrow(/expected up to major\.minor\.patch/);
  });

  it('round-trips through formatRef back to the canonical string', () => {
    expect(formatRef(toRef('prm:research@2'))).toBe('prm:research@2.0.0');
  });

  it('isValidRef reflects parseability without throwing', () => {
    expect(isValidRef('agnt-rsch@2.1.0')).toBe(true);
    expect(isValidRef('nope')).toBe(false);
  });
});
