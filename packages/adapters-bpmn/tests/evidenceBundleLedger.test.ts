import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import type { SquadFact, SquadSimResult } from '@buildtovalue/agentflow';
import {
  EVIDENCE_BUNDLE_TYPE,
  buildEvidenceBundle,
  canonicalEvidenceBundle,
  hashEvidenceBundle,
  evidenceBundleEntry,
  evidenceBundleOf,
  createInMemoryExecutionStore,
  type EvidenceBundleMeta,
  type ExecutionStore,
} from '../src/index.js';

/**
 * Squad Lane SL-11 — EvidenceBundle as a canonical audit entry (acceptance
 * §10.4): canonical JSON export, `verify()` validates without new code, the
 * three governance refs mandatory, `fixture × evidencia-declarada` preserved.
 * The ExecutionStore seam is injected + degradable.
 */
const fact = (over: Partial<SquadFact> & { step: number }): SquadFact => ({
  agent: 'pesquisador',
  agentRef: 'agnt-rsch@2.1.0',
  kind: 'acao',
  source: 'fixture',
  message: `m${over.step}`,
  ...over,
});

const result = (): SquadSimResult => ({
  facts: [
    fact({ step: 0, kind: 'intencao' }),
    fact({ step: 1, kind: 'evidencia', source: 'evidencia-declarada', io: { output: { answer: '···' } } }),
  ],
  perAgent: {},
  order: ['orch', 'pesquisador'],
  complete: true,
  blocked: null,
});

const meta = (over: Partial<EvidenceBundleMeta> = {}): EvidenceBundleMeta => ({
  squadRef: 'sqd-doc-review@1.0.0',
  versionId: 'sqd-doc-review@1.0.0',
  policyRefs: ['pol:lgpd@1.0.0'],
  decisionRuleRefs: ['dmn:approval@1.0.0'],
  maskingPolicyRef: 'msk:pii-redact@1.0.0',
  ...over,
});

describe('buildEvidenceBundle — mandatory governance refs (SL-11)', () => {
  it('captures the run + the three mandatory refs', () => {
    const b = buildEvidenceBundle(result(), meta());
    expect(b.kind).toBe('EvidenceBundle');
    expect(b.policyRefs).toEqual(['pol:lgpd@1.0.0']);
    expect(b.decisionRuleRefs).toEqual(['dmn:approval@1.0.0']);
    expect(b.maskingPolicyRef).toBe('msk:pii-redact@1.0.0');
    // fixture × evidencia-declarada preserved in the bundled trail
    expect(new Set(b.facts.map((f) => f.source))).toEqual(new Set(['fixture', 'evidencia-declarada']));
  });

  it('REFUSES a bundle whose masked trail names no masking policy (never unattributed)', () => {
    expect(() => buildEvidenceBundle(result(), meta({ maskingPolicyRef: '' }))).toThrow(/maskingPolicyRef/);
    expect(() => buildEvidenceBundle(result(), meta({ maskingPolicyRef: '   ' }))).toThrow(/maskingPolicyRef/);
  });

  it('does not alias the caller arrays (defensive copy)', () => {
    const refs = ['pol:a@1.0.0'];
    const b = buildEvidenceBundle(result(), meta({ policyRefs: refs }));
    refs.push('pol:b@2.0.0');
    expect(b.policyRefs).toEqual(['pol:a@1.0.0']);
  });
});

describe('canonicalEvidenceBundle + hashEvidenceBundle — determinism (§10.3/§10.4)', () => {
  it('exports byte-identical canonical JSON for the same bundle', () => {
    expect(canonicalEvidenceBundle(buildEvidenceBundle(result(), meta()))).toBe(
      canonicalEvidenceBundle(buildEvidenceBundle(result(), meta())),
    );
  });

  it('hashes identically 2× (SHA-256 over canonical JSON, core primitive)', async () => {
    const a = await hashEvidenceBundle(buildEvidenceBundle(result(), meta()));
    const b = await hashEvidenceBundle(buildEvidenceBundle(result(), meta()));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('evidenceBundleEntry — verified by the existing ledger, no new code (§10.4)', () => {
  it('appends to the chain and verifyLedger() validates it', async () => {
    const ledger = new AuditLedger();
    const bundle = buildEvidenceBundle(result(), meta());
    await ledger.append(evidenceBundleEntry(bundle, { id: 'ia.copilot@claude-4' }));
    const entries = ledger.getEntries();
    expect(entries[0].type).toBe(EVIDENCE_BUNDLE_TYPE);
    // the ✦ AI seal author + the mandatory refs are on the entry
    expect(entries[0].details).toMatchObject({
      artifactId: 'sqd-doc-review@1.0.0',
      author: 'ia.copilot@claude-4',
      maskingPolicyRef: 'msk:pii-redact@1.0.0',
    });
    // The ledger's own verify() validates the entry with NO evidence-specific
    // code (acceptance §10.4). `@buildtovalue/audit`'s verifyLedger recomputes
    // the identical core `computeEntryHash` (v2), so it validates equally — the
    // EvidenceBundle needs no bespoke verification path.
    expect((await ledger.verify()).valid).toBe(true);
    // Tampering with the recorded evidence breaks the chain (integrity holds).
    entries[0].details.maskingPolicyRef = 'msk:tampered@9.9.9';
    expect((await ledger.verify()).valid).toBe(false);
  });

  it('round-trips the bundle back out of the chain (chain IS the store)', async () => {
    const ledger = new AuditLedger();
    const bundle = buildEvidenceBundle(result(), meta());
    await ledger.append(evidenceBundleEntry(bundle));
    const back = evidenceBundleOf(ledger.getEntries()[0]);
    expect(back?.maskingPolicyRef).toBe('msk:pii-redact@1.0.0');
    expect(back?.policyRefs).toEqual(['pol:lgpd@1.0.0']);
    expect(back?.facts.map((f) => f.source)).toEqual(['fixture', 'evidencia-declarada']);
  });

  it('evidenceBundleOf ignores a non-evidence entry (degradable reader)', () => {
    expect(evidenceBundleOf({ type: 'SIMULATION_SESSION', versionId: 'v', details: {} })).toBeUndefined();
  });
});

describe('ExecutionStore — injected + degradable (SL-11)', () => {
  it('the in-memory store records + lists newest-first', async () => {
    const store = createInMemoryExecutionStore();
    const b1 = buildEvidenceBundle(result(), meta());
    const b2 = buildEvidenceBundle(result(), meta({ versionId: 'sqd-doc-review@1.1.0' }));
    await store.record(b1);
    await store.record(b2);
    const listed = await store.list!('sqd-doc-review@1.0.0');
    expect(listed).toHaveLength(2);
    expect(listed[0].versionId).toBe('sqd-doc-review@1.1.0'); // newest first
  });

  it('a consumer without a store still produces the bundle (degradable)', () => {
    // A host that injects no store persists nothing; the bundle is still built
    // and can still be appended to the ledger — persistence is optional glue.
    const persist = (bundle: ReturnType<typeof buildEvidenceBundle>, store?: ExecutionStore): void => {
      store?.record(bundle); // no-op when the seam is absent
    };
    const bundle = buildEvidenceBundle(result(), meta());
    expect(() => persist(bundle)).not.toThrow(); // no store injected
    expect(bundle.kind).toBe('EvidenceBundle');
  });
});
