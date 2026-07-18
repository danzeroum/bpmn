import type { GovernedEventDefinitionRecord } from '@buildtovalue/adapters-bpmn';
import type { EventDefinitionResolver } from '@buildtovalue/react';

/**
 * Demo catalog of governed event definitions (Handoff 16 E-3, §3b): the ONE
 * source both surfaces read — the editor's picker/seal through the injected
 * resolver and the Biblioteca card through `eventDefinitionCatalogAdapter`.
 * `pedido.aprovado@1.0.0` is the VIGENTE version; `@2.0.0` is a candidate, so
 * binding to it shows the ⚠ CANDIDATA seal (SIG_REF_STALE on Validate).
 */
export const DEMO_EVENT_CATALOG: GovernedEventDefinitionRecord[] = [
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
    kind: 'message',
    name: 'pagamento.confirmado',
    semanticVersion: '1.0.0',
    status: 'active',
    definition: { name: 'Pagamento confirmado' },
  },
  {
    kind: 'error',
    name: 'pagamento.recusado',
    semanticVersion: '1.0.0',
    status: 'active',
    definition: { name: 'Pagamento recusado', errorCode: 'PAY-402' },
  },
];

/**
 * The SYNCHRONOUS resolver the demo injects via `BpmnPlugin` — the react
 * editor never consults a registry; this closure is the whole contract.
 */
export const demoEventResolver: EventDefinitionResolver = {
  list: (kind) =>
    DEMO_EVENT_CATALOG.filter((record) => record.kind === kind).map((record) => ({
      name: record.name,
      semanticVersion: record.semanticVersion,
      status: record.status,
    })),
  resolve: (ref, kind) => {
    const at = ref.lastIndexOf('@');
    if (at <= 0) return undefined;
    const name = ref.slice(0, at);
    const semanticVersion = ref.slice(at + 1);
    const record = DEMO_EVENT_CATALOG.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.name === name &&
        candidate.semanticVersion === semanticVersion,
    );
    return record
      ? {
          name: record.name,
          semanticVersion: record.semanticVersion,
          status: record.status,
          definition: record.definition,
        }
      : undefined;
  },
};
