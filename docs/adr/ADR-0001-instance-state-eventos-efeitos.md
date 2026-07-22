# ADR-0001 — `InstanceState`, eventos e efeitos do `@buildtovalue/engine`

> **Status:** APROVADO pelo dono em 2026-07-22 — Alternativa A, com as quatro condições
> da seção "Condições de aprovação" incorporadas. Gate da F0b.2 liberado.
> **Base:** Anexo A do PLANO-buildtovalue-platform-v1.2 (rascunho v2, já corrigido),
> adotado integralmente como Alternativa A e ajustado por UM achado do spike D18
> (`joinArrivals` — ver §Contexto). Alternativas B e C apresentadas com trade-offs,
> conforme política 3.2 do plano.

## Contexto

O engine determinístico (`advance(state, event) → {state', effects}`, D2) é extraído do
pacote `simulation` (D10 — spike em `docs/reports/spike-engine-extraction.md`). O formato do
`InstanceState` é **irreversível na prática**: ele é persistido em `instances.state` (JSONB),
é a base do replay-como-contrato (D6) e da migração de instâncias futura (D14/F5). Por isso
este ADR decide o formato ANTES de qualquer código.

**Achado do spike que o Anexo A não cobria:** um AND-join parcialmente sincronizado
(1 de 2 chegadas) é estado real entre avanços — no `simulation` vive em
`joinArrivals: Map<joinId, Set<edgeId>>`. Se não for persistido, um avanço que pare com join
parcial perde a chegada. As alternativas abaixo diferem exatamente em COMO representar isso.

## Escopo comum às três alternativas (fixo, vindo do Anexo A v1.2)

- `advance` pura: sem I/O, `Date`, `Math.random`, async; `now` e `variables` entram no
  evento; mesmo `(state, event)` ⇒ mesmos `(state', effects)` byte-idênticos sob
  `canonicalJsonExact`.
- `AdvanceResult` tipado: rejeição de negócio (`ok:false`, host responde 409/422, estado
  intacto) ≠ defeito interno (`EngineInvariantError` lançada, host aborta tx + alerta
  crítico). Bug nunca vira incidente silencioso.
- Catálogo fechado de efeitos: `CreateJob`, `OpenUserTask`, `CloseUserTask`, `CancelJob`,
  `ScheduleTimer`, `CancelTimer`, `EmitHistory`, `RaiseIncident`, `CompleteInstance`.
  Cancelamento/interrupção emite Close/Cancel para TODAS as esperas afetadas.
- Eventos: `StartInstance`, `JobCompleted`, `JobFailed`, `TimerFired`, `UserTaskCompleted`,
  `CancelInstance` — **todos** com `variables` (qualquer um pode desembocar em gateway).
- `waitKey` determinística gerada pelo ENGINE (`${elementId}:${tokenId}`); host mapeia
  `waitKey ↔ effect_key` (D11).
- Ids de token derivados do pai (`${parentTokenId}/${outgoingFlowId}`; raiz = `instanceId`).
- `advance()` NUNCA retorna variáveis de negócio (D13); entram via `event.variables`, saem
  via payload de efeitos.
- `stateSchemaVersion` + referências por `elementId` (D14); elemento fora do escopo v1 ⇒
  rejeição no deploy (lint, D19) e `RaiseIncident` defensivo no runtime.

---

## Alternativa A (RECOMENDADA) — Anexo A + campo explícito `joinArrivals`

O rascunho do Anexo A, verbatim, com um campo a mais no estado:

```ts
interface InstanceState {
  stateSchemaVersion: number;
  engineVersion: string;
  definitionRef: { registryRef: string; bpmnVersion: string };
  tokens: Token[];               // SEMPRE por elementId (D14)
  waits: Wait[];
  /** AND-joins parcialmente sincronizados. Chave COMPOSTA `${joinElementId}@${scopeId}`
   *  (condição (a) da aprovação) → edgeIds já entregues, SEMPRE em ordem lexicográfica
   *  (condição (c): a invariante 2 — byte-identidade sob canonicalJsonExact — vale
   *  para este campo). Achado do spike D18; espelha o joinArrivals do simulation. */
  joinArrivals: Record<string, string[]>;
  sequence: number;
  status: 'active'|'completed'|'cancelled'|'incident';
}
interface Token { id: string; elementId: string; scopeId: string; parentTokenId?: string }
interface Wait  { kind: 'userTask'|'job'|'timer'; elementId: string; tokenId: string; waitKey: string }
```

(Eventos, efeitos e `AdvanceResult` exatamente como no Anexo A v1.2.)

- **Prós:** mapeamento 1:1 com o `simulation` (extração mais literal possível — menor risco
  de divergência semântica no reshape); estado legível/auditável ("o que está esperando
  onde" é lido direto); equivalência sim×engine trivial de projetar.
- **Contras:** um campo a mais para o `StateMigrator` carregar para sempre; token absorvido
  num join parcial "some" de `tokens[]` (fica representado só na chegada) — quem ler o
  estado precisa saber disso.
- **-ilities:** testabilidade e migrabilidade máximas; performance O(tokens) por avanço;
  segurança: estado nunca contém dados de formulário (D13).

## Alternativa B — Token-em-espera-de-join (sem campo extra)

Sem `joinArrivals`: um token que chega a um AND-join incompleto NÃO é absorvido — vira
`Wait{kind:'join', elementId: joinId, tokenId, waitKey}` e permanece em `tokens[]`. O join
dispara quando todas as arestas de entrada têm um token esperando nele.

- **Prós:** invariante mais simples ("todo estado vivo é um token"); `tokens[]` conta a
  história completa; nenhum campo novo no schema.
- **Contras:** **diverge da semântica implementada** no `simulation` (absorção em
  `joinArrivals`) — o reshape deixa de ser extração literal exatamente no ponto mais sutil
  (sincronização), a classe de bug mais cara (achado B4 / D10); precisa registrar POR QUAL
  aresta o token chegou (campo extra no Token ou na Wait de join); `waits` ganha um kind que
  não corresponde a efeito nenhum (join não abre tarefa/job/timer — assimetria no catálogo).
- **-ilities:** legibilidade boa; risco de manutenção maior no núcleo de sincronização.

## Alternativa C — Estado compacto orientado a marking (arestas marcadas)

Representação estilo rede de Petri: `marking: Record<edgeId, count>` + `waits[]`; tokens não
são entidades nomeadas, apenas contagens em arestas/nós.

- **Prós:** menor footprint em JSONB; formato clássico e matematicamente elegante;
  AND-join resolvido naturalmente pela contagem.
- **Contras:** **quebra D14** na prática — sem identidade de token não há `parentTokenId`
  nem derivação determinística de ids, e a migração de instâncias (F5) e o rastreio
  waitKey↔token ficam sem âncora; ilegível para auditoria/suporte ("de onde veio este
  token?" não tem resposta); distância máxima do `simulation` (reescrita, não extração —
  viola o espírito do D10).
- **-ilities:** performance/armazenamento ligeiramente melhores; auditabilidade,
  testabilidade de equivalência e migrabilidade sensivelmente piores.

## Condições de aprovação (dono, 2026-07-22 — vinculantes antes do 1º commit do engine)

(a) **`joinArrivals` chaveado por `(joinElementId, scopeId)`** — chave composta
`${joinElementId}@${scopeId}`, nunca só o elementId: o mesmo join pode existir em escopos
distintos e as sincronizações não podem se misturar.

(b) **Cancelamento e boundary interruptivo LIMPAM as entradas do escopo afetado** — ao
cancelar a instância ou interromper um escopo, toda entrada de `joinArrivals` daquele
escopo é removida no MESMO avanço que emite os `Close/Cancel` das esperas (nunca sobra
chegada órfã de escopo morto).

(c) **Serialização canonicamente ordenada do campo** — chaves do record em ordem
lexicográfica e cada lista de edgeIds ordenada; a invariante 2 (mesmos `(state, event)` ⇒
bytes idênticos sob `canonicalJsonExact`) vale para `joinArrivals` como para o resto.

(d) **Fixtures obrigatórias no corpus de replay** (falha em CI se ausentes):
  1. parada com join incompleto → persistir → recarregar → retomar (a chegada sobrevive);
  2. loop com dupla chegada pelo MESMO fluxo (a segunda chegada não infla o set);
  3. join em escopo cancelado (as entradas somem junto com o cancelamento — condição b).

## Decisão

**Alternativa A.** É a única que preserva simultaneamente: extração literal do `simulation`
(D10), identidade de token exigida pela migração futura (D14) e legibilidade auditável do
estado (trade-off já aceito conscientemente no Anexo A: "verboso HOJE para viabilizar a
migração AMANHÃ"). O custo — um campo `joinArrivals` no schema — é pago uma vez e coberto
pelo `StateMigrator` desde a v1.

**Trade-offs (G-ARQ-2):** os do Anexo A v1.2, mais: campo `joinArrivals` explícito aumenta
o schema mas elimina a alternativa de re-derivar chegadas do histórico (re-derivação seria
I/O no engine — violaria D2).

## Consequências

- F0b.2 implementa o engine sobre este formato; equivalência sim×engine compara marking por
  multiset de `elementId` + `joinArrivals` (ids de token diferem por construção).
- Migração 0002+ da plataforma persiste `InstanceState` como JSONB opaco versionado
  (`state_schema_version` espelhado em coluna).
- Qualquer mudança futura de formato = `migrateState(vN→vN+1)` pura testada por replay.
