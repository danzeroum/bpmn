# Handoff 17 — Event Subprocess como Contêiner

**Pacote:** `docs/design_handoff_btv_event_subprocess/`
**Spec navegável:** `design-refs/Spec UX Event Subprocess BTV.dc.html` (abra no navegador — 5 painéis 4a–4e, cada um com mock do estado-alvo + semântica vinculante + checklist de aceite)
**Origem:** fecha a aproximação honesta registrada na E-4 (`eventExecutionModeOf` aceitando qualquer subProcess) e na E-5 (`EVT_ERROR_START_TOPLEVEL`), e remove "event subprocess como contêiner" do limitations.md da E-6.
**Formato:** RECONCILIAÇÃO-PRIMEIRO (mesmo regime dos Handoffs 14–16).
**Pré-requisito:** Handoff 16 completo na main (está — E-0..E-6, #120–#127).

---

## §0 Fundação que JÁ EXISTE — reconcilie antes de codar

| Peça | Onde | O que reusar |
|---|---|---|
| subProcess como contêiner (parentId, childrenOf, DI absoluto, expand/collapse, drill-down, breadcrumb, z-order) | F7 (#25–#26) | O event subprocess é um subProcess comum + `triggeredByEvent` — contenção reusada POR INTEIRO, zero modelo novo |
| Reparent-on-drop (authoring de contenção pela UI) | #99–#101 | Popular o contêiner é o mesmo gesto; nada novo |
| Definições nomeadas + picker/«+» + refs governadas + espelho `gov-*` | H16 E-1/E-2/E-3 | O start tipado do contêiner referencia definição nomeada POR CONSTRUÇÃO — mesmo picker, mesmo veto, mesmo chip |
| Matriz `eventExecutionModeOf` (aproximação a apertar) | H16 E-4 | Catch-error passa a exigir `triggeredByEvent` no pai; teste de concordância lint⇄matriz |
| `EVT_ERROR_START_TOPLEVEL` + perfis de lint 1.1.0 + quick-fix por kind | H16 E-5 | Aperto da regra + 2 regras novas nos MESMOS perfis (→1.2.0); molde do quick-fix (reforço 9) |
| Matching honesto (`throwError/throwSignal/throwMessage`, precedência, catch-all declarado, `BlockedDecision`) | H16 E-6 | Candidatos passam a incluir starts de event subprocess; MESMO vocabulário de parada |
| Boundary interrupting/não-interrupting (`cancelActivity`) + círculo tracejado | H6 (#10) | Molde visual E semântico do `isInterrupting=false` no start |
| Veto pela regra padrão + canal `lastVeto` (🔒 na toolbar) | E-1/E-2 (exclusão de definição) | O veto de conexão na casca usa o MESMO canal |
| Isenção do unreachable (boundary events, group) | H6 | O contêiner sem fluxos de entrada é isento pelo mesmo mecanismo |
| Fixtures congeladas de neutralidade (`eventDefsFrozen`, `passthroughFrozen`) | #119/E-1 | Mesmo critério: fixture nova `eventSubprocFrozen` |

Produza a **ES-0 (reconciliação)**: tabela ✅/⚠/⬜ por painel contra a main, com evidência, ANTES de qualquer código de feature.

## §1 Cercas inegociáveis

1. **OMG puro no XML**: `triggeredByEvent="true"` no subProcess e `isInterrupting="false"` no startEvent são atributos que a OMG nomeia — serializam como atributos XML padrão (props reservadas do soup quando emitidas, molde `eventDefinitionRef`); default OMG omitido (`isInterrupting="true"` não é escrito). Nunca namespace próprio para o que a OMG nomeia.
2. **Contenção F7 reusada** — zero modelo novo de containment; DI absoluto intacto; expand/collapse/drill herdados sem fork.
3. **Sem fluxo de sequência na casca**: veto no editor SEMPRE declarado (mensagem + 🔒, nunca gesto mudo) + lint no caminho de import; filhos conectam entre si normalmente.
4. **Byte-estabilidade e neutralidade de hash**: fixture congelada `eventSubprocFrozen` — diagrama sem `triggeredByEvent` produz `toXml` e `computeDiagramHash` byte-idênticos aos de antes (mesmo critério da #119/E-1).
5. **Simulação honesta**: interrupção NOMEIA contagem de tokens cancelados + escopo na trilha; precedência OMG documentada (mesmo escopo vence boundary externo — não é ambiguidade); empate no mesmo nível = `BlockedDecision` nomeando candidatos; timer/conditional start nunca auto-dispara (card manual declarado); propagação além do escopo direto segue não-simulada.
6. **Toda superfície nova**: i18n EN/PT-BR, pilha única de Esc, touch ≥44px, TRANSIENT no export, apiSurface, pisos de cobertura, glifo+texto nunca só cor.

## §2 Painéis (a spec é a régua)

- **4a Modelo + XML OMG** — `properties.triggeredByEvent` / `properties.isInterrupting` → atributos padrão; veto de conexão pela regra padrão do core; isenção do unreachable; import externo com `triggeredByEvent` vira contêiner de primeira classe (hoje: subProcess comum silencioso); corpus ≥1 arquivo real; CONFORMANCE promovida.
- **4b Visual normativo** — contêiner com borda fina PONTILHADA (OMG; sólida = subProcess comum), rx 12 + faixa de título 30px com tag `event subProcess` (molde F7); start interrupting sólido / não-interrupting TRACEJADO (molde boundary H6); colapsado mostra o glifo do gatilho no canto sup. esq.; paleta «Subprocesso de evento» = contêiner + start de message default em UM composto.
- **4c Interações** — portas suprimidas na casca + veto declarado nos dois sentidos; toggle "Interrompe o escopo" (updateNodeCommand, só em start de contêiner); reparent para dentro herdado; aperto da matriz E-4 com teste de concordância.
- **4d Lint** — `EVT_SUBPROC_FLOW` (erro, pega o import), `EVT_SUBPROC_START` (erro: exatamente 1 start tipado; quick-fix mecânico só para 0 starts = start message default, 1 composto), `EVT_ERROR_START_TOPLEVEL` APERTADO (subProcess comum passa a acusar); perfis → 1.2.0 pela mesma fonte (dock + adapter).
- **4e Simulação** — candidatos incluem starts de event subprocess do escopo; precedência documentada; interrupting cancela e nomeia / não-interrupting paraleliza; espelho `gov-*` idêntico (molde reforço 9); replay bit a bit; compat com cenários E-6 (teste obrigatório); limitations.md atualizado no MESMO PR.

## §3 Fora de escopo (registrado, não implementar)

- Escalation e compensation como gatilhos (as definições OMG desses roots são pendência própria — o start tipado aceita os kinds existentes: message/signal/error/timer/conditional).
- Propagação de erro entre escopos (bubble-up) — o simulador declara; não implementa.
- Event subprocess DENTRO de event subprocess — válido na OMG, mas fica fora do e2e obrigatório; se sair de graça pela contenção F7, registrar teste; se não, pendência.
- Correlação runtime, multi-pool, coreografia — pendências intocadas.

## §4 Ordem vinculante das PRs

| PR | Escopo | Pacotes |
|---|---|---|
| **ES-0** | Reconciliação §0 (docs-only) | — |
| **ES-1** | `feat(core): triggeredByEvent + isInterrupting + converter + veto de conexão + isenção unreachable + fixture congelada` (4a) | core |
| **ES-2** | `feat(react): shapes do contêiner (pontilhado, faixa, colapsado com glifo) + start tracejado + item de paleta composto` (4b) | react |
| **ES-3** | `feat(react): veto declarado na casca + toggle isInterrupting + aperto da matriz E-4` (4c) | react |
| **ES-4** | `feat(lint): EVT_SUBPROC_* + aperto do TOPLEVEL + perfis 1.2.0` (4d) | lint (+core se precisar de helper) |
| **ES-5** | `feat(simulation): disparo com precedência + interrupção nomeada + limitations` (4e) | simulation, react (card) |

Uma PR por vez; pipeline local completo; Actions verde antes E depois do merge; relatório contra a checklist do painel com evidência nomeada; validação do owner antes da próxima.

## §5 Aceite global

- Reconciliação ES-0 aprovada antes de código.
- Checklists 4a–4e 100% ✓ com evidência nomeada (teste/e2e).
- Fixture `eventSubprocFrozen` congelada (cerca §1.4); fixtures anteriores intactas.
- Corpus: ≥1 arquivo real com `triggeredByEvent` importando como contêiner; snapshot de warnings com diff explicado se mudar.
- Teste de concordância lint⇄matriz E-4 (mesmo predicado, dois lados).
- e2e do fluxo completo: paleta → contêiner com start dentro → reparent de task → conectar filhos → tentar conectar a casca (veto visível) → toggle não-interrupting (círculo tracejado) → simular: lançar erro → event subprocess vence boundary externo → trilha nomeia interrupção.
- Balanço final do handoff junto do relatório da ES-5 (checklists 4a–4e + cercas §1 uma a uma + fora-de-escopo §3 + pendências que ficam).
- apiSurface/pisos/FPS/i18n/a11y sem regressão.
