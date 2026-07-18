import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import { escalationRaisedEntry, ESCALATION_RAISED_TYPE } from '../src/index.js';

/**
 * Handoff 18 §5c — escalation → ledger glue. PURE builder (motor intacto); the
 * HOST appends via its `command.executed` glue. Reforço 7: `ESCALATION_RAISED`
 * means the escalation HAPPENED, never that a boundary was drawn — so the
 * append here is driven by a DEMONSTRATIVE trigger in the test, not by any
 * diagram edit. The real runtime glue (append when `throwEscalation` fires)
 * lands in EC-5.
 */
describe('escalationRaisedEntry builder (§5c)', () => {
  const base = { diagramId: 'd1', versionId: 'v-1.0', nodeId: 'bnd' };

  it('mapeia actor/code/target para a entrada; author em details para o selo ✦', () => {
    const entry = escalationRaisedEntry({
      ...base,
      actor: { id: 'ia.copilot@claude-4' },
      code: 'OVER_BUDGET',
      target: 'Gate G2',
    });
    expect(entry.type).toBe(ESCALATION_RAISED_TYPE);
    expect(entry.userId).toBe('ia.copilot@claude-4');
    expect(entry.versionId).toBe('v-1.0');
    expect(entry.details).toMatchObject({
      artifactId: 'bnd',
      diagramId: 'd1',
      author: 'ia.copilot@claude-4',
      code: 'OVER_BUDGET',
      target: 'Gate G2',
    });
  });

  it('code/target ausentes são omitidos (nunca chave vazia)', () => {
    const entry = escalationRaisedEntry({ ...base, actor: { id: 'ana.ruiz' } });
    expect(entry.details).not.toHaveProperty('code');
    expect(entry.details).not.toHaveProperty('target');
    // Humano: author presente mas SEM prefixo ia.copilot@ → o selo ✦ não pinta.
    expect(entry.details?.author).toBe('ana.ruiz');
  });

  it('host-append (gatilho demonstrativo): a entrada entra na cadeia e ela verifica', async () => {
    const ledger = new AuditLedger();
    // Gatilho demonstrativo — o host appenda quando a escalação ACONTECE (aqui,
    // uma chamada direta no teste; a cola runtime é da EC-5). Duas escalações
    // na MESMA trilha: uma de IA, uma humana.
    await ledger.append(
      escalationRaisedEntry({ ...base, actor: { id: 'ia.copilot@claude-4' }, code: 'OVER_BUDGET', target: 'Gate G2' }),
    );
    await ledger.append(
      escalationRaisedEntry({ ...base, nodeId: 'bnd2', actor: { id: 'ana.ruiz' }, target: 'Gate G3' }),
    );
    const entries = ledger.getEntries();
    expect(entries.map((e) => e.type)).toEqual([ESCALATION_RAISED_TYPE, ESCALATION_RAISED_TYPE]);
    expect((await ledger.verify()).valid).toBe(true);
  });
});
