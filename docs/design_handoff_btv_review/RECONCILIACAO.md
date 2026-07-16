# Handoff 15 §0 — Reconciliação spec × main (V-0, sem código)

> Estado: **aguardando validação** antes da V-1. Legenda: ✅ existe na main (com
> evidência) · ⚠ existe parcialmente / diverge (com proposta) · ⬜ não existe
> (entra na PR indicada). Base: `main@9173aaa` (+ upload do handoff `387d06a`).

## Resumo executivo

| Painel | ✅ | ⚠ | ⬜ | Leitura |
|---|---|---|---|---|
| 2a Diff no canvas | 2 | 2 | 4 | `computeDiff` é a fonte certa; faltam as categorias moved/rerouted (V-1) e TODO o render (V-2) |
| 2b Navegação | 4 | 0 | 3 | Mecanismos de navegação 100% prontos (pan/pulsos/Esc/drill); falta a barra e a ordem estável (V-1/V-3) |
| 2c Comentários | 4 | 0 | 3 | Molde de contrato e ledger prontos; ReviewStore/pins/órfãs são V-4 |
| 2d Painel Studio | 3 | 1 | 3 | ReviewScreen é base rica; gate por regra é o MESMO mecanismo do soundness |
| 2e Aprovar/Pedir | 3 | 2 | 3 | Assinatura I-2 pronta; EM REVISÃO é aditivo mas com 2 conflitos a decidir |
| 2f Palette/vazio | 2 | 1 | 3 | Teclas livres; "sem lista própria" exige extrair built-ins p/ registro |

**5 conflitos/decisões** para sua validação — seção própria no fim.

---

## 2a — Diff pintado no canvas

| Item | Status | Evidência / lacuna |
|---|---|---|
| Diff semântico por elemento (fonte) | ✅ | `computeDiff(before, after)` (`core/src/diff/index.ts:94`): add/remove/update por id com `FieldChange {from,to}` por campo, `supersede` de aresta como operação própria; igualdade via `canonicalJson`/`roundCoord`. É a fonte que 2a REUSA. |
| Categorias `added\|removed\|moved\|changed\|rerouted` | ⬜ V-1 | Hoje x/y e `waypoints` são só campos dentro de `update` — não existem `moved` nem `rerouted` como categoria. `diffDiagrams` (V-1) classifica SOBRE o `computeDiff`, sem reescrevê-lo. |
| Determinismo/ordem estável | ⚠ | O diff itera `Object.entries` (ordem de inserção dos mapas) — estável para o MESMO par de objetos, mas sem a "ordem de leitura do grafo" que 2b exige. V-1 define a ordenação determinística (rank topológico a partir dos starts + desempate por id) com teste 10× + shuffle. |
| Render no viewer READ-ONLY | ⬜ V-2 | `ViewerCanvas`/`BpmnViewer` (N-7) existem e são read-only por construção (sem gestures/commands) — a base certa; overlay de diff não existe. |
| Esmaecido 45% / fantasma / seta / halo / badge ΔN / popover | ⬜ V-2 | Nada disso existe. `FieldChange from→to` já carrega o conteúdo do popover. |
| Legenda + export limpo | ⬜ V-2 | Mecanismo pronto e ADOTADO: `TRANSIENT_SELECTORS` + `TRANSIENT_ATTRIBUTES` (U-3/U-5) com o padrão de teste "export mid-gesture". |
| Tokens de cor do diff | ⚠ **conflito 1** | `--btv-error` ✅ e `--btv-gold` ✅ existem; **`--btv-success` e `--btv-blue` NÃO existem** no styles.css (0 ocorrências). Existem `--btv-green` (verde de aprovação/seleção, 11 usos) e `--btv-ink` (azul #33567e). Proposta abaixo. |

## 2b — Navegação mudança-a-mudança

| Item | Status | Evidência |
|---|---|---|
| Pan animado compartilhado | ✅ | `panViewportTo` em `canvas/viewport.ts`, público, já reusado por busca (U-4) e lint (U-5) — terceiro consumidor entra sem duplicação. |
| 2 pulsos + reduced-motion → 0 | ✅ | `SearchPulseOverlay` + `reducedMotion()` — mesmo padrão/teste da U-4. |
| Pilha de Esc | ✅ | `useDismissal` — barra do diff entra como toda superfície nova. |
| F7/Shift+F7 livres | ✅ | Nenhum binding atual em `useKeyboardShortcuts.ts`. |
| Barra "N de M" + chips + wrap | ⬜ V-3 | Não existe. |
| Lista sincronizada (clique navega) | ⬜ V-3 | Padrão pronto (lista da busca U-4); a lista em si não existe. |
| Removidos navegáveis (pan ao fantasma) | ⬜ V-3 | Depende do fantasma da V-2 — o pan a uma posição da v-base é trivial com `panViewportTo`. |
| Drill-down automático em subprocesso | ✅ | Padrão da busca (`goTo` ajusta `drillId` ao escopo) — reuso direto. |
| Ordem estável de leitura do grafo | ⬜ V-1 | Ver 2a — a ordenação nasce no core junto do `diffDiagrams`. |

## 2c — Comentários ancorados

| Item | Status | Evidência |
|---|---|---|
| Molde de contrato injetado | ✅ | `AIProvider` (copilot), `AnchorAdapter` (identity/react), `EngineBridge` (U-6) — `ReviewStore` nasce no mesmo padrão: host injeta, ausente → superfície some. |
| `ReviewStore` + threads + pins | ⬜ V-4 | Não existe nada de review no react/core. |
| Âncora por elementId (nunca x/y) | ✅ | Padrão consolidado — `issueBadges` (lint/validate) ancoram por nodeId e seguem o elemento em move/layout por construção de render. Pins idem. |
| Órfãs (elemento removido) | ⬜ V-4 | Semântica nova. |
| Ledger por msg/resolução | ✅ | `AuditLedger.append` aceita `type: string` livre (hash v2, `verifyLedger`) — `REVIEW_COMMENT_ADDED`/`REVIEW_THREAD_RESOLVED` são só entradas novas, zero mudança de motor. |
| XML round-trip byte-idêntico com review ativo | ✅/teste ⬜ | Por construção nada do review toca o modelo (`ReviewStore` é host-side); o TESTE vinculante (cerca §1.2) entra na V-4 no padrão do `viewerEquivalence`. |
| Popover na pilha de Esc · touch ≥44px | ⬜ V-4 | Mecanismos prontos (useDismissal, padrão `pointer: coarse` das U-2/U-5). |

## 2d — Painel de review no Studio

| Item | Status | Evidência |
|---|---|---|
| "Revisão do Aprovador" base | ✅ | `studio/src/review/ReviewScreen.tsx` + `queue.ts` (`pendingPromotions`) + `checks.ts` (`runReviewChecks`) + `decide.ts` (`approvePromotion`/`rejectPromotion` com `MIN_REJECTION_REASON_LENGTH`) — já renderiza `DiffView`, `StatusBadge`, assinatura I-2 e selo de âncora. |
| Split canvas (diff 2a + pins 2c) | ⬜ V-5 | O ReviewScreen mostra o diff como LISTA (`DiffView`), não pintado no canvas. |
| Abas Threads/Mudanças sincronizadas | ⬜ V-5 | Não existem; a aba Mudanças reusa a lista da V-3 (mesma fonte). |
| Gate `reviewThreadsRule` via `evaluateGates` | ✅ mecanismo / ⬜ regra | O mecanismo é EXATAMENTE o do soundness: `soundnessPromotionRule(): PromotionRule` plugada em `LifecycleConfig.rules` → aparece como gate `rule:N` no `evaluateGates` e no checklist do PromotionPanel. `reviewThreadsRule` segue o molde, 1:1. |
| Dispensa com justificativa auditada | ⚠ | Precedente parcial: `rejectPromotion` já exige justificativa mínima e audita. A DISPENSA de thread (sem rejeitar a promoção) é semântica nova — V-5, com entrada de ledger própria. |
| Banner "⚑ Aprovação bloqueada" | ⬜ V-5 | O padrão visual existe (card "⚑ Deploy bloqueado" da U-6) — reuso de estilo. |

## 2e — Aprovar / Pedir mudanças (assinados)

| Item | Status | Evidência |
|---|---|---|
| Aprovar assinado (I-2) | ✅ | `signApproval` + `SignedApproval` + verificação com fingerprint (`PromotionPanel`/`ReviewScreen`) — só ganha o gate novo. |
| Pedir mudanças (transição assinada) | ⬜ V-6 | Não existe. Fundação: assinatura pronta; comentário obrigatório tem precedente (`MIN_REJECTION_REASON_LENGTH`). |
| Estado EM REVISÃO ⟲ | ⬜ V-6, raio mapeado | `VersionStatus` é union de 6 valores; TODOS os pontos de extensão são `Record<VersionStatus, …>` (compilador aponta cada um): `DEFAULT_TRANSITIONS` (core), `SEAL_LABELS` (StatusBadge), `STATUS_COLOR` (VersionTimeline), i18n `status.*`. XML: `version.status` round-tripa como string via extensão `bpmnr:version` (`readVersion`, `elementDeserializer.ts:150`) — valor novo passa com fixture. |
| Transições SÓ pela state machine | ✅ | `LifecycleEngine.canTransition`/`promote` já é o único caminho (a UI reflete gates, nunca seta status — comentário no próprio PromotionPanel). Aditivo: `candidate → inReview → candidate`. |
| Diff da re-submissão v-pedido → v-nova | ⬜ V-6 | O registry guarda publicações por versão — base pronta; a seleção do par certo é V-6. |
| Copiloto rascunha resposta (C4) | ✅ mecanismo | `changeSummaryOrigin {author, promptTemplateRef, edited}` no core + template C4 no copilot — o fio novo (rascunhar RESPOSTA ao pedido) é V-6, autoria mista já registrada como existe. |
| Ledger `REVIEW_CHANGES_REQUESTED` + `verifyLedger` | ✅ mecanismo | Tipo livre + hash v2; a entrada nova com `{assinatura, comentário, threadRefs[]}` é só payload. |
| Selo ⟲ na galeria da Biblioteca | ⚠ **conflito 2** | `@buildtovalue/library` tem vocabulário FIXO de 6 estados (`LIFECYCLE_STATUSES`, independência por teste). Um 7º estado exige decisão — ver conflitos. |
| Relação com `rejectPromotion` existente | ⚠ **conflito 3** | Hoje o Studio já tem "rejeitar" (candidate → test pela tabela). "Pedir mudanças" (candidate → EM REVISÃO) coexiste ou substitui? Ver conflitos. |

## 2f — Command palette + estado vazio

| Item | Status | Evidência |
|---|---|---|
| Ctrl/Cmd+K e `?` livres | ✅ | Sem bindings atuais. |
| Fontes de comando como registros | ⚠ **conflito 4** | `contextMenuItems`/`contextPadItems` de PLUGIN são contratos introspectáveis ✅. Mas os BUILT-INS do menu vivem dentro do componente (`ContextMenu.tsx`, `useMemo` interno) e as ações da Toolbar são JSX sem registro. "Palette sem lista própria" exige extrair built-ins + ações de toolbar para um registro exportado (refactor mecânico; proposta na V-7). |
| `when()` por contexto | ✅ | Contrato N-5 já tem `when(target)` — a palette respeita o mesmo guard. |
| Fuzzy no label i18n + atalhos | ⬜ V-7 | Labels já vêm de `useT()`; o índice de atalhos existe implícito em `useKeyboardShortcuts` (extraível junto do registro). |
| Cheatsheet gerada da mesma fonte | ⬜ V-7 | Anti-drift por construção — depende do registro acima. |
| Estado vazio que ensina | ⬜ V-7 | Nenhum hoje (canvas vazio renderiza grade). |
| "Abrir exemplo" de 1 clique | ⚠ | O que é "exemplo governado" para a BIBLIOTECA (não o app demo)? Proposta: prop/config do host (`emptyStateExample?: BpmnDiagram`) — a lib não embute diagrama de domínio. Registrar na V-7. |

---

## Conflitos / decisões para a validação da V-0

1. **Tokens `--btv-success` e `--btv-blue` não existem** (cerca §1.3 os cita como
   "existentes"). Existem `--btv-green` (verde aprovação/seleção) e `--btv-ink`
   (azul #33567e). **Proposta:** mapear — adicionado→`--btv-green`,
   alterado→`--btv-ink` — SEM criar token novo (coerente com a cerca "nunca cor
   nova de notação" do H14). Alternativa: criar `--btv-success`/`--btv-blue` como
   ALIASES dos valores existentes.
2. **Selo ⟲ na Biblioteca × vocabulário fixo de 6 estados** (`LIFECYCLE_STATUSES`,
   com teste de independência). **Proposta:** manter os 6 estados; o adapter mapeia
   EM REVISÃO → `candidate` (perda documentada, como o contrato manda) e o selo ⟲
   viaja no `meta`/`typeLabel` do summary — a galeria mostra o glifo sem quebrar o
   vocabulário. Alternativa (mais invasiva): 7º estado na library = mudança de
   contrato do pacote independente.
3. **`rejectPromotion` (candidate→test) × "Pedir mudanças" (candidate→EM REVISÃO ⟲).**
   **Proposta:** "pedir mudanças" torna-se o caminho PADRÃO do Studio (2e);
   `rejectPromotion` permanece na API (compat) como rejeição dura, documentada como
   distinta. Alternativa: aposentar o reject da UI (manter só API).
4. **Palette "sem lista própria" exige registro que hoje não existe por inteiro:**
   built-ins do menu e ações da toolbar não são introspectáveis. **Proposta (V-7):**
   extrair `BUILT_IN_MENU_ITEMS`/ações de toolbar para registro exportado usado
   pelos componentes atuais (zero mudança de comportamento) e agregado pela palette.
5. **Eventos `review.*` × catálogo N-3:** ✅ compatível — adicionar evento = minor
   pelo contrato de estabilidade; nomes propostos não colidem com os 13 atuais.
   **Proposta de payload:** `review.thread.opened {threadId, elementId}` e
   `review.changes.requested {versionId, threadRefs}`; sugiro incluir também
   `review.thread.resolved {threadId}` (simetria com o ledger) — confirmar.

## Plano da V-1 (`diffDiagrams` headless no core) — critérios de aceite

**Escopo:** `core/src/diff/` ganha `diffDiagrams(base, target): DiffEntry[]`
construída SOBRE `computeDiff` (que fica intacto — apiSurface só cresce).

```ts
type DiffKind = 'added' | 'removed' | 'moved' | 'changed' | 'rerouted';
interface DiffEntry {
  kind: DiffKind;
  elementKind: 'node' | 'edge';
  elementId: string;
  label?: string;                       // p/ lista e a11y
  changes?: Record<string, FieldChange>; // popover ΔN (sem x/y/waypoints)
  from?: Point; to?: Point;             // moved: origem→destino (fantasma+seta)
  moved?: boolean;                      // changed que TAMBÉM mudou de posição
}
```

**Classificação (proposta, a validar):** nó com update SÓ de x/y → `moved`;
x/y + outros campos → `changed` com `moved: true` (categoria única, o render
desenha halo + seta); aresta com update SÓ de `waypoints` → `rerouted`; aresta
`supersede` → `changed` com `changes.supersededBy`; `removedInVersion` setado na
v-nova → `removed` (elemento fechado = removido para o review).

**Ordem estável de leitura do grafo:** rank topológico a partir dos start events
(BFS por fluxo, ciclos tolerados), desempate por posição da v-base e depois id;
removidos entram no rank da v-base. Exportada junto (a V-3 e a aba Mudanças da
V-5 consomem a MESMA ordem).

**Critérios de aceite:**
1. Determinístico: mesmo par → mesma lista, 10×; e **shuffle test** (mesmo
   conteúdo com ordem de inserção embaralhada nos maps → mesma lista).
2. Categorias exclusivas e exaustivas sobre as fixtures: added / removed /
   moved-only / changed / changed+moved / rerouted-only / supersede / subprocesso
   (filho muda, container não) / lane / elemento fechado.
3. `rerouted` NUNCA conta no ΔN de nós nem aparece como `changed` (checklist 2a).
4. ΔN do popover = nº de campos em `changes` EXCLUINDO x/y/waypoints.
5. Zero dependência nova; `computeDiff`/`DiffView` intactos; apiSurface do core
   atualizado; pisos de cobertura mantidos.

## Mapa V-1..V-7 (após validação)

Conforme §4 do README — uma PR por vez, pipeline completo + Actions verde antes
e depois do merge + relatório contra a checklist do painel + validação antes da
próxima. As decisões dos conflitos 1–5 entram nas PRs indicadas em cada item.
