import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/** Freezes the runtime public API surface of @buildtovalue/copilot. */
const EXPECTED_EXPORTS = [
  'COMMAND_WHITELIST',
  'WHITELISTED_COMMANDS',
  'buildPlan',
  'COPILOT_ADJUST_PROMPT',
  'COPILOT_DRAFT_PROMPT',
  'COPILOT_EXPLAIN_PROMPT',
  'COPILOT_SUMMARY_PROMPT',
  'parseProposal',
  'validateProposal',
].sort();

describe('@buildtovalue/copilot public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });
});
