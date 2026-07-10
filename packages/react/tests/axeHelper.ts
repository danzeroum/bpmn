import axe from 'axe-core';

export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AxeSummary {
  violations: axe.Result[];
  byImpact: Record<Impact, number>;
  critical: axe.Result[];
}

/**
 * Run axe-core against a rendered container (Handoff 11 N-8). `color-contrast`
 * is disabled: jsdom does not compute layout/CSS, so it can only ever return
 * "incomplete" noise, never a real verdict. Every other WCAG rule (roles,
 * names, ARIA, labels, focus order) evaluates normally on the DOM.
 */
export async function runAxe(container: Element): Promise<AxeSummary> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  const byImpact: Record<Impact, number> = { minor: 0, moderate: 0, serious: 0, critical: 0 };
  for (const v of results.violations) {
    const impact = (v.impact ?? 'minor') as Impact;
    byImpact[impact] += 1;
  }
  return {
    violations: results.violations,
    byImpact,
    critical: results.violations.filter((v) => v.impact === 'critical'),
  };
}

/** One-line description of a violation for test output. */
export function describeViolation(v: axe.Result): string {
  return `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`;
}
