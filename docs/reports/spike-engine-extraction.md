# Spike D18 — Extração do `@buildtovalue/engine` a partir do `simulation`

> **Data:** 2026-07-22 · **Fase:** F0b passo 0 (PLANO v1.2 §5, D18)
> **Pergunta do spike:** o que no pacote `simulation` é kernel puro de semântica de tokens ×
> o que é host/I-O, e qual o custo real de extrair o engine `advance(state, event)`?
> **Veredito: extração VIÁVEL, sem acoplamento grave. Não é caso de parar.**

## 1. Mapa kernel × host do pacote `simulation` (2.425 linhas em src/)

### Kernel puro (extraível — a semântica que o D10 proíbe reescrever)

| Arquivo | Linhas | O que é |
|---|---|---|
| `engine.ts` | 1.419 | Toda a semântica de tokens: passo (`step`/`emit`/`deliver`), split AND, sync join AND (`joinArrivals`), OR-join por dominadores, XOR/eventBased por decisão, boundary interruptivo/não-interruptivo (`applyBoundary`), matching de error/escalation em 4 tiers, signal broadcast / message single-delivery, event subprocess, compensação, **replay determinístico de cenário** |
| `graph.ts` | 174 | `buildSimGraph`: grafo de fluxo derivado do `BpmnDiagram` usando os classificadores de `@buildtovalue/core` (`isFlowNode`/`flowScopeOf` — os MESMOS do soundness, por construção) |
| `dominators.ts` | 126 | Cooper–Harvey–Kennedy para a regra de convergência do OR-join |
| `types.ts` | 361 | Tipos serializáveis (JSON puro) — `Decision` ordenada É o cenário |
| `scenario.ts` | 76 | JSON canônico + hash estável do cenário (base do replay como contrato, D6) |

**Pureza verificada por grep + leitura:** zero ocorrências de `Date`, `Math.random`,
`setTimeout`, `node:` ou I/O em todo o `src/`. Timestamps e autor entram **injetados pelo
host** (`session.ts` declara: "the package never reads a clock"). O único `async` é o
`hashScenario` (WebCrypto via `core.sha256Hex`) — fica FORA do kernel extraído (a
`effect_key` é do host, D11). A avaliação de decisão (S-FEEL/DMN) já é **injetada** via
interface `DecisionEvaluator` — o padrão de injeção que o engine da plataforma reutilizará.

### Host/I-O (fica onde está)

`session.ts` (empacotamento p/ ledger, autor/timestamp do host), `coverage.ts` (cobertura
estrutural p/ UI), e toda a camada de overlay/animação em `packages/react`.

## 2. O que a extração precisa MUDAR (o custo real)

O kernel é puro mas tem **forma de classe mutável small-step** (`SimulationEngine.advance()`
avança 1 hop; estado em campos privados). O contrato do ADR-0001 é
`advance(state, event) → {state', effects}` funcional. As transformações:

1. **Reshape classe→função pura** — externalizar o estado (`tokens`, `joinArrivals`,
   `sequence`, `status`) num `InstanceState` explícito e transformar os métodos de transição
   em funções sobre ele. A semântica migra quase verbatim; muda o invólucro. **~3–5 dias.**
2. **Esperas explícitas + run-to-quiescence** — no simulador, "token parado num nó" é a
   espera implícita e o host chama `advance()` de novo; na plataforma, o `advance(event)`
   roda micro-steps até TODOS os tokens estarem em espera declarada (`Wait{userTask|job|
   timer, waitKey}`) ou consumidos, emitindo efeitos (`OpenUserTask`, `CreateJob`,
   `ScheduleTimer`…). Código novo, mas em cima da mesma máquina de passos. **~3–4 dias.**
3. **Ids de token determinísticos** — hoje `t${seq++}` (determinístico por ordem, mas
   posicional); ADR-0001 exige derivação do pai (`${parentTokenId}/${outgoingFlowId}`).
   Mudança localizada em `placeToken`/`emit`. Consequência para a equivalência: comparar
   marking por **multiset de elementIds** (posição), não por id de token. **~1 dia.**
4. **Condições S-FEEL em gateways** — o simulador resolve XOR por `Decision` explícita do
   usuário; a plataforma avalia `conditionExpression` sobre `event.variables` (com default
   flow). Avaliador injetado (mesmo padrão do `DecisionEvaluator`), implementação com
   `@buildtovalue/sfeel` (puro). **~2 dias.**
5. **Timer como espera de primeira classe** — o simulador não modela tempo; a plataforma
   emite `ScheduleTimer{fireAt}` (calculado do ISO-8601 do modelo + `event.now`) e consome
   `TimerFired{waitKey}`. **~1–2 dias.**
6. **Harness de equivalência simulation×engine** — corpus FILTRADO ao subconjunto v1
   (fixtures de OR/compensação/escalation/signal/message com skip explícito `todo:F5`),
   comparação por `canonicalJsonExact` de marking+trail projetados; cada fixture equivalente
   gera fixture de replay (D6). Base: 15 arquivos de teste (2.213 linhas) + fixtures do
   `simulation`, mais o corpus do `conformance`. **~2–3 dias.**
7. **Lint de pureza + CI** (proibir `node:*`, `Date`, `Math.random`, async no pacote) —
   **~1 dia.**

**Estimativa total F0b.2–F0b.4 (engine + equivalência): ~2–3 semanas.** Dentro do previsto
no plano; nenhum acoplamento grave encontrado.

## 3. Achados que alimentam o ADR-0001 (decisões de formato a apresentar)

- **`joinArrivals` precisa viver no estado persistido.** O rascunho do Anexo A tem
  `tokens[]` + `waits[]`, mas um AND-join parcial (1 de 2 chegadas) é estado real entre
  avanços — no simulador ele vive em `joinArrivals: Map<join, Set<edge>>`. Sem persisti-lo,
  um `advance()` que pare com join parcial perde a chegada. As alternativas de formato do
  ADR-0001 tratam disso explicitamente (campo `joinArrivals` × token-em-aresta).
- **Escopo semântico v1 < escopo do simulador.** OR-join (dominadores), compensação,
  escalation, signal/message e event subprocess **não entram** no engine v1 (D19 os rejeita
  no deploy). A extração v1 leva: sequência, XOR (com condições), AND fork/join, user task,
  service task, timer intermediário + boundary simples sobre user task, fim/cancelamento.
  O simulador segue existindo com o escopo maior — nada é descartado.
- **Replay já é cultura da biblioteca.** `SimulationEngine.replay(diagram, scenario)`
  reconstrói execuções bit-a-bit e o cenário tem JSON canônico + hash — o contrato D6 do
  engine nasce do mesmo molde.

## 4. Riscos remanescentes

| Risco | Mitigação |
|---|---|
| Divergência sutil de semântica no reshape classe→função | Equivalência por fixture em CI (100% automatizada) ANTES de promover o engine a estável |
| Ids novos de token quebrarem comparação com o sim | Comparar marking por elementId (multiset), não por token id — decidido já no harness |
| Formato de estado fechar migração futura | ADR-0001 com alternativas ao dono ANTES de código (gate mantido) |

## 5. Próximo passo

ADR-0001 redigido a partir do Anexo A v1.2 com **3 alternativas de formato** e trade-offs:
`docs/adr/ADR-0001-instance-state-eventos-efeitos.md`. **Aguarda aprovação do dono antes de
qualquer código do engine.**
