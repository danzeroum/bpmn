# Handoff 15 — Review Visual de Versões

> **Para o desenvolvedor Claude Code.** Este handoff veste o diferencial que nenhum
> concorrente tem: bpmn-js não tem versões, Camunda não tem diff no canvas — vocês
> têm diff estruturado, promoção assinada, ledger e Studio. Falta a EXPERIÊNCIA:
> diff pintado no canvas, navegação mudança-a-mudança, comentários ancorados,
> threads e o ciclo aprovar/pedir-mudanças assinado.
>
> **Formato reconciliação-primeiro** (adotado após o Handoff 14): §0 antes de
> qualquer código. Spec navegável: `design-refs/Spec UX Review Visual BTV.dc.html`
> — 6 painéis (2a–2f), cada um com mock do estado-alvo + checklist de aceite.

## §0 Triagem obrigatória (antes de qualquer código)

A fundação existe e NÃO deve ser reescrita — reconcilie primeiro:

| Peça existente | Onde | O que este handoff faz com ela |
|---|---|---|
| Diff estruturado (`normalizeForDiff`, `canonicalJson`, DiffView) | core / react | 2a REUSA como fonte; se o diff atual não distingue added/removed/moved/changed por elemento, a lacuna vira V-1 |
| `panViewportTo` + pulsos + reduced-motion (U-4/U-5) | react `canvas/viewport.ts` | 2b navega com o MESMO mecanismo — zero duplicação |
| Pilha de Esc (`useDismissal`) | react | toda superfície nova entra nela |
| `evaluateGates` + soundness como gate | registry / react | 2d adiciona `reviewThreadsRule` pelo MESMO mecanismo |
| Assinatura ed25519 + payload canônico (I-1/I-2) | identity | 2e assina o "pedir mudanças" com o fluxo existente |
| State machine de status + StatusBadge + tabela de selos | registry / react | 2e ADICIONA o estado EM REVISÃO ⟲ — aditivo, nada muda |
| Padrão de contrato injetado (AIProvider, AnchorAdapter, EngineBridge) | vários | 2c/2d introduzem `ReviewStore` no mesmo molde |
| `TRANSIENT_SELECTORS`/`TRANSIENT_ATTRIBUTES` (U-3/U-5) | exporter | overlay de diff e pins nunca vazam no export |
| C4 change_summary do copiloto | copilot | 2e: copiloto rascunha a resposta ao pedido; humano edita e assina |
| Catálogo de eventos N-3, i18n N-6, a11y | react | valem integralmente |

Para cada painel 2a–2f, produza a tabela ✅/⚠/⬜ contra a main atual e reporte
ANTES de codar. Divergência mantida sem registro em `pendencias.md` = não passa.

## §1 Cercas transversais

1. **Modo review é READ-ONLY absoluto** — o canvas com diff/pins nunca aceita
   edição; nenhum comando de mutação alcançável (teste vinculante, padrão C3).
2. **Nada de review entra no XML BPMN** — threads, resoluções e estado de review
   vivem no `ReviewStore` (host) + ledger. Round-trip byte-idêntico com review
   ativo é critério de aceite.
3. **Cores de diff só dos tokens existentes**: adicionado `--btv-success` (verde),
   removido `--btv-error`, movido `--btv-gold`, alterado `--btv-blue`. Nunca só
   cor: todo estado carrega glifo + texto (`+ADD`, `−REM`, `→MOV`, `ΔN`).
4. **Transições de status SEMPRE pela state machine do core** — a UI nunca seta
   status direto. "Pedir mudanças" é transição nova (CANDIDATA → EM REVISÃO),
   assinada, com comentário obrigatório.
5. **Gate de threads**: threads abertas bloqueiam aprovação via `evaluateGates`
   (só abertas — órfãs e resolvidas nunca bloqueiam); "dispensar" exige
   justificativa e vira entrada de ledger.
6. **Degradação declarada**: sem `ReviewStore` → pins/threads ausentes, diff e
   navegação continuam; sem duas versões → modo diff indisponível com estado
   explicativo, nunca erro.
7. Superfícies novas: pilha de Esc, eventos N-3 (novos: `review.thread.opened`,
   `review.changes.requested` — proposta, confirme na reconciliação), i18n
   EN/PT-BR, touch ≥44px, canário de FPS.

## §2 Os 6 casos — estado-alvo (detalhe visual nos painéis)

### 2a — Diff pintado no canvas
- `diffDiagrams(base, target)` headless no core → `DiffEntry[]` tipado
  (`added | removed | moved | changed | rerouted`), determinístico, por
  elementId. `rerouted` (só waypoints) é categoria própria — não polui ΔN.
- Render sobre o **viewer** (N-7), read-only: inalterado esmaecido 45% (nunca
  oculto); removido = fantasma tracejado na posição da v-base; movido = fantasma
  na origem + seta ao destino; alterado = halo tracejado + badge ΔN clicável
  (popover com props antes → depois).
- Legenda flutuante com contagens; tudo em `TRANSIENT_SELECTORS`.

### 2b — Navegação mudança-a-mudança
- Barra superior: "mudança N de M", ←/→ e F7/Shift+F7 com wrap, chips de filtro
  por tipo (combináveis, contador reflete filtro).
- Cada passo: `panViewportTo` + 2 pulsos (reduced-motion → instantâneo, 0
  pulsos); drill-down automático em subprocesso (padrão da busca U-4);
  removidos são navegáveis (pan até o fantasma).
- Ordem estável de leitura do grafo (determinística), nunca ordem de render.

### 2c — Comentários ancorados
- Contrato **`ReviewStore`** injetado pelo host (molde AIProvider): threads
  `{id, elementId, versionRef, autor, msgs[], resolved}`. Editor nunca persiste
  review — só lê/escreve pelo contrato.
- Pin dourado com contagem na borda do elemento (segue em move/layout — âncora
  por id, nunca x/y); resolvida = ✓ vazado verde; elemento removido → thread
  **órfã** no painel, nunca apagada.
- Popover de thread na pilha de Esc; cada mensagem/resolução = entrada de ledger
  (`REVIEW_COMMENT_ADDED`, `REVIEW_THREAD_RESOLVED`).

### 2d — Painel de review no Studio
- Estende a Revisão do Aprovador: split canvas (diff 2a + pins 2c) + painel
  lateral com abas **Threads / Mudanças** (a aba Mudanças é a lista do 2b —
  mesma fonte, clique navega).
- Banner de gate: "⚑ Aprovação bloqueada — N threads abertas" com ações
  resolver / dispensar-com-justificativa (auditada).

### 2e — Aprovar / Pedir mudanças (assinados)
- **Aprovar**: fluxo I-2 existente, agora condicionado também ao
  `reviewThreadsRule`.
- **Pedir mudanças** (novo): comentário geral obrigatório + threads abertas
  anexadas; assinado ed25519; transição CANDIDATA → **EM REVISÃO ⟲** (status
  novo, aditivo: registry + XML round-trip + StatusBadge com selo gold + galeria
  da Biblioteca). Nova submissão do designer volta a CANDIDATA; o diff da
  re-submissão compara v-pedido → v-nova.
- Ledger: `REVIEW_CHANGES_REQUESTED {assinatura, comentário, threadRefs[]}`.
- Copiloto (C4): pode rascunhar a resposta ao pedido — humano edita e assina;
  autoria mista registrada como já existe.

### 2f — Carona: Command palette + estado vazio
- **Ctrl/Cmd+K**: a palette NÃO tem lista própria — agrega os registros
  existentes (context menu N-5, `contextPadItems`, ações de toolbar), respeita
  `when()`, fuzzy match no label i18n, mostra atalhos. "?" abre cheatsheet
  gerada da mesma fonte (anti-drift por construção).
- **Estado vazio**: canvas sem elementos ensina (paleta / Tab / ⌘K) + "abrir
  exemplo" de 1 clique com diagrama governado; some ao primeiro elemento.

## §3 Fora de escopo (não implemente)

Multiplayer/presença em tempo real; comentários em posição livre do canvas (só
âncora por elemento); notificações/e-mail (host-owned via eventos); review de
artefatos não-BPMN da Biblioteca (o contrato `ReviewStore` já nasce genérico —
registre a extensão como pendência); onboarding tour multi-passo (só o estado
vazio); temas de densidade/alto contraste (handoff futuro de theming).

## §4 Plano de PRs (ordem vinculante, uma por vez)

| PR | Escopo | Painel |
|---|---|---|
| **V-0** | Reconciliação §0 (docs-only) | todos |
| **V-1** | core: `diffDiagrams` headless tipado + determinismo + fixtures (added/removed/moved/changed/rerouted, subprocessos, lanes) | 2a |
| **V-2** | react: DiffOverlay no viewer + legenda + popover ΔN + export limpo | 2a |
| **V-3** | react: barra de navegação + chips + pan/pulsos + lista sincronizada | 2b |
| **V-4** | contrato `ReviewStore` + pins + threads + ledger + órfãs | 2c |
| **V-5** | studio: painel Threads/Mudanças + gate `reviewThreadsRule` + dispensa auditada | 2d |
| **V-6** | registry/react/studio: estado EM REVISÃO ⟲ + pedir mudanças assinado + e2e do ciclo completo | 2e |
| **V-7** | react: command palette + cheatsheet + estado vazio | 2f |

Regime de sempre: pipeline local completo (lint, typecheck, coverage com pisos,
e2e, guards) → PR → Actions verde antes E depois do merge → relatório contra a
checklist do painel → validação antes da próxima.

## §5 Aceite global

1. Reconciliação §0 aprovada antes de V-1.
2. Cada checklist de painel 100% ✓ ou divergência registrada e aprovada.
3. Teste vinculante de read-only do modo review (cerca §1.1).
4. Round-trip XML byte-idêntico com review ativo (cerca §1.2).
5. e2e do ciclo completo: candidata → diff → comentar → pedir mudanças
   (assinado) → editar → re-submeter → resolver threads → aprovar (assinado) →
   VIGENTE — com ledger íntegro (`verifyLedger`) ao final.
6. apiSurface, pisos de cobertura, canário FPS, i18n (grep), a11y — nenhum
   regride.

---
_Design BuildToValue · Handoff 15 · spec navegável em `design-refs/`._
