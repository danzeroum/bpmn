# Handoff 14 §0 — Reconciliação spec × implementação — BALANÇO FINAL

> Estado: **FECHADO** — U-1 (reconciliação) validada; refinos U-2..U-6 entregues e
> reportados painel a painel. Este documento foi congelado como retrato da U-1 até a
> U-5; com a U-6 (última PR de código) ele vira o balanço final exigido pelo aceite
> global §4. Legenda: ✅ conforme (com evidência) · 📌 registrado (adiamento/pendência
> com aval da spec, não é código faltante). Não restam ⚠ nem ⬜.

## Placar final spec × implementação

| Painel | U-1 (✅/⚠/⬜) | Final | Fechado por |
|---|---|---|---|
| 1a Context pad | 3/3/3 | **9 ✅** | U-2 (validada 100%) |
| 1b Smart guides | 4/3/2 | **8 ✅** | U-3 (validada 100%) |
| 1c Busca | 4/1/3 | **6 ✅** | U-4 (validada 100%) |
| 1d Painel de lint | 1/0/5 | **6 ✅** | U-5 (validada 100%) |
| 1e Auto-layout | 3/3/1 | **6 ✅** | U-6 |
| 1f Ponte de execução | 2/0/4 | **5 ✅ + 1 📌** | U-6 (📌 = passthrough `zeebe:*`, adiado com aval da spec §2) |
| 1g Matriz pública | 1/0/2 | **2 ✅ + 1 📌** | U-6 (📌 = publicação em site de docs — não existe site; pendência de produto) |
| **Total** | 18✅ · 10⚠ · 20⬜ | **42 ✅ + 2 📌** | as 10 ⚠ adotaram a spec; dos 20 ⬜, 18 viraram código e 2 são adiamentos registrados |

## Registro U-1 → U-6 (evidência por PR, tudo no PR #103)

- **U-1 — reconciliação (sem código).** Este documento na forma original. Decisões
  da validação: Esc no pad NÃO entra na pilha (affordance passiva da seleção);
  todas as ⚠ adotaram a spec (±4px, geometria 8px/+140); o achado do 1e (📍 ficando
  para trás no layout) confirmado como bug real → correção via `translateManualEdges`.
- **U-2 — context pad (1a), validada 100%.** Composição da spec + 5º slot plugável
  (`contextPadItems`, contrato N-5) + ⋯ → menu; `Tab` cria conectado
  (`quickAddPosition`/`buildQuickAddCommand`, +140 do centro); flip na borda do
  viewport; ≥44px em `pointer: coarse`; teste OBRIGATÓRIO de precedência de hit-test
  (resize > pad > portas > boundary-snap > reparent) por resultado observável
  (`hitTestPrecedence.test.tsx`). Nota registrada: 44px em unidades de mundo
  (contra-escala se o uso real acusar).
- **U-3 — smart guides (1b), validada 100%.** `GUIDE_THRESHOLD = 4`; badges de
  distância igual entre 3+ vizinhos (between + chain, "só no eixo sem snap"); filtro
  por interseção com viewport; spy-test de zero recálculo de arestas alheias (padrão
  H10, janela pré-drop); guias nunca no export — o teste "export mid-gesture" pegou o
  context pad vazando e o padrão ficou ADOTADO para toda superfície transiente;
  canário FPS verde (`smartGuides.test`, `perf.spec.ts`).
- **U-4 — busca (1c), validada 100%.** `searchElements` cobre propriedades/refs
  (`zeebe:taskDefinitionType`, `decisionRef`, `agnt-rsch@…`) com
  `matchedIn`/`propertyKey`; lista com glifo+lane+tipo (cap 8 + overflow, decisão
  registrada); pan ANIMADO 240ms cancelável + 2 pulsos de halo
  (`prefers-reduced-motion` → instantâneo, 0 pulsos); `[data-search-pulse]` nos
  `TRANSIENT_SELECTORS` (`searchPanel.test.tsx`, 13 testes).
- **U-5 — painel de lint (1d), validada 100%.** Dock inferior redimensionável
  (`LintPanel`), Esc via pilha; clique → seleciona + pan (o `panViewportTo` da busca
  extraído para `canvas/viewport.ts` — UM mecanismo); contrato `fix(ctx) → command`
  no `@buildtovalue/lint` (duplicate-flow, superfluous-gateway com reconexão,
  event-endpoints); "Corrigir todos (N)" = UM composto; "✦ sugerir correção" → C5
  gated por `AIProvider`; `lintProfileAdapter` na Biblioteca (mesmo registro
  `LINT_PROFILES` do header — anti-drift por construção); perfil engine na MESMA
  superfície; `TRANSIENT_ATTRIBUTES` no exporter (evolução ADOTADA do padrão
  export mid-gesture) (`lintPanel.test.tsx` 11 testes, `fixes.test.ts` 6,
  `lintProfileAdapter.test.ts` 5).
- **U-6 — layout por proposta (1e) + ponte de execução (1f) + matriz (1g).**
  Ver tabelas abaixo. (`layoutProposal.test.tsx` 8, `executionTab.test.tsx` 7,
  `arrange.test.tsx` atualizado, e2e `layoutProposal.spec.ts` 2 +
  `engine.spec.ts` 4; suíte completa 1569 unit + 109 e2e verde.)

---

## 1e — Auto-layout (fechado na U-6)

| Item | Status | Evidência |
|---|---|---|
| motor layered zero-dep, determinístico | ✅ | `computeLayeredLayout` (core); teste de determinismo endurecido para **10×** ("same graph → same layout, 10×", `core/tests/layout.test.ts`). |
| card de proposta aplicar/recusar (padrão A-5) | ✅ | "Arrumar" agora só PROPÕE (`buildLayoutProposal` → `layoutProposal` no store): card "✦ Arrumar diagrama?" com contagens no formato do mock ("N nós movidos · M arestas re-roteadas · K rotas manuais 📍 preservadas"), Aplicar/Recusar; Esc recusa pela pilha; proposta obsoleta (diagrama mudou) se descarta sozinha. Recusar = NADA muda, sem entrada de undo. |
| preview antes/depois + crossfade 160ms | ✅ | `LayoutPreviewOverlay` (ghosts tracejados nas posições-alvo, "DEPOIS") enquanto o card está aberto; ao aplicar, `LayoutSettleOverlay` esmaece os rects das posições ANTIGAS em `SETTLE_MS` = 160ms (mesma disciplina do settle de arestas do H10); `prefers-reduced-motion` → zero ghosts. Ambos em `TRANSIENT_SELECTORS` — nunca exportam. |
| 📍 manuais NUNCA re-roteadas sem confirmação | ✅ | A correção da U-1: `manualTranslationsForLayout` agrupa os nós movidos por delta e passa cada grupo pelo MESMO `translateManualEdges` do drag (R-3, translação rígida — nenhum mecanismo novo); endpoints seguem o delta do seu nó, bends do usuário ficam; teste prova bend interior intocado e undo único restaurando posições E rota. |
| import sem DI: aplica direto + aviso declarado | ✅ | `diHandler` agora usa o **layered** no import sem DI (aviso declarado "applied automatic layered layout"; grade só como fallback com pools/lanes); artefatos fora do escopo de fluxo estacionam em grade abaixo do layout. Impacto medido ANTES: corpus de conformance 61/61 verde (os arquivos do corpus têm DI). |
| aplicar = UM comando undoável | ✅ | O composto inclui moves + translações de 📍 — um Ctrl+Z reverte tudo (unit + e2e). |

## 1f — Ponte de execução (fechado na U-6)

| Item | Status | Evidência |
|---|---|---|
| Regras de executabilidade (motor) | ✅ | `EXEC_*` no `@buildtovalue/lint` (desde a base), grafias `zeebe:`/`camunda:`. |
| aba "Execução" só com plugin de engine | ✅ | Novo contrato `BpmnPlugin.engine` (`EngineBridge` — primeiro vence, como `lifecycleConfig`); sem plugin o painel é byte-idêntico ao anterior (teste "WITHOUT an engine plugin there is no tab bar"). Só atividades executáveis ganham a aba. |
| progressive disclosure (avançado dobrável) | ✅ | ESSENCIAL visível (Job type + Retries, chaves configuráveis com default `<engine>:taskDefinitionType`/`:retries`); "Avançado (headers, I/O mapping, timeout)" em `<details>` DOBRADO com as demais propriedades do namespace do engine; edições = `updateNodeCommand` undoável. |
| deploy gated: VIGENTE + assinada | ✅ | Gate = `status === 'active'` **E** `engine.isSigned(diagram)` (verdade do host); qualquer outro estado → card "⚑ Deploy bloqueado — Só versão VIGENTE e assinada deploya. Esta é {status}." + "Ir para promoção →" (`onRequestPromotion`). Unit (candidate/active-unsigned/active+signed) + e2e por estado (`engine.spec.ts`). Deploy de rede continua host-owned (§3). |
| lint de executabilidade REUSA painel 1d | ✅ | Fechado na U-5 (`EXECUTABILITY_PROFILE` na mesma superfície, tag `engine`). |
| atributos `zeebe:*` round-trip lossless | 📌 | Adiado com aval EXPLÍCITO da spec (§2 1f: "mantém adiado, PR dedicada") — registrado em `pendencias.md` §2.1 (interage com byte-estabilidade e corpus). |

## 1g — Matriz de conformidade pública (fechado na U-6)

| Item | Status | Evidência |
|---|---|---|
| gerada pelo script (anti-drift) | ✅ | `renderConformanceMarkdown` + freshness test; regenerada nesta PR. |
| células de terceiros "declarado pela doc deles" + link | ✅ | Novo `THIRD_PARTY_DECLARATIONS` (`conformance/src/thirdParty.ts`) → seção "Comparativo — declarações de terceiros" no CONFORMANCE.md: colunas bpmn-js (bpmn.io) e Camunda 8 (Zeebe) com link da fonte no cabeçalho, células só com o que a doc DELES declara, "—" = sem declaração registrada (nunca claim de ausência), regra de honestidade impressa no próprio documento. |
| publicada no site | 📌 | Não existe site de docs (item "playground + docs site" da análise de mercado, fora deste handoff) — pendência de produto registrada. O CONFORMANCE.md público no repositório carrega o comparativo. |

---

## Painéis 1a–1d

Fechados e validados nas U-2..U-5 — o detalhe item a item com evidência está no
registro "U-1 → U-6" acima e nos relatórios de validação de cada PR. Nenhuma
divergência remanescente.

## Decisões registradas ao longo do handoff (índice)

Ver `DECISIONS.md` (seção "Decisões recentes") e `pendencias.md` §2.1/§2.2:
Esc no pad passivo; U-7→anexada à U-6 (1g); `translateManualEdges` para 📍 no
layout; cap 8 + overflow na busca; padrão "export mid-gesture" + evolução
`TRANSIENT_ATTRIBUTES`; painel de lint dono de `issueBadges` enquanto aberto;
`panViewportTo` público; perfis de lint versionados como identidade de artefato;
adiamentos confirmados pela spec §3 (deploy direto, compensação/coreografia,
multi-pool, A* incremental/default).
