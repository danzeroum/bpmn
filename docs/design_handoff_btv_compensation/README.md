# Handoff 19 — Compensação (Desfazer Governado)

**Pacote:** `docs/design_handoff_btv_compensation/`
**Spec navegável:** `design-refs/Spec UX Compensacao BTV.dc.html` (abra no navegador — 5 painéis 6a–6e, cada um com mock do estado-alvo + semântica vinculante + checklist de aceite)
**Origem:** fecha 100% da família de gatilhos OMG (message/signal/error/escalation/**compensation**) — pesquisa OMG validada ANTES da spec (ver §0.1).
**Formato:** RECONCILIAÇÃO-PRIMEIRO (mesmo regime dos Handoffs 14–18).
**Pré-requisito:** Handoffs 16–18 completos na main (estão — E-*, ES-*, EC-*, PRs #119–#140).

---

## §0.1 A pesquisa OMG que MUDA o desenho — leia antes de tudo

**Compensação NÃO segue o caminho pavimentado do H18.** Diferenças estruturais confirmadas na espec OMG e nas implementações de referência (Camunda/Flowable/Activiti):

1. **Não há root nomeado nem 5º bucket.** `compensateEventDefinition` não referencia definição nomeada — o `activityRef` OPCIONAL do throw aponta para uma **ATIVIDADE** do MESMO escopo (que precisa ter boundary de compensação). Sem `activityRef` = broadcast no escopo. O molde E-1/E-3 (bucket/picker de definições/gov-*) **não se aplica**; o picker aqui é de atividades compensáveis do escopo.
2. **O handler liga por ASSOCIAÇÃO, nunca sequence flow.** `<association sourceRef="boundary" targetRef="handler"/>` + `isForCompensation="true"` na atividade handler. A BPMN enfatiza: compensações estão FORA da sequência normal.
3. **Boundary de compensação NÃO tem cancelActivity** — ele dispara APÓS a atividade completar com sucesso; o atributo não se aplica (ferramentas de referência nem o suportam).
4. **`waitForCompletion` default TRUE** (omitido quando default — molde ES-1); no CATCH, `activityRef`/`waitForCompletion` não são suportados pela OMG — implementações de referência ignoram com warning.
5. **Execução de referência: ordem REVERSA à conclusão**, só sobre atividades COMPLETADAS ("same level of sub-process").
6. **Start de compensação SÓ em event subprocess** — nunca inicia instância de processo ("compensation event subprocess"). Padrão de referência: esub de ERRO contendo throws de compensação (falha irrecuperável → reverter).

## §0.2 Fundação que JÁ EXISTE — reconcilie antes de codar

| Peça | Onde | O que reusar |
|---|---|---|
| Kind `compensation` tipado no registry + glifo rewind | H6 | O kind e o glifo EXISTEM — ganham semântica; nunca segundo kind |
| Boundary + drag-to-attach side/t | H6/N-1 | Attach herdado; MAS sem cancelActivity (toggle EC-2 ausente para esse kind) |
| dataAssociation (F7-3) | H7-3 | `bpmn:association` é PARENTE, não igual — reconciliar: tipo de aresta próprio, serialização própria, zero fork da infra de arestas |
| Event subprocess + `EVT_SUBPROC_START` + lista de kinds | H17 ES-1..ES-4 | Start ⟲ em esub vira legal (lista ganha compensation); esub de compensação |
| Veto declarado (`announceVeto`/`lastVeto`) + veto estrutural core | ES-1/ES-3 | Os vetos de associação/fluxo usam os MESMOS canais |
| Composto de paleta lint-clean + builder compartilhado lint⇄paleta | ES-2/ES-4 | Paleta «Compensação (par)» + quick-fix reusam UMA forma |
| Paradas honestas + decisions serializáveis + replay + compat | E-6/ES-5/EC-5 | `compensate()` segue a MESMA disciplina; trilha de transitions = fonte dos COMPLETADOS |
| Builders de ledger (`escalationRaisedEntry`) + ✦ IA + caminho (a) | EC-3/EC-5 | `compensationTriggeredEntry` pelo mesmo molde; demo appenda; motor puro |
| Fixtures congeladas (4: eventDefs/passthrough/eventSubproc/escalation) | #119..EC-1 | `compensationFrozen` nova; as 4 intactas |
| Marcadores de atividade no rodapé (loop/multi-instance) | F7 | Marcador ◀◀ do handler pelo mesmo molde |

Produza a **CO-0 (reconciliação)**: tabela ✅/⚠/⬜ por painel contra a main, com evidência, ANTES de qualquer código de feature. Atenção especial: estado atual de `bpmn:association` no converter (existe? é descartada? vira foreignExtension?) e de `isForCompensation` no import externo.

## §1 Cercas inegociáveis

1. **OMG puro**: `compensateEventDefinition` (+ `activityRef`/`waitForCompletion` SÓ no throw), `bpmn:association`, `isForCompensation` — atributos/elementos padrão; defaults omitidos (waitForCompletion true, isForCompensation false); catch NUNCA re-emite os attrs de throw (import externo com eles = warning + preservação no soup via passthrough).
2. **Associação nunca fluxo**: handler não recebe/emite sequence flow (veto estrutural core + veto de gesto declarado + lint no import — dupla cobertura ES-3/ES-4); boundary ⟲ só conecta por associação ao handler.
3. **Sem cancelActivity no boundary ⟲**: nunca emitido, toggle ausente (o kind dispara pós-conclusão — RTL negativo).
4. **Byte-estabilidade**: fixture `compensationFrozen` capturada do build PRÉ-CO-1; as 4 anteriores intactas.
5. **Simulação honesta**: compensa SÓ completadas (fonte = trilha de transitions), ordem REVERSA nomeada na trilha; completada sem handler = linha DECLARADA; nada completado = card desabilitado com razão; específica não-compensável = parada declarada; replay bit a bit; COMPAT E-6/ES-5/EC-5 obrigatória.
6. **Toda superfície nova**: i18n EN/PT-BR, pilha única de Esc, touch ≥44px, TRANSIENT no export, apiSurface, pisos, glifo+texto nunca só cor.

## §2 Painéis (a spec é a régua)

- **6a Modelo + XML** — trio boundary⟲ + associação + handler `isForCompensation`; throw com/sem `activityRef`; defaults omitidos; veto estrutural; corpus ≥1 arquivo real (padrão book-hotel Camunda); fixture congelada; CONFORMANCE promove compensate + association.
- **6b Visual** — glifo rewind da fonte única (throw cheio/catch vazado); boundary SEMPRE sólido; associação tracejada SEM seta de fluxo; handler com marcador ◀◀ (molde marcadores F7); chip «⟲ compensa: {nome|escopo}» TRANSIENT; paleta «Compensação (par)» = 1 composto (boundary + associação + handler nomeado), nasce lint-clean, drop exige host (veto EC-2); picker do throw lista ATIVIDADES compensáveis do escopo (broadcast default).
- **6c Interações + lint (perfis → 1.4.0)** — vetos declarados nos dois gestos; gesto boundary⟲→task cria ASSOCIAÇÃO + `isForCompensation` em 1 composto; regras: `COMP_HANDLER_FLOW` (erro), `COMP_BOUNDARY_NO_HANDLER` (erro, quick-fix = builder da paleta), `COMP_REF_NOT_COMPENSABLE` (warning), `COMP_CATCH_ATTRS` (warning + preservação); `EVT_SUBPROC_START` ganha compensation; `COMP_START_TOPLEVEL` (irmão dos TOPLEVEL de erro/escalação).
- **6d Simulação** — `compensate(scope|activityRef)`: só completadas, ordem reversa nomeada, não-compensadas declaradas; waitForCompletion true declarado na trilha; esub ⟲ dispara pelo mesmo caminho (tier de escopo ES-5); decisions serializáveis; replay bit a bit; compat; limitations.md no MESMO PR (snapshot de variáveis não simulado; sem propagação a callActivity — referência).
- **6e Ledger + demo** — `compensationTriggeredEntry({actor, scope, compensated[], uncompensated[]})` no adapters-bpmn (molde EC-3); demo appenda no compensate (caminho (a) — motor puro); ✦ IA; demo «pacote de viagem» (`?compensation=1`): hotel ⟲ + passagem ⟲ + cartão SEM handler (risco visível) + esub de erro com throw ⟲; marco "família OMG 100%" no CONFORMANCE/README.

## §3 Fora de escopo (registrado, não implementar)

- Snapshot de variáveis do handler (semântica de dados da OMG) — declarado em limitations; não simulado.
- Propagação de compensação a callActivity — as implementações de referência também não propagam; declarado.
- Transação/cancel event (o par transacional da compensação) — pendência própria nomeada; NÃO entra.
- Coreografia/multi-pool/correlação runtime — pendências intocadas.

## §4 Ordem vinculante das PRs

| PR | Escopo | Pacotes |
|---|---|---|
| **CO-0** | Reconciliação §0 (docs-only, PR aberto direto — regime H18) | — |
| **CO-1** | `feat(core): associação + isForCompensation + activityRef/waitForCompletion + vetos estruturais + fixture` (6a) | core |
| **CO-2** | `feat(react): glifo/boundary sólido + associação tracejada + marcador handler + paleta par + picker de atividades + chips` (6b) | react |
| **CO-3** | `feat(lint): COMP_* + EVT_SUBPROC_START ganha compensation + perfis 1.4.0` (6c) | lint (+core helper se preciso) |
| **CO-4** | `feat(simulation): compensate reverso pós-conclusão + esub ⟲ + limitations` (6d) | simulation, react (card) |
| **CO-5** | `feat(adapters+example): compensationTriggeredEntry + demo pacote de viagem + marco 100% + BALANÇO FINAL` (6e) | adapters-bpmn, example, conformance |

Uma PR por vez; pipeline local completo; Actions verde antes E depois do merge; relatório contra a checklist do painel com evidência nomeada; validação do owner antes da próxima.

## §5 Aceite global

- Reconciliação CO-0 aprovada antes de código (com o estado real de `bpmn:association` e `isForCompensation` na main).
- Checklists 6a–6e 100% ✓ com evidência nomeada (teste/e2e).
- Fixture `compensationFrozen` congelada; as 4 anteriores intactas.
- Corpus: ≥1 arquivo real com o trio completo importando sem warning; `COMP_CATCH_ATTRS` exercitado por fixture externa.
- e2e do fluxo completo: paleta cria o par → picker do throw lista compensáveis → simular: falha → esub de erro → compensar → trilha reversa nomeada + não-compensada declarada → entrada no ledger.
- Marco registrado: família de gatilhos OMG 100% (CONFORMANCE.md + README).
- Balanço final do handoff junto do relatório da CO-5 (checklists 6a–6e + cercas §1 uma a uma + fora-de-escopo §3 + pendências que ficam).
- apiSurface/pisos/FPS/i18n/a11y sem regressão.
