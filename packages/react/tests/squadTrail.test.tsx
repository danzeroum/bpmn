import { describe, expect, it } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { SquadFact, SquadSimResult } from '@buildtovalue/agentflow';
import { SquadTrail, PT_BR } from '../src/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.js';
import { describeViolation, runAxe } from './axeHelper.js';

/**
 * Squad Lane SL-10 — the squad fact trail: own virtualization (E8), filter by
 * agent/kind/error (D1), step mode with per-step context (D8), provenance labels
 * (E6). Renders the headless artifact; invents nothing.
 */
function fact(over: Partial<SquadFact> & { step: number }): SquadFact {
  return { agent: 'pesquisador', agentRef: 'agnt-rsch@2.1.0', kind: 'acao', source: 'fixture', message: `m${over.step}`, ...over };
}

function bigResult(n: number): SquadSimResult {
  const facts: SquadFact[] = Array.from({ length: n }, (_, i) =>
    fact({ step: i, agent: i % 2 === 0 ? 'pesquisador' : 'revisor', kind: i % 3 === 0 ? 'evidencia' : 'acao' }),
  );
  return { facts, perAgent: {}, order: ['pesquisador', 'revisor'], complete: true, blocked: null };
}

const renderTrail = (result: SquadSimResult, height = 300) =>
  render(
    <I18nProvider messages={PT_BR}>
      <SquadTrail result={result} height={height} />
    </I18nProvider>,
  );

describe('SquadTrail — virtualization (E8)', () => {
  it('mounts only a bounded window of rows for a large trail (own windowing)', () => {
    const { container } = renderTrail(bigResult(1000));
    const spacer = container.querySelector('[data-trail-rendered]')!;
    const rendered = Number(spacer.getAttribute('data-trail-rendered'));
    // far fewer than 1000 rows in the DOM (viewport height / row height + overscan)
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(60);
    // the scroll spacer still reflects the full height (so the scrollbar is honest)
    expect((spacer as HTMLElement).style.height).toBe(`${1000 * 30}px`);
  });

  it('renders more rows after scrolling (the window follows scrollTop)', () => {
    const { container } = renderTrail(bigResult(1000));
    const viewport = container.querySelector('[data-trail-viewport]')!;
    const firstSteps = () => [...container.querySelectorAll('[data-fact-step]')].map((e) => Number(e.getAttribute('data-fact-step')));
    expect(Math.min(...firstSteps())).toBe(0);
    fireEvent.scroll(viewport, { target: { scrollTop: 300 * 30 } });
    // after scrolling far down, the window no longer contains step 0
    expect(firstSteps().every((s) => s > 0)).toBe(true);
  });
});

describe('SquadTrail — filters (D1)', () => {
  it('filters by agent', () => {
    const { container } = renderTrail(bigResult(40));
    fireEvent.change(container.querySelector('[data-trail-filter-agent]')!, { target: { value: 'revisor' } });
    const agents = new Set([...container.querySelectorAll('[data-fact-agent]')].map((e) => e.getAttribute('data-fact-agent')));
    expect(agents).toEqual(new Set(['revisor']));
  });

  it('filters by kind', () => {
    const { container } = renderTrail(bigResult(40));
    fireEvent.change(container.querySelector('[data-trail-filter-kind]')!, { target: { value: 'evidencia' } });
    const kinds = new Set([...container.querySelectorAll('[data-fact-kind]')].map((e) => e.getAttribute('data-fact-kind')));
    expect(kinds).toEqual(new Set(['evidencia']));
  });

  it('filters to errors only', () => {
    const result: SquadSimResult = {
      facts: [fact({ step: 0 }), fact({ step: 1, kind: 'parada', error: true, message: 'stop' })],
      perAgent: {},
      order: [],
      complete: false,
      blocked: { agent: 'pesquisador', agentRef: 'agnt-rsch@2.1.0', nodeId: 'dec-3', reason: 'retry' },
    };
    const { container } = renderTrail(result);
    fireEvent.click(container.querySelector('[data-trail-errors-only]')!);
    const steps = [...container.querySelectorAll('[data-fact-step]')].map((e) => e.getAttribute('data-fact-step'));
    expect(steps).toEqual(['1']);
  });
});

describe('SquadTrail — step mode (D8)', () => {
  it('walks facts one at a time and shows the context at that step', () => {
    const result: SquadSimResult = {
      facts: [
        fact({ step: 0, kind: 'intencao', contextAfter: {} }),
        fact({ step: 1, kind: 'evidencia', io: { output: { answer: 'full' } }, contextAfter: { answer: 'full' } }),
      ],
      perAgent: {},
      order: [],
      complete: true,
      blocked: null,
    };
    const { container } = renderTrail(result);
    fireEvent.click(container.querySelector('[data-trail-step-mode]')!);
    expect(container.querySelector('[data-trail-step-label]')!.textContent).toMatch(/1.*2/); // step 1 of 2
    // advance to the evidence fact — its masked context shows
    fireEvent.click(within(container.querySelector('[data-trail-stepbar]') as HTMLElement).getByLabelText('Próximo passo'));
    expect(container.querySelector('[data-trail-step-label]')!.textContent).toMatch(/2.*2/);
    expect(container.querySelector('[data-trail-ctx-json]')?.textContent).toContain('answer');
  });
});

describe('SquadTrail — provenance (E6) + a11y', () => {
  it('labels each fact with its source (fixture vs declared evidence)', () => {
    const result: SquadSimResult = {
      facts: [fact({ step: 0, source: 'fixture' }), fact({ step: 1, source: 'evidencia-declarada' })],
      perAgent: {},
      order: [],
      complete: true,
      blocked: null,
    };
    const { container } = renderTrail(result);
    const sources = [...container.querySelectorAll('[data-fact-source]')].map((e) => e.getAttribute('data-fact-source'));
    expect(sources).toContain('fixture');
    expect(sources).toContain('evidencia-declarada');
  });

  it('marks declared evidence as UNVERIFIED, visually distinct from a verified state', () => {
    const result: SquadSimResult = {
      facts: [fact({ step: 0, source: 'fixture' }), fact({ step: 1, source: 'evidencia-declarada' })],
      perAgent: {},
      order: [],
      complete: true,
      blocked: null,
    };
    const { container } = renderTrail(result);
    const declared = container.querySelector('[data-fact-source="evidencia-declarada"]')!;
    const fixtureBadge = container.querySelector('[data-fact-source="fixture"]')!;
    // declared carries an explicit unverified marker + a caution flag glyph…
    expect(declared.getAttribute('data-unverified')).not.toBeNull();
    expect(declared.textContent).toContain('⚑');
    // …and its title says NOT verified (never a check/verified affordance)
    expect(declared.getAttribute('title')).toMatch(/not verified|não verificada/i);
    expect(declared.textContent).not.toMatch(/verified|verificad/i);
    // the fixture badge is neutral — no unverified marker, no flag
    expect(fixtureBadge.getAttribute('data-unverified')).toBeNull();
    expect(fixtureBadge.textContent).not.toContain('⚑');
  });

  it('has no serious/critical axe violations', async () => {
    const { container } = renderTrail(bigResult(30));
    const summary = await runAxe(container);
    if (summary.seriousOrWorse.length > 0) {
      console.error(summary.seriousOrWorse.map(describeViolation).join('\n'));
    }
    expect(summary.seriousOrWorse).toEqual([]);
  });
});
