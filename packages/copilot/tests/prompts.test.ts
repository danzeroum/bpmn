import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';
import { COPILOT_PROMPTS } from '../src/index.js';

/**
 * CP-5 anti-drift (cerca §1.5 — dogfooding): COPILOT_PROMPTS is the single
 * canonical registry. Every exported *_PROMPT template must be in it (a new
 * capability that forgets the registry never reaches the Biblioteca), ids
 * are unique, and every entry is well-formed (id + semver + system).
 */
describe('COPILOT_PROMPTS — canonical template registry (§1.5)', () => {
  it('contains EVERY exported *_PROMPT template (anti-drift)', () => {
    const exported = Object.entries(api)
      .filter(([name]) => /^COPILOT_.*_PROMPT$/.test(name))
      .map(([, value]) => value);
    expect(exported.length).toBeGreaterThan(0);
    for (const template of exported) {
      expect(COPILOT_PROMPTS).toContain(template);
    }
    expect(COPILOT_PROMPTS).toHaveLength(exported.length);
  });

  it('ids are unique and every entry is well-formed (id + semver + system)', () => {
    const ids = COPILOT_PROMPTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of COPILOT_PROMPTS) {
      expect(template.id).toMatch(/^copilot-[a-z]+$/);
      expect(template.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(template.system.length).toBeGreaterThan(40);
    }
  });

  it('covers the six §4 capabilities in order (C1..C6)', () => {
    expect(COPILOT_PROMPTS.map((t) => t.id)).toEqual([
      'copilot-draft',
      'copilot-adjust',
      'copilot-explain',
      'copilot-summary',
      'copilot-fix',
      'copilot-query',
    ]);
  });
});
