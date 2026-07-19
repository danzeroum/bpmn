# CO-0 — Reconciliação Handoff 19 (Compensação) × main

> Estado: **proposta para validação do owner**.
> Base: main `deb9c1d` (Handoffs 16–18 completos na main — E-* / #120–#127, ES-* / #128–#133,
> EC-* / #134–#140). Legenda: ✅ (existe e reusa por inteiro) / ⚠ (existe, precisa de
> aperto/extensão) / ⬜ (novo), com evidência nomeada (arquivo:linha / teste).
> **Docs-only** — toca ZERO pacote → sem changeset, sem código, sem apiSurface.

Este handoff **NÃO segue o caminho do H18** (§0.1 do README): não há root nomeado nem 5º bucket;
o `activityRef` do throw aponta para uma **atividade**, o handler liga por **associação** (nunca
fluxo) e carrega `isForCompensation`, o boundary ⟲ **não tem** `cancelActivity`, a execução de
referência é em **ordem reversa à conclusão**. A reconciliação abaixo confirma peça a peça o que a
main já tem — e, crucialmente, **corrige duas afirmações do §0.2** contra o código real.

---

## §A — ATENÇÃO ESPECIAL: o estado REAL do converter (o pedido explícito do owner)

### A.1 `bpmn:association` — ✅ **já é aresta de primeira classe e round-trip byte-estável**

Ao contrário do que o §0.2 sugere ("`bpmn:association` é PARENTE, reconciliar"), a associação
genérica **já existe como tipo de aresta embutido e já round-trippa hoje**, separada da
`dataAssociation` (F7-3, que é um tipo próprio `'dataAssociation'`):

| Fato | Evidência |
|---|---|
| `'association'` é tipo de aresta embutido | `core/model/types.ts:234` — `BUILT_IN_EDGE_TYPES = ['sequenceFlow','messageFlow','association']` |
| Excluída do fluxo (não é sequence flow) — simulação/soundness a ignoram por construção | `core/model/flow.ts:20-22` — `NON_FLOW_EDGE_TYPES` inclui `'association'` |
| **Export** nível-processo + aninhado | `BpmnXmlConverter.ts:206` e `elementSerializer.ts:252` — `edge.type === 'association' ? 'association' : 'sequenceFlow'`; `writeEdge(..., 'association')` emite `<bpmn:association id sourceRef targetRef/>` puro quando sem meta (`elementSerializer.ts:320-360`) |
| **Import** lê `<bpmn:association>` → `edge.type='association'` (NÃO descartada, NÃO vira foreignExtension) | `elementDeserializer.ts:94` (`tag === 'sequenceFlow' \|\| tag === 'association'`) + `:294` (`type: meta.type ?? defaultType`) |
| Round-trip byte-estável **já testado** | `core/tests/converter.test.ts:387-397` — "exports association edges as bpmn:association and round-trips them" (hoje via `textAnnotation`) |
| Linha de conformidade **já presente** | `conformance/src/matrix.ts:82` — `{ element: 'bpmn:association', status: 'supported', ... mappedTo: 'association' }` |

**Consequência para a CO-1:** a infra de aresta de associação **é reuso por inteiro** (zero fork —
cerca §1). O que é NOVO não é a aresta: é (a) **criar** a associação boundary⟲→handler (gesto/paleta,
CO-2/CO-3), (b) o **veto estrutural** "handler não recebe/emite sequence flow" (CO-1), (c) amarrar a
associação à **semântica** de compensação (o par boundary⟲ + associação + `isForCompensation`). A
promoção de conformidade que o §2 pede ("promove association") **já está feita** — resta só marcar o
`conformanceClass` se o owner quiser elevá-la de `descriptive`.

### A.2 `isForCompensation` no import — ⬜ **hoje é DESCARTADO em silêncio**

`readNode` trata atributos nativos caso a caso (`attachedToRef`, `cancelActivity`,
`triggeredByEvent`, `isInterrupting`, `calledElement`, `dataStoreRef`, `dataObjectRef`, `marker`) —
`elementDeserializer.ts:202-231`. **Não há ramo para `isForCompensation`.** E `withForeignAttributes`
só captura atributos **com prefixo** (`elementDeserializer.ts:316-325`, `name.indexOf(':') <= 0 →
continue`). Como `isForCompensation` é atributo BPMN **sem prefixo**, ele **não é lido em properties
nem preservado como foreign** → **perdido no import** hoje.

**Consequência para a CO-1:** o modelo precisa (a) **ler** `isForCompensation="true"` em
`properties.isForCompensation` (molde exato do `triggeredByEvent`, `:212`), e (b) **emitir** o
atributo nativo, com o default `false` **omitido** (molde do `reserved`/atributos nativos,
`elementSerializer.ts:116` + o ramo de boundary `:79`). RTL: `isForCompensation="false"` nunca é
escrito.

### A.3 `compensateEventDefinition` + o kind — ⬜ **não existe; e o nome importa**

O kind de compensação **NÃO existe** hoje: `compensat` (case-insensitive) tem **zero** ocorrências em
`core/src` e `react/src`. Especificamente:

- `EVENT_DEFINITION_KINDS` **não** inclui compensação — `core/model/types.ts:243-252` (message, timer,
  error, signal, escalation, conditional, link, terminate).
- O deserializer extrai o prefixo por `/^(.+)EventDefinition$/` (`elementDeserializer.ts:336`): de
  `compensateEventDefinition` sai **`compensate`**, mas `:338` rejeita porque não está na constante →
  hoje um boundary de compensação importaria como boundary **sem kind**.
- O serializer emite `bpmn:${eventDef}EventDefinition` (`elementSerializer.ts:229/233`).

> ⚠ **Isto contradiz o §0.2 do README** ("Kind `compensation` já existe no registry (H6) + glifo
> rewind"). Contra a main real, **o kind e o glifo são ⬜ NOVOS** — não há caso `compensation`/
> `compensate` em `eventGlyph` (`react/shapes/shapes.tsx:19-57`, `default: return null`). Registro,
> não reclamação: o desenho da CO-1/CO-2 assume NOVO, não extensão.

Ver **Conflito 1** para a decisão de nome (`compensate` vs `compensation`).

---

## §B — Reconciliação por painel

### 6a — Modelo + XML OMG (core, CO-1)
| Item | Estado | Evidência |
|---|---|---|
| `bpmn:association` como aresta | ✅ reusa por inteiro | ver §A.1 (`types.ts:234`, `flow.ts:22`, round-trip `converter.test.ts:387`) |
| `isForCompensation` no modelo (ler+emitir, default omitido) | ⬜ | ver §A.2 (`readNode` sem ramo; `withForeignAttributes` pula sem-prefixo) |
| Kind de compensação + `compensateEventDefinition` | ⬜ | ver §A.3 (`EVENT_DEFINITION_KINDS:243`; regex `:336`) |
| `compensateActivityRef` + `waitForCompletion` **só no throw** (default true omitido) | ⬜ | molde do `refAttrName`/atributos reservados (`elementSerializer.ts:121-135`, `:218-220`) — atributo do child do throw; catch nunca emite (cerca §1) |
| Boundary de compensação **sem** `cancelActivity` | ✅ por construção | export só escreve `cancelActivity` quando `isNonInterrupting` (`elementSerializer.ts` ramo boundary `:79`); basta **não** setar `cancelActivity` no kind |
| Veto estrutural core: handler (isForCompensation) não recebe/emite sequence flow | ⬜ (sobre canal ✅) | canal de veto estrutural ES-3 existe; a regra do handler é nova |
| Fixture congelada `compensationFrozen`; as 4 anteriores intactas | ⬜ (molde ✅) | `escalationFrozen` + `frozenDiagram()` (`core/tests/escalation.test.ts:35-63`, byte-assert `:328-329`) |
| Corpus ≥1 arquivo real (padrão book-hotel) com o trio importando sem warning | ⬜ | infra de corpus + `corpusExternal` já existe (H16/H17) |
| CONFORMANCE promove `compensate` (+ confirma `association`) | ⚠ | `association` já presente (`matrix.ts:82`); **falta a linha `bpmn:compensateEventDefinition`** (nenhuma ocorrência em `matrix.ts`) |

### 6b — Visual (react, CO-2)
| Item | Estado | Evidência |
|---|---|---|
| Glifo rewind ◀◀ da fonte única (throw cheio / catch vazado) | ⚠ estender | `eventGlyph` sem caso compensação (`shapes.tsx:19-57`); `filled` já distingue throw/catch (`:79/:114/:141/:170`) |
| Boundary de compensação **SEMPRE sólido**; toggle interrupting **ausente** | ⚠ estender | `InterruptingToggle` hoje mostra o toggle para **todo** boundary (`InterruptingToggle.tsx:31-33`, campo `cancelActivity` `:42`) → excluir o kind compensação |
| Associação tracejada **sem seta de fluxo** | ⚠ verificar render | aresta `'association'` existe no modelo; o render tracejado/sem-marcador da associação é o item novo do edge layer |
| Handler com marcador ◀◀ (molde marcadores F7) | ⬜ (molde ✅) | `ActivityMarker` loop/MI (`react/shapes/common.tsx:106-130`, render `:151`) |
| Chip «⟲ compensa: {nome\|escopo}» TRANSIENT | ⬜ (molde ✅) | molde do chip transiente da EC-2 (autoridade) |
| Paleta «Compensação (par)» = 1 composto (boundary+associação+handler) | ⬜ (molde ✅) | `buildEscalationBoundaryInsert` (`paletteInsert.ts:151-197`), item `paletteItems.ts:41` |
| Picker do throw lista **atividades compensáveis** do escopo (broadcast default) | ⬜ | novo — NÃO é picker de definições (não há bucket); molde de UI da EC-2, fonte diferente |

### 6c — Interações + lint → 1.4.0 (CO-3)
| Item | Estado | Evidência |
|---|---|---|
| Vetos declarados nos dois gestos (canal `lastVeto`/`announceVeto`) | ✅ canal | `DiagramContext.tsx:56/64/173`, 🔒 em `Toolbar.tsx:303-305`; callers `useInteractions.ts:703-704` |
| Gesto boundary⟲→task cria **associação** + `isForCompensation` (1 composto) | ⬜ | novo gesto, molde do composto ES-2 |
| `COMP_HANDLER_FLOW` (erro) | ⬜ | novo |
| `COMP_BOUNDARY_NO_HANDLER` (erro, quick-fix = builder da paleta) | ⬜ (molde ✅) | quick-fix compartilhado `typedMessageStartCommands`/`fixEvtSubprocStart` (`lint/index.ts:227,723-733`), registro `fixCommandFor` `:819` |
| `COMP_REF_NOT_COMPENSABLE` (warning) | ⬜ | novo — throw aponta atividade sem boundary ⟲ |
| `COMP_CATCH_ATTRS` (warning + preservação no soup) | ⬜ | novo — molde de passthrough |
| `EVT_SUBPROC_START` ganha compensation | ⚠ estender + migrar testes | `SUBPROC_TRIGGER_KINDS` (`lint/index.ts:211-219`) **exclui** compensação (comentário `:209`: "compensation stays in its own pendency" — este handoff) |
| `COMP_START_TOPLEVEL` (irmão de erro/escalação) | ⬜ (molde ✅) | `EVT_ERROR/ESCALATION_START_TOPLEVEL` (`lint/index.ts:361-395`) |
| Perfis 1.3.0 → 1.4.0 pela MESMA fonte | ⚠ bump | perfis versionados (EC-4 subiu p/ 1.3.0) |

### 6d — Simulação (CO-4)
| Item | Estado | Evidência |
|---|---|---|
| `compensate(scope\|activityRef)`: só COMPLETADAS, ordem REVERSA nomeada | ⬜ | novo; molde de disciplina `throwError`/`throwEscalation` (`engine.ts:407/534`) |
| **Fonte dos "completados"** = trilha de transitions | ⚠ decisão | `TransitionRecord` **não tem** tipo `'complete'` por atividade — só `'move'`/`'end'` (`types.ts:233-253`); derivar completados dos `'move'`/`'end'` (com `nodeId`) OU adicionar sinal — **ver Conflito 3** |
| Completada sem handler = linha declarada; nada completado = card com razão; específica não-compensável = parada declarada | ⬜ | molde das paradas honestas E-6/ES-5 |
| `waitForCompletion` true declarado na trilha | ⬜ | novo |
| esub de compensação dispara pelo mesmo `compensate` (tier de escopo ES-5) | ⬜ (molde ✅) | `catchByEventSubprocess`/tiers ES-5/EC-5 |
| `Decision` union ganha `compensate`; replay bit a bit; COMPAT E-6/ES-5/EC-5 | ⬜ (molde ✅) | union `types.ts:162-179` (sem `compensate`); dispatch/replay `engine.ts:328-330`/`:915-945`; `canonicalizeScenario` `scenario.ts:11` |
| `limitations.md` no MESMO PR (snapshot de variáveis; sem propagação a callActivity) | ⬜ | molde EC-5 |

### 6e — Ledger + demo (CO-5)
| Item | Estado | Evidência |
|---|---|---|
| `compensationTriggeredEntry({actor, scope, compensated[], uncompensated[]})` | ⬜ (molde ✅) | `escalationRaisedEntry` (`adapters-bpmn/escalationLedger.ts:22-44`), export `index.ts:32` |
| ✦ IA via `aiAuthorOf` (`details.author`) | ✅ molde | `escalationLedger.ts:38-39` |
| Demo appenda no compensate (caminho (a) — motor puro) | ✅ molde | `onEscalationThrown` da EC-5 (BpmnSimulator) |
| Demo «pacote de viagem» (`?compensation=1`) + esub de erro→reverter | ⬜ | novo demo (molde `?simulate=1&escalation=1`) |
| Marco "família OMG 100%" no CONFORMANCE/README | ⬜ | novo |
| Zero dependência nova entre pacotes | ✅ cerca | guard `no-runtime-deps` |
| Catálogo N-3 fica em 16 (nenhum evento novo) | ✅ | compensação reusa o kind de evento, não adiciona catálogo |

---

## §C — Conflitos / decisões para o owner (com recomendação)

1. **Nome interno do kind: `compensate` vs `compensation` (VINCULANTE).** O tag OMG é
   `compensateEventDefinition` (prefixo `compensate`). O serializer emite
   `bpmn:${eventDef}EventDefinition` e o deserializer extrai o prefixo por regex — **todo kind atual
   tem nome interno == prefixo OMG** (message/error/escalation…). **Recomendo o kind interno
   `compensate`** (entra em `EVENT_DEFINITION_KINDS`), round-trip OMG-correto com **zero** special-case;
   o rótulo de UI é "compensação"/"compensa" (i18n), o glifo é o caso `compensate`. Alternativa
   (`compensation` + mapeamento tag especial) adiciona um caminho fora do padrão — **não recomendo**.
   Registrar a decisão (o README §0.2 diz "compensation"; a FORMA OMG manda).

2. **Promoção de conformidade de `association` já feita (registro, não pergunta).** A linha
   `bpmn:association` já existe (`matrix.ts:82`, `descriptive`). A CO-1 promove **só**
   `bpmn:compensateEventDefinition` via o gerador; se o owner quiser, elevo o `conformanceClass` da
   association no mesmo passo. Confirmar se fica em `descriptive`.

3. **Fonte dos "completados" na simulação (decisão de CO-4, sinalizada agora).** A `TransitionRecord`
   não registra "atividade X completou" — o token que **sai** de uma atividade por um `'move'` (ou
   um `'end'`) é o sinal disponível hoje (`types.ts:233-253`). **Recomendo derivar os completados da
   própria trilha** (as atividades cujo token já avançou), sem novo tipo de record, mantendo replay
   byte-estável e COMPAT. Se o owner preferir um record `'complete'` explícito, é aditivo — mas mexe
   na trilha das 4 famílias anteriores (risco de byte-drift nos cenários). Decido na CO-4 conforme sua
   escolha; **recomendo derivar da trilha**.

4. **`isForCompensation` perdido hoje = correção declarada, não errata separada.** Diferente da errata
   do H17 (matriz), aqui o atributo simplesmente ainda não é modelado — entra **dentro** da CO-1
   (ler+emitir), com teste de corpus externo cobrindo a preservação. Sem micro-PR à parte.

5. **`COMP_CATCH_ATTRS` = warning + preservação (cerca §1).** Import externo com
   `activityRef`/`waitForCompletion` no **catch** (boundary/esub-start) não é OMG; a referência ignora.
   Recomendo: **warning no lint + preservar os attrs no soup via passthrough** (nunca re-emitir no
   child), como o §2 pede. Confirmar o canal (foreignAttributes vs bpmnr:property).

6. **Idioma dos rótulos / forma é o contrato.** Como H16–H18: a FORMA é o contrato (kind compensate +
   associação + `isForCompensation` + `activityRef` opcional); rótulos seguem a camada (lint EN, paleta
   i18n). Registrar.

---

## §D — Critérios de aceite da CO-1 (core headless, 6a)

Escopo: modelo + import/export + vetos estruturais + fixture. Zero UI (CO-2), zero lint (CO-3), zero
simulação (CO-4).

1. **Kind aditivo `compensate`** em `EVENT_DEFINITION_KINDS`; round-trip
   `<bpmn:compensateEventDefinition/>` no boundary (catch) e no intermediate/end throw. Ausência do
   kind ⇒ hash e `toXml` byte-idênticos aos de hoje.
2. **`isForCompensation`**: lido de `isForCompensation="true"` → `properties.isForCompensation`
   (molde `triggeredByEvent`); emitido como atributo nativo; default `false` **omitido** (RTL
   negativo). Corpus externo com o handler preserva o atributo.
3. **Throw**: `compensateActivityRef` (atributo do child do throw) + `waitForCompletion` (default
   TRUE **omitido**); catch **nunca** emite esses dois (teste RTL). `activityRef` ausente = broadcast.
4. **Boundary de compensação**: `cancelActivity` **nunca** emitido (teste RTL negativo); attach por
   `attachedToRef` reusa o modelo existente.
5. **Veto estrutural core**: um handler (`isForCompensation`) não recebe nem emite **sequence flow**
   (veto nos dois sentidos, canal ES-3); o boundary ⟲ conecta ao handler **só por associação**.
   Positivos E negativos (task comum conecta normal).
6. **Fixture `compensationFrozen`** capturada pré-CO-1; as 4 anteriores
   (`eventDefsFrozen`/`passthroughFrozen`/`eventSubprocFrozen`/`escalationFrozen`) intactas.
7. **Corpus** ≥1 arquivo real (Camunda book-hotel ou equivalente) com o trio completo importando sem
   warning de descarte; `corpus-warnings.json` regenerado com diff.
8. **CONFORMANCE** promove `bpmn:compensateEventDefinition` via gerador (gate de frescor intacto);
   apiSurface core (novos exports); format-spec seção "Compensação".

**Fora da CO-1 (explícito):** glifo/paleta/chips/picker (CO-2), regras de lint (CO-3),
`compensate()`/limitations (CO-4), ledger/demo (CO-5).

---

## §E — Ordem vinculante das PRs

CO-0 (docs) → CO-1 core → CO-2 react → CO-3 lint 1.4.0 → CO-4 simulação → CO-5 ledger+demo+balanço.
Uma por vez; cada uma após validação do owner. As PRs de feature terão o pipeline completo (build,
lint, typecheck, test:coverage com pisos, guards no-runtime-deps/no-hardcoded-strings/docs-fresh, e2e
Playwright) → Actions verde antes e depois do merge → relatório por painel com evidência nomeada.

## §F — Verificação da CO-0
Docs-only — sem código a exercitar. Checagem: (1) guard de docs verde (o doc não referencia arquivos
inexistentes); (2) cada linha de evidência conferida contra o arquivo:linha citado (reconhecimento
feito acima); (3) commit `Claude <noreply@anthropic.com>`, push `-u origin
claude/handoff-18-escalation-vnudxz`, PR docs-only aberto direto (regime H18). Sem código de feature
até a validação do owner.
