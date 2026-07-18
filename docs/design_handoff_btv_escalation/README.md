# Handoff 18 — Escalation Governada

**Pacote:** `docs/design_handoff_btv_escalation/`
**Spec navegável:** `design-refs/Spec UX Escalation Governada BTV.dc.html` (abra no navegador — 5 painéis 5a–5e, cada um com mock do estado-alvo + semântica vinculante + checklist de aceite)
**Origem:** completa a família de gatilhos (§3 do Handoff 17) e materializa a personalidade BTV: escalação = "subir para quem tem autoridade", versionada, auditável e a ponte formal agente→humano.
**Formato:** RECONCILIAÇÃO-PRIMEIRO (mesmo regime dos Handoffs 14–17).
**Pré-requisito:** Handoffs 16 e 17 completos na main (estão).

---

## §0 Fundação que JÁ EXISTE — reconcilie antes de codar

| Peça | Onde | O que reusar |
|---|---|---|
| Kind `escalation` tipado no registry + glifo | H6 (event definitions tipados) | O kind e o glifo EXISTEM; o que falta é a definição nomeada, refs e semântica |
| Buckets de definições nomeadas + comandos (id auto, rename cascata, veto com lista) | H16 E-1 | `escalations[]` é o 4º bucket — MESMOS comandos parametrizados, zero fork |
| Picker/«+» + errorCode como campo por tipo | H16 E-2 | `escalationCode` segue o molde exato do errorCode |
| Refs governadas `nome@semver` + espelho `gov-*` read-only + adapter catálogo + ledger de troca | H16 E-3 | O kind entra nas MESMAS superfícies; `esc-nome@semver` |
| Matriz `eventExecutionModeOf` + aba Execução | H16 E-4 / H17 ES-3 | Throw de escalação (intermediate/end) entra na matriz de payload |
| `EVT_REF_MISSING` com quick-fix por kind + perfis versionados | H16 E-5 (reforço 9) | O fix GANHA o kind escalation → bucket novo |
| Matching em 4 tiers (especificidade > escopo > catch-all) + `BlockedDecision` + catch-all declarado + compat | H17 ES-5 | `throwEscalation` reusa a MESMA resolução; a diferença é o não-interrupting |
| Event subprocess + lista de kinds aceitos + `EVT_SUBPROC_START` | H17 ES-1..ES-4 | A lista (reforço 8 da ES-4) GANHA escalation; start de escalação em esub vira legal |
| Boundary não-interrupting (`cancelActivity`) + tracejado | H6/ES-2 | O catch de escalação é o caso de uso CANÔNICO do não-interrupting |
| Boundary drag-to-attach side/t | N-1 | Anexar a agentTask herda o gesto |
| agentTask + escala de autonomia + AgentStudio + templates | H12 (A-3/A-4/A-5) | A ponte 5c: escalação como o mecanismo formal do autonomia→gate |
| Builders de ledger (`reviewCommentEntry`, `eventBindingChangedEntry`) + selo ✦ de IA | H15 V-4 / H16 E-3 / H9 | `escalationRaisedEntry` pelo mesmo molde; host appenda |
| Fixtures congeladas (`eventDefsFrozen`, `passthroughFrozen`, `eventSubprocFrozen`) | #119/E-1/ES-1 | Mesmo critério: `escalationFrozen` nova; as 3 anteriores intactas |

Produza a **EC-0 (reconciliação)**: tabela ✅/⚠/⬜ por painel contra a main, com evidência, ANTES de qualquer código de feature.

## §1 Cercas inegociáveis

1. **OMG puro no XML**: `bpmn:escalation` root com `escalationCode`, eventos referenciam via `escalationRef` — ordem dos roots pelo XSD, junto de message/signal/error. Nunca namespace próprio para o que a OMG nomeia. Autoridade (`escalationAuthority`) NÃO é da OMG → serializa como `bpmnr:property` comum.
2. **Reuso das fontes únicas — zero fork**: buckets/comandos E-1, picker E-2, refs governadas/espelho E-3, matriz E-4, quick-fix por kind E-5, ordem total de matching ES-5, lista de kinds ES-4. Escalation ENTRA nessas fontes; nunca reimplementa ao lado.
3. **Não-interrupting como default DECLARADO da paleta** (personalidade BTV: "pedir ajuda sem parar o trabalho") — `cancelActivity` false explícito no boundary criado pela paleta; os demais kinds seguem interrupting. Documentado no format-spec e no código.
4. **Byte-estabilidade e neutralidade**: fixture `escalationFrozen` do build pré-EC-1; `eventDefsFrozen`/`passthroughFrozen`/`eventSubprocFrozen` intactas.
5. **Simulação honesta com o contraste testado**: escalação sem destino elegível = **no-op DECLARADO** na trilha ("escalation dissolves" — legal na OMG); erro sem destino segue **parada declarada**. A diferença é teste vinculante e entra no limitations.md. Duplicata no tier = `BlockedDecision`; catch-all declarado (reforço 10 mantido).
6. **Toda superfície nova**: i18n EN/PT-BR, pilha única de Esc, touch ≥44px, TRANSIENT no export, apiSurface, pisos, glifo+texto nunca só cor.

## §2 Painéis (a spec é a régua)

- **5a Modelo + XML OMG** — 4º bucket `escalations[]`; comandos E-1 parametrizados; root + `escalationRef` nos 4 hosts (throw: intermediate/end; catch: boundary/esub-start); órfã sintetiza com warning 1×; picker E-2 e espelho gov-* E-3 por construção; corpus ≥1 arquivo real; fixture congelada; CONFORMANCE promovida.
- **5b Visual + autoridade** — glifo chevron ↟ da fonte única; família `--btv-gold`; paleta cria boundary NÃO-interrupting (default declarado); chip `esc-nome@semver` + selo (E-3); chip de autoridade (`properties.escalationAuthority` → bpmnr:, degradação sem chip); esub aceita start de escalação (lista ES-4 atualizada); snapshot do boundary comum intacto.
- **5c Ponte agente→humano + ledger** — boundary de escalação em agentTask = mecanismo formal do autonomia→gate (A-3); template novo no AgentStudio; `escalationRaisedEntry` no adapters-bpmn (host appenda; catálogo N-3 fica em 16); selo ✦ para escalação de IA; zero dependência nova entre pacotes (agentflow segue independente).
- **5d Lint (perfis → 1.3.0)** — `EVT_REF_MISSING` ganha o kind (fix cria `bpmn:escalation`); `EVT_ESCALATION_START_TOPLEVEL` (molde do de erro, consome `isEventSubprocess`); `ESC_NO_CATCH` (WARNING: throw sem catch elegível — destino = boundaries + esub-starts, mesmo predicado da ES-5); lista de kinds do `EVT_SUBPROC_START` ganha escalation (migração dos testes ES-4 que o rejeitavam); `EVT_START_THROW`/`EVT_END_CATCH` revisadas.
- **5e Simulação** — `throwEscalation(host, ref?)` com a ordem total da ES-5; **não-interrupting: host segue + token paralelo** (o teste que separa escalação de erro); interrupting: caminho ES-5 reusado (cancela nomeando contagem+escopo); sem destino = dissolve declarado; gov-* idêntico; replay bit a bit; compat E-6/ES-5 obrigatória; limitations.md no MESMO PR.

## §3 Fora de escopo (registrado, não implementar)

- Compensação (o último gatilho OMG da família) — pendência própria; a lista de kinds NÃO a ganha neste handoff.
- Propagação de escalação entre escopos (bubble-up) — como erro: declarada, não simulada.
- Autoridade como entidade governada (Persona/Gate como artefato da Biblioteca com resolução) — neste handoff `escalationAuthority` é texto declarativo + chip; a versão governada é candidata a handoff futuro se o uso confirmar.
- Coreografia/multi-pool/correlação runtime — pendências intocadas.

## §4 Ordem vinculante das PRs

| PR | Escopo | Pacotes |
|---|---|---|
| **EC-0** | Reconciliação §0 (docs-only) | — |
| **EC-1** | `feat(core): bucket escalations + escalationRef nos 4 hosts + converter + fixture congelada` (5a) | core |
| **EC-2** | `feat(react): glifo/tracejado + paleta não-interrupting default + chips semver/autoridade + picker/esub` (5b) | react |
| **EC-3** | `feat(adapters+example): escalationRaisedEntry + template AgentStudio da ponte agente→humano` (5c) | adapters-bpmn, example/studio |
| **EC-4** | `feat(lint): kind nas regras vivas + EVT_ESCALATION_START_TOPLEVEL + ESC_NO_CATCH + perfis 1.3.0` (5d) | lint |
| **EC-5** | `feat(simulation): throwEscalation não-interrupting + dissolve declarado + limitations` (5e) | simulation, react (card) |

Uma PR por vez; pipeline local completo; Actions verde antes E depois do merge; relatório contra a checklist do painel com evidência nomeada; validação do owner antes da próxima.

## §5 Aceite global

- Reconciliação EC-0 aprovada antes de código.
- Checklists 5a–5e 100% ✓ com evidência nomeada (teste/e2e).
- Fixture `escalationFrozen` congelada; as 3 anteriores intactas.
- Corpus: ≥1 arquivo real com escalação importando com significado pleno; CONFORMANCE promove `bpmn:escalation`.
- O contraste dissolve⇄parada (escalação vs erro sem destino) como teste vinculante.
- e2e do fluxo completo: criar definição pelo «+» → boundary não-interrupting na task (default da paleta) → chip semver + autoridade → esub com start de escalação → simular: escalar → host SEGUE + token paralelo no catch → trilha nomeia → variante sem destino (dissolve declarado).
- Balanço final do handoff junto do relatório da EC-5 (checklists 5a–5e + cercas §1 uma a uma + fora-de-escopo §3 + pendências que ficam).
- apiSurface/pisos/FPS/i18n/a11y sem regressão.
