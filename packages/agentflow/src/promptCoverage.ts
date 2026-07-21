/**
 * Prompt coverage (Squad Lane SL-5) — a pure, headless check that every
 * declared input variable is actually referenced in the prompt.
 *
 * The agent's prompt is a versioned `promptRef` whose BODY lives in the Library
 * (agentflow never holds the text). So this is a SEPARATE entry point the host
 * feeds the resolved prompt text into — it is NOT wired into `validateGraph`,
 * which has only the ref. With no prompt text the host simply does not call it
 * (honest degradation, same discipline as `resolveTool`/`resolveDelegate`).
 *
 * Variable convention: a BARE `{{name}}` (letters, digits, underscore). This is
 * deliberately distinct from the simulate engine's tool-param form
 * `{{node.output.path}}` (which carries a `.`/`-` and never matches here), so a
 * data-mapping template is never mistaken for a prompt variable. Pure, imports
 * nothing at runtime (independence test).
 */

import type { ValidationIssue } from './validate.js';

const BARE_VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** The distinct bare `{{name}}` variables referenced in a prompt, in first-seen order. */
export function promptVariables(promptText: string): string[] {
  const seen = new Set<string>();
  for (const match of promptText.matchAll(BARE_VARIABLE)) seen.add(match[1]);
  return [...seen];
}

/**
 * One `PROMPT_VAR_UNUSED` warning (never an error) per declared input variable
 * that the prompt never references as `{{name}}`. `inputVars` is the caller's
 * `Object.keys(wf.inputSchema)`. Deterministic: issue order follows `inputVars`.
 */
export function promptCoverage(inputVars: string[], promptText: string): ValidationIssue[] {
  const used = new Set(promptVariables(promptText));
  const issues: ValidationIssue[] = [];
  for (const name of inputVars) {
    if (!used.has(name)) {
      issues.push({
        code: 'PROMPT_VAR_UNUSED',
        severity: 'warning',
        message: `Input variable "${name}" is never referenced in the prompt (as {{${name}}}).`,
        remediation: `Reference {{${name}}} in the prompt, or drop "${name}" from the inputSchema if it is unused.`,
      });
    }
  }
  return issues;
}
