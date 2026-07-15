# Handoff 14 §0 — Reconciliação spec × PR #103 (U-1, sem código)

> Estado: **aguardando validação** antes de qualquer refino (U-2..U-6).
> Legenda: ✅ conforme (com evidência) · ⚠ divergente (com proposta) · ⬜ faltante
> (entra no plano §5). Evidências apontam teste/arquivo:linha no estado do PR #103
> (commit `50337b8`).

## Resumo executivo

| Painel | ✅ | ⚠ | ⬜ | Leitura |
|---|---|---|---|---|
| 1a Context pad | 3 | 3 | 3 | Núcleo entregue; slot de plugin, Tab e touch faltam |
| 1b Smart guides | 4 | 3 | 2 | Snap entregue; badges de distância e spy-test faltam |
| 1c Busca | 4 | 1 | 3 | Motor entregue; lista visual, props/refs e pulso faltam |
| 1d Painel de lint | 1 | 0 | 5 | Headless pronto; TODA a superfície é U-5 |
| 1e Auto-layout | 3 | 3 | 1 | Motor certo; UX de proposta é o refino central (U-6) |
| 1f Ponte de execução | 2 | 0 | 4 | Só as regras EXEC existem; aba/deploy gated são U-6 |
| 1g Matriz pública | 1 | 0 | 2 | Gerada ✅; colunas de terceiros e publicação faltam |

---

## 1a — Context pad

| Item da checklist | Status | Evidência / proposta |
|---|---|---|
| 5 itens + ⋯ (5º = contextual do plugin) | ⚠/⬜ | Tenho 5 itens, mas a composição diverge: task, gateway, end, **conectar, excluir** (`react/src/canvas/ContextPad.tsx:41-70,141-168`). A spec pede o 5º slot **plugável** (🤖 agentTask via contrato N-5) e ⋯ para overflow — slot de plugin é ⬜ (U-2). Proposta: manter excluir DENTRO do ⋯ e dar o 5º slot ao plugin, como a spec. |
| criar = UM comando (nó+aresta+pos) | ✅ | `compositeCommand` com nó+aresta; teste "append is one atomic undo" (`react/tests/contextPad.test.tsx:49-58`). |
| Tab cria conectado | ⬜ | Não entrou no PR #103. Prioritário em U-2 (diferencial sobre bpmn-js). |
| Esc fecha (pilha) | ✅ | O pad é função da seleção; Esc limpa a seleção pela pilha de dismissal existente e o pad some (coberto indiretamente por `contextPad.test.tsx` "delete action... hides the pad"). Nota: o pad não registra entrada própria na pilha — avaliar na validação se isso atende "Esc fecha (pilha)" ou se querem entrada dedicada. |
| touch: tap seleciona → pad 44px | ⬜ | Botões de 26px em unidades de mundo, sem media query `pointer: coarse` (cerca §1.2 exige ≥44px). U-2. |
| colisão: empurra p/ baixo, nunca sobrepõe | ⚠ | O **elemento criado** empurra para baixo em colisão ✅ (teste "avoids the occupied slot", `contextPad.test.tsx:63-80`). O **pad em si** não trata colisão: pode sobrepor elementos vizinhos (evidenciado no e2e `reparent.spec.ts` — precisei limpar seleção) e não flipa na borda do viewport. U-2. |
| Geometria: offset 8px fora do bounding | ⚠ | Implementei `PAD_OFFSET = 14` px da borda direita (`ContextPad.tsx:31`). Spec: 8px fora do bounding da seleção (que já inclui o halo de +6). Efetivo ≈ compatível, mas não idêntico — proposta: **adotar a spec** (8px a partir do halo) em U-2, é só constante. |
| Nó criado: +140px, mesma linha | ⚠ | Implementei `QUICK_ADD_GAP = 72` px a partir da **borda direita** (efetivo ≈ x+largura+72). No mock, o ghost fica a ~82px da borda (140 do centro). Mesma linha ✅ (centrado verticalmente). Proposta: **adotar a spec** (constante única) em U-2. |
| Precedência de hit-test com teste dedicado (cerca §1.4) | ⬜ | A ordem prática hoje: resize/portas/pad coexistem por z-order do DOM e `stopPropagation`, sem teste que fixe `resize > pad > portas > boundary-snap > reparent`. Teste obrigatório novo em U-2. |

## 1b — Smart guides

| Item | Status | Evidência / proposta |
|---|---|---|
| guia a centro E borda (h+v) com snap | ✅ | left/center/right × top/center/bottom (`react/src/canvas/smartGuides.ts:60-100`); teste de magnetização (`react/tests/arrange.test.tsx:71-84`). |
| snap **±4px** | ⚠ | Implementei `GUIDE_THRESHOLD = 6` (`smartGuides.ts:14`) — escolha minha sem base de pesquisa, não veio de teste com usuário. Proposta: **adotar ±4px da spec** em U-3 (constante + testes). |
| badge de distância igual entre 3+ vizinhos | ⬜ | Não implementado. U-3. |
| só vizinhos no viewport | ⚠ | Filtro por visibilidade de drill/colapso (`isNodeVisible`) mas **não** por viewport — em diagrama grande o candidato pode estar fora da tela e o custo é O(nós ativos). Proposta: **adotar a spec** (interseção com viewport) em U-3. |
| zero recálculo de arestas alheias (spy) | ⚠ | Por construção as guias só ajustam dx/dy (nenhuma chamada de roteador em `smartGuides.ts`), mas **não há teste spy** no padrão H10 provando. Teste em U-3. |
| canário de FPS não regride | ✅ | e2e `perf.spec.ts` verde no estado final do PR (102 passed). |
| guias somem no drop · nunca no export | ✅ | `alignGuides: null` no pointerup (`useInteractions.ts`, ramo do drop); overlay `pointerEvents=none` só existe durante drag — export ocorre fora de gesto. Sem teste dedicado; adiciono junto do spy em U-3. |
| distribuir/alinhar = UM comando composto | ✅ | `buildAlignCommand`/`buildDistributeCommand` = 1 `compositeCommand` (`react/src/canvas/arrange.ts`); teste undo do arrange (`arrange.test.tsx:31-42`) + menu N-5 (`:45-69`). |

## 1c — Busca

| Item | Status | Evidência / proposta |
|---|---|---|
| overlay (não modal) · pilha de Esc | ✅ | `useDismissal('search', …)` (`react/src/ui/SearchPanel.tsx:60`); teste "Escape closes via the dismissal stack" (`react/tests/searchPanel.test.tsx:63-69`). |
| busca nome + tipo + **propriedades/refs** | ⚠/⬜ | Nome/id/tipo ✅ (`searchElements`, teste `:21-29`). Propriedades/refs (`decisionRef`, `agnt-rsch@`, job type) ⬜ — U-4. |
| resultado: ícone + lane + tipo | ⬜ | Minha barra mostra `N/M` + navegação; **não há lista de resultados** com ícone/lane/tipo como no mock. U-4. |
| Enter cicla, pan animado + pulso | ⚠ | Enter cicla com wrap ✅ (teste `:41-60`); o pan é **instantâneo** e não há os 2 pulsos de halo (reduced-motion → 0). Animação/pulso em U-4. |
| seleção via selection.changed normal | ✅ | `goTo` usa `store.setState({selectedIds})` → o efeito N-3 do Canvas emite `selection.changed` (`Canvas.tsx:74-84`). |
| subprocesso: drill-down automático até o nó | ✅ | `goTo` ajusta `drillId` ao escopo do match (`SearchPanel.tsx:78-90`). Evidência de código; teste dedicado entra em U-4 junto das props/refs. |

## 1d — Painel de lint + quick-fix

| Item | Status | Evidência / proposta |
|---|---|---|
| Motor headless (pré-requisito) | ✅ | `@buildtovalue/lint` com perfis etiqueta+executabilidade, códigos estáveis, 9 testes + apiSurface (`packages/lint/`). Regra de engine reusa o mesmo shape `ValidationRule` — pronto para "REUSA este painel". |
| dock inferior, redimensionável, Esc fecha | ⬜ | U-5. |
| clique → seleciona + pan ao nó | ⬜ | U-5 (reaproveita o `goTo` da busca). |
| fix = comando undoável · todos = 1 composto | ⬜ | Contrato `fix(ctx) → command` **não existe** no pacote ainda — extensão do tipo de regra em U-5 (aditiva, sem quebrar `ValidationRule`). |
| sem fix mecânico → ✦ C5 do copiloto | ⬜ | U-5 (pipeline C5 já existe no copilot). |
| perfil de lint como artefato da Biblioteca | ⬜ | U-5 via `ArtifactAdapter` (padrão `copilotPromptAdapter`). |

## 1e — Auto-layout

| Item | Status | Evidência / proposta |
|---|---|---|
| motor layered zero-dep, determinístico | ✅ | `computeLayeredLayout` (`core/src/geometry/layout.ts`); teste "is deterministic" + sem sobreposição + ciclos + boundary segue host (`core/tests/layout.test.ts`). |
| card de proposta aplicar/recusar (padrão A-5) | ⚠ | **Divergência central**: meu botão "Arrumar" aplica DIRETO (`Toolbar.tsx`, handler `arrange`) — viola a cerca §1.7. Proposta: **adotar a spec** em U-6 (preview + card com contagens). O comando único undoável já existe e vira o "Aplicar". |
| preview antes/depois + crossfade 160ms | ⬜ | U-6 (o `SettlingOverlay`/crossfade do H10 já dá o mecanismo de 160ms com reduced-motion). |
| 📍 manuais NUNCA re-roteadas sem confirmação | ⚠ | O layout move só nós; rotas manuais não são re-roteadas ✅, mas também **não são transladadas** com os nós (o drag usa `translateManualEdges`; meu arrange não) — waypoints manuais ficam para trás visualmente. Proposta: em U-6, transladar rigidamente as 📍 dos nós movidos (mesmo contrato H10 §8.3) e declarar a contagem no card. |
| import sem DI: aplica direto + aviso declarado | ⚠ | Import usa **grade simples** com aviso declarado ✅ (`diHandler.ts:125` "applied automatic grid layout"). Spec sugere o layered no import — proposta: **adotar** em U-6, mantendo o aviso (interage com snapshots do corpus; medir antes). |
| aplicar = UM comando undoável | ✅ | `buildLayoutCommand` = 1 composto; teste "one undoable command" (`arrange.test.tsx:31-42`). |

## 1f — Ponte de execução

| Item | Status | Evidência / proposta |
|---|---|---|
| Regras de executabilidade (motor) | ✅ | `EXEC_MISSING_IMPLEMENTATION` (aceita grafias `zeebe:`/`camunda:`) e `EXEC_UNCONDITIONED_FLOWS` (`packages/lint/src/index.ts:190-260`, testes `lint.test.ts:88-118`). Reusam o painel 1d por construção (mesmo shape). |
| Adiamentos confirmados pela spec §3 | ✅ | Passthrough `zeebe:*`, deploy direto, compensação/coreografia, multi-pool — registrados em `pendencias.md` §2.1 e confirmados "ok" pelo handoff. |
| aba "Execução" com progressive disclosure | ⬜ | U-6 (só com plugin de engine ativo). |
| deploy gated (VIGENTE + assinada; CANDIDATA → card) | ⬜ | U-6 — os dados de estado/assinatura já existem (lifecycle + identity). |
| lint de executabilidade REUSA painel 1d | ⬜ | Depende do painel (U-5); o motor já é compartilhado. |
| atributos `zeebe:*` round-trip lossless | ⬜ | Adiado com aval da spec (§2 1f: "mantém adiado, PR dedicada"). |

## 1g — Matriz de conformidade pública

| Item | Status | Evidência / proposta |
|---|---|---|
| gerada pelo script (anti-drift) | ✅ | `scripts/gen-conformance.mjs` + teste de frescor (`conformance/tests/matrix.test.ts` "CONFORMANCE.md is fresh"); atualizada no PR para `complexGateway` supported. |
| células de terceiros com "declarado pela doc deles" + link | ⬜ | O CONFORMANCE.md atual não tem colunas comparativas. Extensão do gerador (dados de terceiros como fixture com URL de fonte, nunca claim próprio). Sem PR alocada no §5 — sugiro anexar à U-6 ou criar U-7; **decisão de vocês**. |
| publicada no site | ⬜ | Não há site de docs (é o item "playground + docs site" da análise de mercado — fora deste handoff). Registrar como pendência de produto. |

---

## Divergências ⚠ com proposta "manter" (nenhuma) e "adotar spec" (todas)

Todas as divergências acima propõem **adotar a spec**, exceto duas notas para
validação de vocês:

1. **1a "Esc fecha (pilha)"** — o pad segue a seleção (Esc→deseleciona→pad some).
   Se quiserem entrada própria na pilha (Esc fecha o pad ANTES de desfazer a
   seleção), digam — muda a semântica do primeiro Esc.
2. **1b threshold 6px** — não tenho racional de pesquisa para defender 6px;
   proponho adotar ±4px. Se o alvo touch preocupar, a spec permite registrar
   racional — mas prefiro a spec.

## Mapa para as PRs §5 (após validação)

- **U-2**: 1a — slot de plugin + ⋯, Tab, geometria 8px/+140, colisão/flip do pad,
  touch 44px, teste de precedência de hit-test (cerca §1.4).
- **U-3**: 1b — ±4px, badges de distância igual, filtro por viewport, spy-test de
  arestas + teste drop/export.
- **U-4**: 1c — busca em propriedades/refs, lista de resultados (ícone+lane+tipo),
  pan animado + 2 pulsos (reduced-motion 0), teste de drill.
- **U-5**: 1d — dock + quick-fix (`fix(ctx)→command` no pacote lint) + "corrigir
  todos" composto + ✦ C5 + adapter de política na Biblioteca.
- **U-6**: 1e proposta aplicar/recusar + translado de 📍 + crossfade + layered no
  import; 1f aba Execução + deploy gated. (1g colunas comparativas: U-6 ou U-7 — a decidir.)
