# @buildtovalue/engine

Kernel determinístico de execução BPMN da plataforma BuildToValue:
`advance(state, event) → { state, effects }`, **puro** — sem relógio,
aleatoriedade, async ou I/O (vetado por teste de pureza). Extraído da semântica
de tokens do `@buildtovalue/simulation` (ADR-0001, D10).

## Contrato

- **`InstanceState`** serializável (JSONB no host): `tokens` (ids
  determinísticos derivados do pai), `waits` (`userTask|job|timer`, com
  `waitKey = elementId:tokenId`), `joinArrivals` (chave composta
  `join@escopo`, listas canônicas), `sequence`, `status`.
- **Eventos**: `StartInstance`, `UserTaskCompleted`, `JobCompleted`,
  `JobFailed`, `TimerFired`, `CancelInstance` — todos com `now` e `variables`
  fornecidos pelo host.
- **Efeitos**: `OpenUserTask`/`CloseUserTask`, `CreateJob`/`CancelJob`,
  `ScheduleTimer`/`CancelTimer`, `EmitHistory`, `RaiseIncident`,
  `CompleteInstance`. O host atribui `effect_key` (D11) e executa.
- **`AdvanceResult`**: rejeição de negócio (`ok:false` tipado — 409/422 no
  host) ≠ defeito interno (`EngineInvariantError` lançada — abortar tx).
- `advance` **nunca retorna variáveis** (D13); condições S-FEEL avaliam via
  `ConditionEvaluator` injetado.

## Subset semântico v1

Fluxo sequencial · XOR com condições/default (convenção do lint
`EXEC_UNCONDITIONED_FLOWS`) · AND fork/join · user task · service task (job)
· timer intermediário e boundary (interruptivo e não) · cancelamento com
fechamento de esperas. Qualquer outro elemento: `RaiseIncident` estrutural
(D19 — o deploy lint deve rejeitar antes).

## Garantias testadas

- Mesma `(state, event)` ⇒ mesma `(state', effects)` **byte-idêntica** sob
  `canonicalJsonExact` (invariante 2 — inclusive `joinArrivals`).
- Fixtures obrigatórias do ADR-0001 (condição d): join incompleto sobrevive a
  persistir/recarregar/retomar; dupla chegada pelo mesmo fluxo não infla o
  set; cancelamento limpa as chegadas do escopo.
- Pureza: `Date.now`/aleatoriedade/async/`node:*` proibidos no src (teste).
