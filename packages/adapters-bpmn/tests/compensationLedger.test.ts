import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import { compensationTriggeredEntry, COMPENSATION_TRIGGERED_TYPE } from '../src/index.js';

/**
 * Handoff 19 §6e — compensation → ledger glue. PURE builder (motor intacto); o
 * HOST appenda quando a compensação ACONTECE (a cola runtime é o callback do
 * demo, caminho a). A entrada amarra o plano EXECUTADO: compensated em ordem
 * reversa + uncompensated declaradas. `details.author` ia.copilot@ dispara o
 * selo ✦ (regra do `aiAuthorOf`); humano não.
 */
describe('compensationTriggeredEntry builder (§6e)', () => {
  const base = { diagramId: 'd1', versionId: 'v-1.0' };
  const isAiSeal = (author: unknown) => typeof author === 'string' && author.startsWith('ia.copilot@');

  it('mapeia scope/compensated/uncompensated; author em details para o selo ✦', () => {
    const entry = compensationTriggeredEntry({
      ...base,
      scope: 'broadcast',
      actor: { id: 'ia.copilot@claude-4' },
      compensated: [
        { activity: 'Comprar passagem', handler: 'Estornar passagem' },
        { activity: 'Reservar hotel', handler: 'Cancelar reserva' },
      ],
      uncompensated: [{ activity: 'Pagar cartão', reason: 'no handler ⟲' }],
    });
    expect(entry.type).toBe(COMPENSATION_TRIGGERED_TYPE);
    expect(entry.userId).toBe('ia.copilot@claude-4');
    expect(entry.details).toMatchObject({
      diagramId: 'd1',
      scope: 'broadcast',
      author: 'ia.copilot@claude-4',
    });
    // A ordem reversa é preservada; as uncompensated são declaradas.
    expect(entry.details?.compensated).toEqual([
      { activity: 'Comprar passagem', handler: 'Estornar passagem' },
      { activity: 'Reservar hotel', handler: 'Cancelar reserva' },
    ]);
    expect(entry.details?.uncompensated).toEqual([{ activity: 'Pagar cartão', reason: 'no handler ⟲' }]);
    // ✦ pinta para IA.
    expect(isAiSeal(entry.details?.author)).toBe(true);
  });

  it('host-append: IA (✦) e humano (sem ✦) na MESMA trilha; a cadeia verifica', async () => {
    const ledger = new AuditLedger();
    await ledger.append(
      compensationTriggeredEntry({
        ...base,
        scope: 'broadcast',
        actor: { id: 'ia.copilot@claude-4' },
        compensated: [{ activity: 'Reservar hotel', handler: 'Cancelar reserva' }],
        uncompensated: [],
      }),
    );
    await ledger.append(
      compensationTriggeredEntry({
        ...base,
        scope: 'Reservar hotel',
        actor: { id: 'ana.ruiz' },
        compensated: [{ activity: 'Reservar hotel', handler: 'Cancelar reserva' }],
        uncompensated: [],
      }),
    );
    const entries = ledger.getEntries();
    expect(entries.map((e) => e.type)).toEqual([COMPENSATION_TRIGGERED_TYPE, COMPENSATION_TRIGGERED_TYPE]);
    // ✦ presente para a IA, ausente para o humano (regra do aiAuthorOf).
    expect(isAiSeal(entries[0].details.author)).toBe(true);
    expect(isAiSeal(entries[1].details.author)).toBe(false);
    expect((await ledger.verify()).valid).toBe(true);
  });
});
