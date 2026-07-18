import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  eventBindingChangedEntry,
  eventDefinitionCatalogAdapter,
  EVENT_BINDING_CHANGED_TYPE,
  type GovernedEventDefinitionRecord,
} from '../src/index.js';

/**
 * Handoff 16 E-3 — catálogo de definições governadas (critério 5, molde
 * lintProfileAdapter: read-only, semântica de pin na ficha) + builder do
 * ledger para a troca explícita de ref (critério 4, molde reviewCommentEntry).
 */
const RECORDS: GovernedEventDefinitionRecord[] = [
  {
    kind: 'message',
    name: 'pedido.aprovado',
    semanticVersion: '1.0.0',
    status: 'active',
    definition: { name: 'Pedido aprovado' },
  },
  {
    kind: 'message',
    name: 'pedido.aprovado',
    semanticVersion: '2.0.0',
    status: 'candidate',
    definition: { name: 'Pedido aprovado (v2)' },
  },
  {
    kind: 'error',
    name: 'pagamento.recusado',
    semanticVersion: '1.0.0',
    status: 'active',
    definition: { name: 'Pagamento recusado', errorCode: 'PAY-402' },
  },
];

describe('eventDefinitionCatalogAdapter (E-3 critério 5)', () => {
  const adapter = eventDefinitionCatalogAdapter(RECORDS);

  it('lista UM cartão por nome, com a versão vigente e tipo DEFINIÇÃO DE EVENTO', async () => {
    const summaries = await adapter.list({});
    expect(summaries).toHaveLength(2);
    const pedido = summaries.find((summary) => summary.name === 'pedido.aprovado')!;
    expect(pedido.typeLabel).toBe('DEFINIÇÃO DE EVENTO');
    expect(pedido.version).toBe('1.0.0'); // a ATIVA, não a mais nova
    expect(pedido.status).toBe('active');
    expect(pedido.meta).toContain('mensagem');
    expect(pedido.ref).toEqual({ adapterId: 'event-definition', artifactId: 'pedido.aprovado' });
  });

  it('a ficha é READ-ONLY (sem ações) com a linha do tempo de versões e a semântica de pin', async () => {
    const detail = await adapter.get('pedido.aprovado');
    expect(detail.actions).toEqual([]);
    expect(detail.versions.map((entry) => `${entry.version}:${entry.status}`)).toEqual([
      '2.0.0:candidate',
      '1.0.0:active',
    ]);
    expect(detail.changeSummary).toContain('NUNCA move os vínculos');
    const error = await adapter.get('pagamento.recusado');
    expect(error.versions[0].note).toBe('Pagamento recusado (código PAY-402)');
  });

  it('id desconhecido → AdapterError nomeando o adapter', async () => {
    await expect(adapter.get('inexistente')).rejects.toThrow(AdapterError);
    await expect(adapter.get('inexistente')).rejects.toThrow(
      'adapter "event-definition": unknown definition "inexistente"',
    );
  });
});

describe('eventBindingChangedEntry (E-3 critério 4)', () => {
  it('mapeia a troca explícita de ref para uma entrada do ledger com from/to nomeados', () => {
    const entry = eventBindingChangedEntry({
      diagramId: 'demo-events',
      versionId: 'v1',
      nodeId: 'm1',
      actor: { id: 'ana.ruiz' },
      from: 'pedido.aprovado@1.0.0',
      to: 'pedido.aprovado@2.0.0',
    });
    expect(entry).toEqual({
      type: EVENT_BINDING_CHANGED_TYPE,
      userId: 'ana.ruiz',
      versionId: 'v1',
      details: {
        artifactId: 'm1',
        diagramId: 'demo-events',
        from: 'pedido.aprovado@1.0.0',
        to: 'pedido.aprovado@2.0.0',
      },
    });
  });

  it('primeiro vínculo omite from; desvincular omite to', () => {
    const first = eventBindingChangedEntry({
      diagramId: 'd',
      versionId: 'v',
      nodeId: 'n',
      actor: { id: 'demo' },
      to: 'a@1.0.0',
    });
    expect(first.details).toEqual({ artifactId: 'n', diagramId: 'd', to: 'a@1.0.0' });
    const unbind = eventBindingChangedEntry({
      diagramId: 'd',
      versionId: 'v',
      nodeId: 'n',
      actor: { id: 'demo' },
      from: 'a@1.0.0',
    });
    expect(unbind.details).toEqual({ artifactId: 'n', diagramId: 'd', from: 'a@1.0.0' });
  });
});
