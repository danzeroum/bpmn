import { describe, expect, it } from 'vitest';
import {
  readinessState,
  RESEARCH_AGENT,
  type ReadinessContext,
  type ValidationIssue,
} from '../src/index.js';

const err: ValidationIssue = { code: 'X', severity: 'error', message: '' };

const base: ReadinessContext = {
  validation: [],
  hasEvidence: false,
};

describe('readinessState (Squad Lane SL-8, E1) — pure, single source', () => {
  it('an empty workflow is a rascunho', () => {
    expect(readinessState({ ...RESEARCH_AGENT, nodes: [] }, base)).toBe('rascunho');
  });

  it('a validation error keeps it a rascunho', () => {
    expect(readinessState(RESEARCH_AGENT, { ...base, validation: [err] })).toBe('rascunho');
  });

  it('clean but no evidence → validado', () => {
    expect(readinessState(RESEARCH_AGENT, base)).toBe('validado');
  });

  it('evidence but not all promotion conditions → simulado-com-evidencia', () => {
    expect(readinessState(RESEARCH_AGENT, { ...base, hasEvidence: true })).toBe(
      'simulado-com-evidencia',
    );
    // eval below threshold also stops short
    expect(
      readinessState(RESEARCH_AGENT, {
        ...base,
        hasEvidence: true,
        evalPassRate: 0.5,
        threshold: 1,
        gateCovered: true,
        signedActive: true,
      }),
    ).toBe('simulado-com-evidencia');
  });

  it('evidence + eval≥threshold + gate covered + signed active → apto-para-integracao (the ceiling)', () => {
    expect(
      readinessState(RESEARCH_AGENT, {
        ...base,
        hasEvidence: true,
        evalPassRate: 1,
        threshold: 1,
        gateCovered: true,
        signedActive: true,
      }),
    ).toBe('apto-para-integracao');
  });

  it('never derives a host state — even with a provider available, the ceiling holds', () => {
    const state = readinessState(RESEARCH_AGENT, {
      ...base,
      hasEvidence: true,
      evalPassRate: 1,
      threshold: 1,
      gateCovered: true,
      signedActive: true,
      providerAvailable: true,
    });
    expect(state).toBe('apto-para-integracao');
    // the union has no 'executando'/'erro-de-integracao' — those are host-only
    expect(['rascunho', 'validado', 'simulado-com-evidencia', 'apto-para-integracao']).toContain(state);
  });
});
