import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import type { ReplayAnalysis } from '@buildtovalue/replay';
import {
  latestReplayAnalysis,
  replayAnalysisEntry,
  REPLAY_ANALYSIS_TYPE,
} from '../src/index.js';

const analysis: ReplayAnalysis = {
  diagramId: 'onboarding',
  versionId: 'v20',
  semanticVersion: '2.0.0',
  totalCases: 1240,
  fitness: 0.912,
  bottleneck: { nodeId: 'plan', label: 'Gerar plano', avgMs: 31 * 3_600_000 },
  topDeviation: { from: 'brief', to: 'plan', label: 'Coletar briefing → Gerar plano', cases: 96, share: 0.077 },
  candidateSemanticVersion: '2.1.0',
  author: 'ana',
  timestamp: '2026-07-09T00:00:00.000Z',
  headline: 'O gargalo real da v2.0.0 é "Gerar plano" (⌀ 31 h) — a v2.1.0 ataca isso: timer 48h',
};

describe('replayAnalysisEntry → ledger', () => {
  it('maps the analysis and attaches it to the candidate version', async () => {
    const ledger = new AuditLedger();
    const entry = await ledger.append(replayAnalysisEntry(analysis, { id: 'aprovador' }, 'v21'));
    expect(entry.type).toBe(REPLAY_ANALYSIS_TYPE);
    expect(entry.userId).toBe('aprovador');
    expect(entry.versionId).toBe('v21'); // attached to the candidate, not the analyzed version
    expect(entry.details).toMatchObject({
      artifactId: 'onboarding',
      analyzedVersion: '2.0.0',
      bottleneck: 'Gerar plano',
      deviation: 'Coletar briefing → Gerar plano',
      deviationCases: 96,
      candidateVersion: '2.1.0',
    });
  });

  it('defaults the attachment to the analyzed version', async () => {
    const ledger = new AuditLedger();
    const entry = await ledger.append(replayAnalysisEntry(analysis));
    expect(entry.versionId).toBe('v20');
    expect(entry.userId).toBe('ana');
  });
});

describe('latestReplayAnalysis', () => {
  it('reads back the most recent attached analysis for a version', async () => {
    const ledger = new AuditLedger();
    await ledger.append(replayAnalysisEntry(analysis, { id: 'a' }, 'v21'));
    await ledger.append(replayAnalysisEntry({ ...analysis, headline: 'nova análise' }, { id: 'a' }, 'v21'));
    const read = latestReplayAnalysis(ledger.getEntries(), 'v21');
    expect(read).toMatchObject({
      headline: 'nova análise', // last wins
      fitness: 0.912,
      totalCases: 1240,
      bottleneck: 'Gerar plano',
      deviationCases: 96,
      author: 'a',
    });
  });

  it('degrades to undefined when no analysis is attached', () => {
    const ledger = new AuditLedger();
    expect(latestReplayAnalysis(ledger.getEntries(), 'v21')).toBeUndefined();
  });
});
