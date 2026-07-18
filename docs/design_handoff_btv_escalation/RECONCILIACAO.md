# EC-0 — Reconciliação Handoff 18 × main

> Estado: **VALIDADA pelo owner** (2026-07-18) — as 6 decisões de fronteira + o reforço 8
> registrados abaixo são vinculantes para a EC-1..EC-5.
> Base: main `2d00847` (Handoffs 16 e 17 completos na main — E-0..E-6 / #120–#127 e
> ES-0..ES-5 / #128–#133). Tabela ✅ (existe e reusa por inteiro) / ⚠ (existe, precisa de
> aperto/extensão) / ⬜ (novo), com evidência nomeada.

## Decisões validadas (vinculantes)

1. **4º kind na FONTE ÚNICA** — escalation entra em `EVENT_DEFINITION_REF_KINDS` +
   `EVENT_DEFINITION_BUCKETS` + `ID_PREFIX` (prefixo `esc`), zero fork (cerca §1.2). O ripple
   derivado nomeado (`NAMED_REF_KINDS`/`SUBPROC_TRIGGER_KINDS` do lint) fica para a **EC-4**.
2. **`escalationCode` opcional, molde `errorCode`** — `EscalationEventDefinition extends
   NamedEventDefinition { escalationCode? }`. Atributo XML **AUSENTE quando não definido**
   (nunca `escalationCode=""`), como `errorCode`.
3. **Item de paleta dedicado** — boundary de escalação como composto (molde ES-2) nascendo
   `cancelActivity:false`; o toggle interrupting existente flipa; default não-interrupting
   DECLARADO e documentado no format-spec (cerca §1.3). **EC-2.**
4. **Byte-estabilidade (registro aceito)** — o bucket `escalations` vazio emite NADA; as 3
   fixtures anteriores (`eventDefsFrozen`/`passthroughFrozen`/`eventSubprocFrozen`) seguem
   intactas; `escalationFrozen` nova capturada do build **pré-EC-1** (cerca §1.4).
5. **Errata do H17 em MICRO-PR dedicada, ANTES da EC-1** — a linha `eventSubProcess` da matriz
   de conformidade (`packages/conformance/src/matrix.ts:71`) ainda lê `⛔ unsupported`
   ("Deliberately out of scope before v2.x."), o que a main não pode afirmar depois do H17
   (event subprocess entregue e verde). Corrigir via o gerador, citando a evidência dos testes
   do H17; **fora do escopo do H18**. A EC-1 promove **só o root `bpmn:escalation`**.
6. **Forma é o contrato, rótulos por camada** — o quick-fix/insert contrata a FORMA (evento
   kind escalation + definição nomeada referenciada, 1 composto); rótulos seguem a camada
   (lint EN, paleta i18n), como no H16/H17.

**Reforço 8 (EC-1)** — round-trip do `escalationRef` DERIVADO no start tipado do event
subprocess segue o caminho da ES-1 (o import re-deriva `side`/`t` e agora TAMBÉM o ref do start
tipado): um teste vinculante combinando esub + start de escalação com definição nomeada.

---

## 5a — Modelo + XML OMG (core)

| Item | Estado | Evidência |
|---|---|---|
| Kind `escalation` tipado + glifo | ✅ reusa | `EVENT_DEFINITION_KINDS` já inclui `escalation` (`core/src/model/types.ts:228`); glifo chevron ↟ já existe (`react/src/shapes/shapes.tsx:43`, throw = filled) |
| 4º bucket `escalations[]` + `EscalationEventDefinition{escalationCode?}` | ⬜ (sobre ✅) | `EVENT_DEFINITION_REF_KINDS = ['message','signal','error']` (`core/src/model/eventDefinitions.ts:15`); `EVENT_DEFINITION_BUCKETS`/`ID_PREFIX` (`:19-30`); `EventDefinitions` só tem messages/signals/errors (`types.ts:173-178`); `escalationCode` = molde exato de `ErrorEventDefinition.errorCode?` (`types.ts:169-171`) — decisões 1 e 2 |
| Comandos undoáveis (id auto, rename cascata 1 undo, veto com lista) | ✅ reusa parametrizado | `addEventDefinitionCommand`/`updateEventDefinitionCommand`/`removeEventDefinitionCommand` (`core/src/commands/commands.ts:538-652`); veto por regra listando usos (`core/src/engine/rules.ts:102-115`); `eventDefinitionUsages` (`eventDefinitions.ts:82-95`); ganham o kind ao estender as 3 constantes |
| Root OMG + `escalationRef` nos 4 hosts + ordem XSD | ⬜ | Converter emite roots message/signal/error antes de collaboration/process, ordem do array (`core/src/persistence/BpmnXmlConverter.ts:139-155`); `refAttrName` messageRef/signalRef/errorRef por kind (`elementSerializer.ts:121-128`) → +`escalation`/`escalationRef`; import `readDefinitions` (`BpmnXmlConverter.ts:253-265`). Hosts: throw intermediate/end, catch boundary + esub-start |
| Órfã sintetiza com warning 1× | ✅ molde | síntese de ref órfã (`id=X, name=X`) com warning nomeando o evento (`BpmnXmlConverter.ts:302-319`) — o kind entra no mesmo caminho |
| Autoridade `escalationAuthority` como `bpmnr:property` (não-OMG) | ✅ por construção | prop não-reservada → `<bpmnr:property>` (`core/src/persistence/extensionHandler.ts:46-52`); texto livre roteado automaticamente (cerca §1.1) |
| Picker E-2 + espelho gov-* E-3 listam o bucket | ✅ molde | `EVENT_DEFINITION_REF_KINDS` alimenta picker/mirror/adapter (`react/src/ui/EventDefinitionSection.tsx`, `react/src/canvas/eventBinding.ts`, `adapters-bpmn/src/eventDefinitionCatalogAdapter.ts`) — por construção ao virar ref-kind |
| Fixture congelada `escalationFrozen` | ✅ molde | `eventDefsFrozen`/`passthroughFrozen`/`eventSubprocFrozen` + testes `frozenDiagram()` (`core/tests/eventDefinitions.test.ts:37-119`, `passthrough.test.ts`, `eventSubprocess.test.ts`) — decisão 4 |
| CONFORMANCE promove `bpmn:escalation` root | ⬜ | matriz tem message/signal/error roots (`conformance/src/matrix.ts:56-58`), **falta `bpmn:escalation (root)`** — só `bpmn:escalationEventDefinition` (child) já é supported (`:67`); gerador `gen-conformance` + gate de frescor prontos |

## 5b — Visual + autoridade declarada (react)

| Item | Estado | Evidência |
|---|---|---|
| Glifo chevron ↟ da fonte única | ✅ | `eventGlyph` case `escalation` (`react/src/shapes/shapes.tsx:43`); consumido por start/end/intermediate/boundary (`:79,114,141,170`) e glifo colapsado do esub (`:407-427`) |
| Tracejado SÓ não-interrupting (helper, nunca local) | ✅ molde | `strokeDasharray` por `cancelActivity`; `isNonInterrupting` (`core/src/model/types.ts:286-288`) |
| Paleta cria boundary de escalação NÃO-interrupting por default | ⬜ (decisão declarada) | item `boundaryNonInterrupting` `cancelActivity:false` existe (`react/src/ui/paletteItems.ts:34`); insert composto molde ES-2 (`react/src/ui/paletteInsert.ts:98-126`) — decisão 3 |
| Chip `esc-nome@semver` + selo | ✅ molde | optgroup semver + selo de vigência (`react/src/ui/EventDefinitionSection.tsx:175-205`) |
| Chip de autoridade `↟` (degradação sem chip) | ⬜ (sobre ✅) | superfície de selo/badge existe; chip lendo `properties.escalationAuthority` é novo |
| Esub aceita start de escalação | ⬜ | `SUBPROC_TRIGGER_KINDS` exclui escalation (`lint/src/index.ts:209`) → migra na EC-4; shape colapsado já mostra o glifo (`shapes.tsx:407-427`) |
| i18n EN/PT-BR + guard | ✅ molde | fragmento `react/src/i18n/fragments/eventDefs.ts`; guard `react/tests/i18n.test.tsx:77-82`; `i18n-exempt` p/ literais só-glifo |
| Snapshot do boundary comum intacto | ✅ | fixtures visuais existentes preservadas |

## 5c — Ponte agente→humano + ledger (adapters-bpmn / AgentStudio)

| Item | Estado | Evidência |
|---|---|---|
| Boundary de escalação em agentTask = autonomia→gate formal (A-3) | ⚠ gesto herdado, semântica nova | drag-to-attach N-1 herdado; a leitura "boundary de escalação = gate formal do autonomia→gate" é nova (EC-3) |
| `escalationRaisedEntry({actor,code,target})` builder | ✅ molde | `eventBindingChangedEntry`/`reviewCommentEntry` (`adapters-bpmn/src/eventBindingLedger.ts:13-40`) — host appenda via `command.executed`; motor intacto |
| Selo ✦ para escalação de IA | ✅ molde | `aiAuthorOf`/selo ✦ existentes |
| Template AgentStudio da ponte | ⬜ | novo template (agente → escalação → revisão assinada) |
| Zero dependência nova entre pacotes | ✅ cerca | agentflow independente; guard `no-runtime-deps` |

## 5d — Lint (perfis → 1.3.0)

| Item | Estado | Evidência |
|---|---|---|
| `EVT_REF_MISSING` ganha o kind (fix cria `bpmn:escalation`) | ⚠ estender | `evtRefMissingRule` gated por `NAMED_REF_KINDS = message\|signal\|error` (`lint/src/index.ts:204`); `fixEvtRefMissing` + `REF_FIX_NAMES` (`:626-642`) |
| `EVT_ESCALATION_START_TOPLEVEL` (molde do de erro) | ⬜ | `evtErrorStartToplevelRule` consome `isEventSubprocess` (`lint/src/index.ts:352-365`) — molde exato |
| `ESC_NO_CATCH` (WARNING) | ⬜ | destino = boundaries + esub-starts (mesmo predicado da ES-5); "sem destino" é aviso, não erro (escalação não capturada é legal na OMG) |
| Lista de kinds do `EVT_SUBPROC_START` ganha escalation | ⚠ estender + migrar testes | `SUBPROC_TRIGGER_KINDS` (`lint/src/index.ts:209`) exclui escalation; testes ES-4 que o rejeitavam viram positivos |
| `EVT_START_THROW`/`EVT_END_CATCH` revisadas | ⚠ | `START_FORBIDDEN_KINDS`/`END_FORBIDDEN_KINDS` (`:199-201`) — escalation legal em end-throw e esub-start |
| Perfis 1.2.0 → 1.3.0 pela mesma fonte | ⚠ bump | `ETIQUETTE_PROFILE.version`/`EXECUTABILITY_PROFILE.version = '1.2.0'` (`:669,689`); histórico no comentário `:663-665` |

## 5e — Simulação honesta (throwEscalation)

| Item | Estado | Evidência |
|---|---|---|
| Ordem total 4 tiers + BlockedDecision + catch-all | ✅ base ES-5 | `throwError` tiers especificidade>escopo>catch-all (`simulation/src/engine.ts:403-476`); `BlockedDecision` duplicata-no-tier (`:462-476`, `types.ts:201-205`) |
| Cancel interrupting nomeando contagem+escopo | ✅ reusa | `catchByEventSubprocess` + `scopeLabel` (`engine.ts:492-521`) |
| `throwEscalation(host, ref?)` | ⬜ | novo; molde broadcast do `throwSignal` (host segue, `engine.ts:581`) + tiers do `throwError`; `Decision` union (`types.ts:140-154`), dispatch `choose()` (`engine.ts:322-328`) |
| Não-interrupting: host segue + token paralelo (o teste que separa escalação de erro) | ⬜ | molde broadcast do signal (host não para) |
| Sem destino = **dissolve DECLARADO** (no-op), ≠ parada do erro | ⬜ (contraste vinculante) | erro sem destino = parada declarada (`engine.ts:450-461`); precedente de no-op declarado = zero-recipients do signal/message (`engine.ts:588-596`) |
| Espelho gov-* idêntico; replay bit a bit; compat E-6/ES-5 | ✅ molde | disciplina existente do engine (`eventMatching.test.ts`) |
| `limitations.md` revisado (mesmo PR) | ⚠ reescrever | `docs/limitations.md:118-119` diz "Escalation … carry no matching semantics here" → passa a declarar o dissolve; compensação/coreografia ficam |

---

## Conflitos / decisões para o owner — **RESOLVIDOS** (ver "Decisões validadas")

Os 6 pontos de fronteira levantados na reconciliação foram validados pelo owner (decisões 1–6
acima) mais o reforço 8. Sem ⚠ de decisão pendente restante. Registro dos pontos:

1. Escalation como 4º `EVENT_DEFINITION_REF_KIND` → **decisão 1** (aprovada, vinculante).
2. `escalationCode` opcional molde `errorCode`, ausente quando indefinido → **decisão 2**.
3. Expressão do default não-interrupting na paleta → **decisão 3** (item dedicado composto).
4. Byte-estabilidade das 3 fixtures + `escalationFrozen` pré-EC-1 → **decisão 4** (registro).
5. `eventSubProcess ⛔ unsupported` na matriz → **decisão 5** (errata H17 em micro-PR ANTES da EC-1).
6. Idioma dos rótulos do quick-fix/insert → **decisão 6** (forma é contrato, rótulos por camada).

## Plano da EC-1 (core headless, 5a) — critérios de aceite validados

**Escopo**: modelo + comandos + converter + fixture + CONFORMANCE (só o root de escalação).
Zero UI (EC-2), zero ponte (EC-3), zero lint (EC-4), zero simulação (EC-5).

1. **Modelo aditivo**: `EscalationEventDefinition { id, name, escalationCode? }`;
   `EventDefinitions` ganha `escalations`; `EVENT_DEFINITION_REF_KINDS`/`EVENT_DEFINITION_BUCKETS`/
   `ID_PREFIX` (prefixo `esc`) estendidos; `emptyEventDefinitions()` inclui `escalations: []`.
   Ausente/vazio ⇒ `computeDiagramHash` e `toXml` byte-idênticos (decisão 4).
2. **Comandos parametrizados** ganham o kind: add (id auto `esc-1` colisão-safe), update
   (name/`escalationCode`), remove **vetado** listando usos; rename com 2 eventos = 1 undo (teste).
3. **Converter export (padrão OMG)**: root `<bpmn:escalation id name escalationCode?/>` na ordem
   do XSD (junto de message/signal/error, antes de collaboration/process); `escalationCode`
   **omitido quando indefinido** (decisão 2); evento emite `escalationRef` nos 4 hosts
   (throw intermediate/end, catch boundary/esub-start). Round-trip byte-estável (teste).
4. **Converter import**: root → `definitions.escalations`; `escalationRef` → `eventDefinitionRef`;
   órfã sintetiza com warning; corpus ≥1 arquivo REAL com escalação importa com significado
   pleno e sem warning de descarte (asserção `corpusExternal`); `corpus-warnings.json` regenerado
   com diff explicado no PR.
5. **CONFORMANCE**: `bpmn:escalation (root)` promovido na `matrix.ts` via gerador (gate de
   frescor intacto) — **só o root** (o child `escalationEventDefinition` já é supported; a linha
   `eventSubProcess` é a micro-PR da decisão 5, separada).
6. **Fixture `escalationFrozen`** capturada do build PRÉ-EC-1; `eventDefsFrozen`/
   `passthroughFrozen`/`eventSubprocFrozen` byte-idênticas (negativo vinculante).
7. **Transversais**: apiSurface core (novos exports: tipo, comandos parametrizados ganham o kind
   — sem export novo se já genéricos); format-spec ganha a seção "Escalation"; pisos de
   cobertura; regime completo (pipeline local → PR → Actions verdes antes do merge → relatório
   contra a checklist 5a-core).
8. **Reforço 8**: teste de round-trip combinando **esub + start tipado de escalação** com
   definição nomeada — o import re-deriva o `escalationRef` do start (caminho da ES-1 que
   re-deriva `side`/`t`), byte-estável.

**Fora da EC-1** (explícito): glifo/paleta/chips/autoridade (EC-2), ponte agente + ledger (EC-3),
regras de lint + perfis 1.3.0 (EC-4), `throwEscalation`/dissolve/limitations (EC-5). A errata do
`eventSubProcess` na matriz é micro-PR própria, ANTES da EC-1 (decisão 5).
