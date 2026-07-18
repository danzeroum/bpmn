# Handoff 16 — Definições de Evento e Refs Governadas

**Pacote:** `docs/design_handoff_btv_event_defs/`
**Spec navegável:** `design-refs/Spec UX Definicoes de Evento BTV.dc.html` (abra no navegador — 5 painéis 3a–3e, cada um com mock do estado-alvo + semântica vinculante + checklist de aceite)
**Origem:** varredura profunda da documentação de eventos do Axelor BPM Studio 4.0 (docs.axelor.com/studio/4.0/bpm-docs/BPMN), validada contra a main.
**Formato:** RECONCILIAÇÃO-PRIMEIRO (mesmo regime dos Handoffs 14/15).

---

## §0 Fundação que JÁ EXISTE — reconcilie antes de codar

| Peça | Onde | O que reusar |
|---|---|---|
| Event definitions tipados (8 tipos) + boundary + event-based gateway | H6, core registry + converter | O tipo do evento NÃO muda; este handoff adiciona a definição NOMEADA que ele referencia |
| Padrão de ref governada `nome@semver` + warning de vigência | callActivity (`resolveCallActivities`), `decisionRef`, agentflow `agnt-*@semver` | O picker/chip/selo do 3b é o MESMO padrão, novo alvo |
| Contrato de resolução injetado | AIProvider / AnchorAdapter / EngineBridge / ReviewStore | O resolvedor de refs da Biblioteca é mais um contrato injetado — o pacote nunca consulta registry |
| Aba Execução gated + progressive disclosure | U-6 (`BpmnPlugin.engine`) | 3c estende a MESMA aba para eventos; mesmo gate, mesmo disclosure |
| Painel de lint + quick-fix `fix(ctx)→command` + "corrigir todos" | U-5 (`@buildtovalue/lint`) | 3d são regras novas no perfil existente — ZERO UI nova |
| Paradas honestas + `BlockedDecision` + limitations.md | H7/H9 (disciplina S-FEEL) | 3e reusa o vocabulário de parada, novo domínio (matching de erro) |
| Passthrough `zeebe:*`/`camunda:*` | **PR em curso — PRÉ-REQUISITO** | 3c depende dele para lossless; 3a interage com byte-estabilidade da mesma forma |
| Adapter de artefato da Biblioteca | `lintProfileAdapter` / `copilotPromptAdapter` | 3b publica definições de evento como artefato versionado pelo mesmo molde |

Produza a **E-0 (reconciliação)**: tabela ✅/⚠/⬜ por painel contra a main, com evidência, ANTES de qualquer código de feature.

## §1 Cercas inegociáveis

1. **Padrão OMG no XML**: definições exportam como root elements (`bpmn:message`/`bpmn:signal`/`bpmn:error` com `errorCode`), eventos referenciam via `messageRef`/`signalRef`/`errorRef`. Nunca inventar namespace para o que a OMG já nomeia.
2. **Refs governadas serializam como extensão `bpmnr:`** — nunca `camunda:modelRefCode`. Resolução SEMPRE injetada pelo host; degradação declarada sem resolvedor.
3. **Byte-estabilidade**: round-trip byte-idêntico entre os NOSSOS exports; neutralidade de hash — diagrama sem definições nomeadas produz `computeDiagramHash` e `toXml` byte-idênticos aos de antes (fixture congelada, mesmo critério da PR do passthrough).
4. **Assimetria throw/catch imposta pela UI** (3c): payload só em throw; captura em variável só em catch.
5. **Nunca rota adivinhada** (3e): catch-all declarado na trilha; ambiguidade = `BlockedDecision` nomeando candidatos.
6. **Toda superfície nova**: i18n EN/PT-BR, pilha única de Esc, touch ≥44px, TRANSIENT no export, apiSurface, pisos de cobertura, glifo+texto nunca só cor.

## §2 Painéis (a spec é a régua)

- **3a Definições nomeadas de primeira classe** — modelo `diagram.definitions.{messages,signals,errors}[]`, comandos undoáveis (criar com id auto, rename em cascata = 1 undo, excluir bloqueado listando usos), picker + «+» no properties panel, import externo com `*Ref` resolve para o modelo (deixa de ser warning), matriz CONFORMANCE promovida.
- **3b Refs governadas cross-model** — picker em duas seções (deste diagrama / da Biblioteca), seleção governada grava `nome@semver`, chip + selo de vigência no canvas, `SIG_REF_MISSING` com badge e código, troca de ref = comando undoável + entrada no ledger, adapter de definições na Biblioteca.
- **3c I/O de eventos na aba Execução** — gated pelo `EngineBridge`; payload (throw) e variáveis de captura (catch de erro); props no namespace do engine; lossless via passthrough.
- **3d Lint EVT_* + TIMER_*** — `EVT_START_THROW`, `EVT_ERROR_START_TOPLEVEL`, `EVT_END_CATCH`, `EVT_REF_MISSING`, `TIMER_MALFORMED`; parser ISO 8601 headless no core (date/duration/cycle, pegadinha P1M/PT1M, fuzzing); editor de timer com preview humano i18n; quick-fix só onde mecânico.
- **3e Matching honesto no simulador** — exato / catch-all declarado / ambíguo → `BlockedDecision`; limitations.md no mesmo PR.

## §3 Fora de escopo (registrado, não implementar)

- Execution listeners com script embutido (Groovy do Axelor) — viola a fronteira host-owned; round-tripam como extensão estrangeira pelo passthrough.
- Correlação de mensagens em runtime (correlation keys de engine) — host-owned; só as props na aba Execução.
- Event subprocess como contêiner novo — o `EVT_ERROR_START_TOPLEVEL` valida contra o que existe; o contêiner é pendência própria.
- Compensação/coreografia/multi-pool — pendências já registradas, intocadas.

## §4 Ordem vinculante das PRs

| PR | Escopo | Pacotes |
|---|---|---|
| **E-0** | Reconciliação §0 (docs-only) | — |
| **E-1** | `feat(core): definições nomeadas + comandos + converter root elements/refs` (3a headless) | core |
| **E-2** | `feat(react): picker/+ no properties panel + rename cascata + exclusão bloqueada` (3a UI) | react |
| **E-3** | `feat: refs governadas nome@semver + chip/selo + adapter Biblioteca + ledger` (3b) | core, react, adapters-bpmn, studio |
| **E-4** | `feat(react): I/O de eventos na aba Execução` (3c) | react |
| **E-5** | `feat(lint+core): regras EVT_*/TIMER_* + parser ISO 8601 + editor de timer` (3d) | core, lint, react |
| **E-6** | `feat(simulation): matching honesto + limitations` (3e) | simulation |

Uma PR por vez; pipeline local completo; Actions verde antes E depois do merge; relatório contra a checklist do painel; validação do owner antes da próxima. **E-1 só começa depois do merge da PR do passthrough.**

## §5 Aceite global

- Reconciliação E-0 aprovada antes de código.
- Checklists 3a–3e 100% ✓ com evidência nomeada (teste/e2e).
- Fixture de neutralidade de hash congelada (cerca §1.3).
- Corpus: ≥1 arquivo real com `messageRef` importando sem warning de descarte; snapshot de warnings regenerado com diff explicado.
- e2e do fluxo: criar definição pelo «+» → usar em 2 eventos → renomear (cascata) → publicar na Biblioteca → referenciar de outro diagrama com selo de vigência → simular com matching declarado.
- apiSurface/pisos/FPS/i18n/a11y sem regressão.
