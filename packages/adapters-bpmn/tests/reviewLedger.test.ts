import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import {
  reviewCommentEntry,
  reviewThreadResolvedEntry,
  REVIEW_COMMENT_TYPE,
  REVIEW_THREAD_RESOLVED_TYPE,
} from '../src/index.js';

/**
 * Handoff 15 §2c — review → ledger glue. Every message and every resolution
 * is its OWN chain entry (types novos, motor intacto — the same discipline
 * as the simulation/replay/anchor entries); mixed authorship (C4) rides in
 * the details; the chain still verifies (hash v2).
 */
describe('reviewLedger entry builders (V-4)', () => {
  const thread = { id: 'th1', elementId: 'limit', versionRef: 'v-1.3' };

  it('cada mensagem e cada resolução é uma entrada própria; a cadeia verifica', async () => {
    const ledger = new AuditLedger();
    await ledger.append(reviewCommentEntry(thread, { author: 'ana.ruiz', text: 'SLA?' }));
    await ledger.append(
      reviewCommentEntry(thread, { author: 'ia.copilot@claude', text: 'Cobre.', aiAssisted: true }),
    );
    await ledger.append(reviewThreadResolvedEntry(thread, { id: 'ana.ruiz' }));
    const entries = ledger.getEntries();
    expect(entries.map((e) => e.type)).toEqual([
      REVIEW_COMMENT_TYPE,
      REVIEW_COMMENT_TYPE,
      REVIEW_THREAD_RESOLVED_TYPE,
    ]);
    expect((await ledger.verify()).valid).toBe(true);
  });

  it('detalhes carregam âncora, thread e autoria mista (filtro do Ledger Explorer)', async () => {
    const ledger = new AuditLedger();
    const entry = await ledger.append(
      reviewCommentEntry(thread, { author: 'ia.copilot@claude', text: 'Cobre.', aiAssisted: true }),
    );
    expect(entry.type).toBe(REVIEW_COMMENT_TYPE);
    expect(entry.userId).toBe('ia.copilot@claude');
    expect(entry.versionId).toBe('v-1.3');
    expect(entry.details).toMatchObject({
      threadId: 'th1',
      artifactId: 'limit',
      text: 'Cobre.',
      aiAssisted: true,
    });
    const resolved = await ledger.append(reviewThreadResolvedEntry(thread, { id: 'ana.ruiz' }));
    expect(resolved.type).toBe(REVIEW_THREAD_RESOLVED_TYPE);
    expect(resolved.userId).toBe('ana.ruiz');
    expect(resolved.details).toMatchObject({ threadId: 'th1', artifactId: 'limit' });
  });
});
