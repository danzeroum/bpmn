import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readinessState, type AgentWorkflow, type ReadinessContext } from '@buildtovalue/agentflow';
import { ReadinessBadge, PT_BR } from '../src/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.js';
import { describeViolation, runAxe } from './axeHelper.js';

/**
 * Squad Lane SL-13 — the readiness badge is the SINGLE source of a painted
 * readiness state: it must show exactly what `readinessState()` returns, for
 * every state. This guard breaks if a component ever derives its own state
 * (acceptance §10.7). The host runtime states are shown ONLY when the host
 * informs them — `apto-para-integracao` never becomes `executando` on its own.
 */
const wf = (nodes = 1): AgentWorkflow => ({
  kind: 'AgentWorkflow',
  id: 'agnt-x',
  version: '1.0.0',
  name: 'X',
  autonomyLevel: 2,
  inputSchema: {},
  outputSchema: {},
  nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}`, type: 'llm', config: { model: 'gpt-4o', promptRef: 'p@1.0.0' } })),
  edges: [],
});

// One (workflow, context) per readiness state — driven straight through the
// pure function so the fixtures can never drift from the badge.
const CASES: Array<{ label: string; wf: AgentWorkflow; ctx: ReadinessContext; expect: string }> = [
  { label: 'rascunho (empty)', wf: wf(0), ctx: { validation: [], hasEvidence: false }, expect: 'rascunho' },
  {
    label: 'rascunho (error)',
    wf: wf(),
    ctx: { validation: [{ code: 'X', severity: 'error', message: 'bad' }], hasEvidence: false },
    expect: 'rascunho',
  },
  { label: 'validado', wf: wf(), ctx: { validation: [], hasEvidence: false }, expect: 'validado' },
  {
    label: 'simulado-com-evidencia',
    wf: wf(),
    ctx: { validation: [], hasEvidence: true, gateCovered: false },
    expect: 'simulado-com-evidencia',
  },
  {
    label: 'apto-para-integracao',
    wf: wf(),
    ctx: { validation: [], hasEvidence: true, gateCovered: true, signedActive: true },
    expect: 'apto-para-integracao',
  },
];

const renderBadge = (props: React.ComponentProps<typeof ReadinessBadge>) =>
  render(
    <I18nProvider messages={PT_BR}>
      <ReadinessBadge {...props} />
    </I18nProvider>,
  );

describe('ReadinessBadge — single source is readinessState() (SL-13, §10.7)', () => {
  it('shows EXACTLY what readinessState() returns for every state', () => {
    for (const c of CASES) {
      // the fixture's expected value IS the pure function's value (no drift)
      expect(readinessState(c.wf, c.ctx)).toBe(c.expect);
      const { container, unmount } = renderBadge({ workflow: c.wf, context: c.ctx });
      const badge = container.querySelector('[data-readiness]')!;
      expect(badge.getAttribute('data-readiness')).toBe(c.expect);
      // the derived attribute always equals the pure function — a home-grown
      // derivation would break this equality
      expect(badge.getAttribute('data-readiness-derived')).toBe(readinessState(c.wf, c.ctx));
      unmount();
    }
  });

  it('never invents a host state — apto-para-integracao stays derived without hostStatus', () => {
    const apto = CASES[4];
    const { container } = renderBadge({ workflow: apto.wf, context: apto.ctx });
    const badge = container.querySelector('[data-readiness]')!;
    expect(badge.getAttribute('data-readiness')).toBe('apto-para-integracao');
    expect(badge.getAttribute('data-readiness-host')).toBeNull();
    expect(badge.textContent).not.toMatch(/Executando|Running/);
  });

  it('shows a host runtime state ONLY when the host informs it (host authority)', () => {
    const apto = CASES[4];
    const { container } = renderBadge({ workflow: apto.wf, context: apto.ctx, hostStatus: 'executando' });
    const badge = container.querySelector('[data-readiness]')!;
    expect(badge.getAttribute('data-readiness')).toBe('executando');
    // the DERIVED state is still the ceiling — the host state is an overlay, not a derivation
    expect(badge.getAttribute('data-readiness-derived')).toBe('apto-para-integracao');
    expect(badge.getAttribute('data-readiness-host')).toBe('true');
    expect(badge.textContent).toMatch(/Executando/);
  });

  it('localizes the label (PT-BR) and carries an accessible name', () => {
    const { container } = renderBadge({ workflow: CASES[2].wf, context: CASES[2].ctx });
    const badge = container.querySelector('[data-readiness]')!;
    expect(badge.textContent).toBe('Validado');
    expect(badge.getAttribute('aria-label')).toMatch(/Prontidão: Validado/);
  });

  it('has no serious/critical axe violations', async () => {
    const { container } = renderBadge({ workflow: CASES[4].wf, context: CASES[4].ctx });
    const summary = await runAxe(container);
    if (summary.seriousOrWorse.length > 0) console.error(summary.seriousOrWorse.map(describeViolation).join('\n'));
    expect(summary.seriousOrWorse).toEqual([]);
  });
});
