import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import { categorizeEntry, describeEntry, filterEntries } from '../src/index.js';

async function seeded(): Promise<AuditLedger> {
  const ledger = new AuditLedger();
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'v2', details: { nodeId: 'auto', artifactId: 'onboarding' } });
  await ledger.append({ type: 'APPROVAL_RECORDED', userId: 'bruna', versionId: 'v2', details: { role: 'process-owner', artifactId: 'onboarding' } });
  await ledger.append({ type: 'VERSION_ACTIVATED', userId: 'ana', versionId: 'v2', details: { artifactId: 'onboarding' } });
  await ledger.append({ type: 'VERSION_ATTESTED', userId: 'ana', versionId: 'v2', details: { xmlHash: 'abc', artifactId: 'onboarding' } });
  await ledger.append({ type: 'NODE_MOVED_UNDONE', userId: 'ana', versionId: 'v9', details: {} });
  return ledger;
}

describe('categorizeEntry — função pura de categorização (§6/§8)', () => {
  it('maps types to the four canonical categories', () => {
    expect(categorizeEntry({ type: 'VERSION_ACTIVATED' })).toBe('promotion');
    expect(categorizeEntry({ type: 'VERSION_REGISTERED' })).toBe('promotion');
    expect(categorizeEntry({ type: 'APPROVAL_RECORDED' })).toBe('approval');
    expect(categorizeEntry({ type: 'PROMOTION_REJECTED' })).toBe('approval');
    expect(categorizeEntry({ type: 'NODE_ADDED' })).toBe('command');
    expect(categorizeEntry({ type: 'CHAIN_VERIFIED' })).toBe('verification');
    expect(categorizeEntry({ type: 'SIMULATION_SESSION' })).toBe('simulation');
    expect(categorizeEntry({ type: 'REPLAY_ANALYSIS_ATTACHED' })).toBe('replay');
    // undo/redo suffixes keep the base category; unknown falls to command
    expect(categorizeEntry({ type: 'VERSION_ACTIVATED_UNDONE' })).toBe('promotion');
    expect(categorizeEntry({ type: 'ALGO_EXOTICO' })).toBe('command');
  });
});

describe('filterEntries — o MESMO filtro alimenta trilha e export XES (§10.5)', () => {
  it('counts per category over the context set, before category narrowing', async () => {
    const ledger = await seeded();
    const { entries, counts } = filterEntries(ledger.getEntries(), { categories: ['approval'] });
    expect(entries.map((e) => e.type)).toEqual(['APPROVAL_RECORDED']);
    expect(counts).toEqual({ promotion: 2, approval: 1, command: 2, verification: 0, simulation: 0, replay: 0, total: 5 });
  });

  it('filters by artifact (versionId OU details.artifactId) and by period', async () => {
    const ledger = await seeded();
    const byArtifact = filterEntries(ledger.getEntries(), { artifactId: 'onboarding' });
    expect(byArtifact.entries).toHaveLength(4); // NODE_MOVED_UNDONE (v9, sem artifactId) fica fora
    const byVersion = filterEntries(ledger.getEntries(), { artifactId: 'v9' });
    expect(byVersion.entries.map((e) => e.type)).toEqual(['NODE_MOVED_UNDONE']);
    const entriesAll = ledger.getEntries();
    const cutoff = entriesAll[2].timestamp;
    const early = filterEntries(entriesAll, { until: cutoff });
    expect(early.entries.length).toBeLessThan(entriesAll.length);
    const late = filterEntries(entriesAll, { from: cutoff });
    expect(early.entries.length + late.entries.length).toBe(entriesAll.length);
  });

  it('no filter → everything, in chain order', async () => {
    const ledger = await seeded();
    const { entries } = filterEntries(ledger.getEntries());
    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('describeEntry', () => {
  it('renders the details as readable lines, with an empty-payload fallback', async () => {
    const ledger = await seeded();
    expect(describeEntry(ledger.getEntries()[0])).toEqual(['nodeId: auto', 'artifactId: onboarding']);
    expect(describeEntry(ledger.getEntries()[4])).toEqual(['(sem payload)']);
  });
});
