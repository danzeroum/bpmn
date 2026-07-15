# Handoff 14 — UX Craft: Paridade de Edição (validação + refino do PR #103)

> **Para o desenvolvedor Claude Code.** Contexto importante: você JÁ implementou os
> itens 1–7 no PR #103 (context pad, auto-layout/guias, busca, complexGateway,
> `@buildtovalue/lint`) — excelente trabalho, incluindo a correção da §2 desatualizada
> (A* já existia do H10) e os adiamentos honestos em `pendencias.md` §2.1.
>
> Este handoff é a **régua de design que chegou depois do código**: a spec visual e de
> interação contra a qual a implementação deve ser validada e refinada. O fluxo aqui é
> invertido em relação aos handoffs anteriores — em vez de "leia e implemente", é
> **"compare o que existe com o estado-alvo, refine o que divergir, complete o que
> falta"**.
>
> Spec navegável: `design-refs/Spec UX Paridade de Edicao BTV.dc.html` — abra no
> navegador. São 7 painéis (1a–1g), cada um com o mock do estado-alvo (geometria,
> tokens, textos) + checklist de aceite objetiva.

## §0 Triagem obrigatória (antes de qualquer refino)

Para CADA painel 1a–1g, produza a tabela de reconciliação spec × PR #103:
- ✅ **conforme** — item da checklist atendido (aponte o teste/e2e que prova);
- ⚠ **divergente** — implementado diferente do mock (proponha: adotar spec / manter
  com racional registrado em `pendencias.md` — mesmo regime dos handoffs anteriores);
- ⬜ **faltante** — não implementado (entra no plano de PRs §5).

Reporte a reconciliação completa ANTES de codar qualquer refino. Divergência mantida
sem registro = não passa.

## §1 Cercas transversais (valem para os 7 casos)

1. Toda mutação = comando undoável; operações compostas (criar conectado, corrigir
   todos, aplicar layout, distribuir) = **UM** comando.
2. Superfícies novas: pilha de Esc, catálogo de eventos N-3, grep i18n N-6 (EN/PT-BR),
   gate de a11y, touch ≥44px.
3. Tokens `--btv-*`/`--bpmnr-*` existentes; nenhuma cor nova na notação.
4. **Precedência de hit-test com teste dedicado** (painel 1a): resize handles >
   context pad > portas > boundary-snap (drag) > reparent (drop). O pad é o 5º sistema
   de hit-test do canvas — o mapa de zonas é vinculante.
5. Canário de FPS não regride com nenhum caso ativo.
6. Rotas manuais 📍 nunca re-roteadas sem confirmação explícita (herda H10 §8.3 —
   vale para o auto-layout do item 2).
7. Nada silencioso: auto-layout sempre por proposta aplicar/recusar (exceto import sem
   DI, aplicado direto COM aviso declarado no import).

## §2 Os 7 casos — estado-alvo e pontos de atenção específicos

### 1a — Context pad (você entregou; validar contra o mock)
- Coluna vertical à direita, **offset 8px fora do bounding**; nunca sobrepõe portas
  nem resize handles; colisão com borda do viewport → flip/empurra, nunca corta.
- Máx **5 itens + ⋯**: tarefa, gateway XOR, evento de fim, conectar-a-existente, e o
  5º **contextual por plugin** (agentTask com domínio BTV ativo) — o pad é extensível
  pelo mesmo contrato do context menu N-5. Verifique: seu pad atual tem o slot de
  plugin? Se não, é item ⬜.
- Nó criado: +140px à direita, mesma linha, empurrando em colisão; novo elemento
  **selecionado** (encadeável). Você já fez — confirme a geometria.
- **`Tab` cria o próximo conectado** (quick-add sem mouse — diferencial sobre o
  bpmn-js). Se não entrou no PR #103, é ⬜ prioritário.
- Touch: tap seleciona → pad com alvos 44px.

### 1b — Smart guides (você entregou com 6px; spec pede ±4)
- Snap **±4px** a centros E bordas (h+v) — reconcilie o 6px implementado: adotar 4px
  ou registrar o racional do 6px (se veio de teste com usuários/touch, é aceitável).
- **Badges de distância igual** entre 3+ vizinhos (padrão Figma) — provavelmente ⬜.
- Só vizinhos no viewport; zero recálculo de arestas alheias (spy, padrão H10);
  guias somem no drop e nunca aparecem no export.

### 1c — Busca (você entregou; 1 lacuna provável)
- Já: Ctrl/Cmd+F, nome/id/tipo, Enter cicla, drill-down automático, viewer também.
- Validar: **busca em propriedades/refs** (`agnt-rsch@`, `decisionRef`, job type) —
  é o diferencial que ninguém tem; se ficou de fora, ⬜.
- Resultado com ícone + lane + tipo; pan animado + **2 pulsos de halo** no alvo
  (`prefers-reduced-motion` → 0); overlay na pilha de Esc; emite `selection.changed`.

### 1d — Painel de lint + quick-fix (pacote entregue; UX provavelmente ⬜)
- O `@buildtovalue/lint` headless está pronto — este painel é a superfície:
  dock inferior redimensionável, agrupado por regra, severidade com tokens (erro
  `--btv-error`, aviso âmbar), clique → seleciona + pan.
- **Quick-fix**: regra declara `fix(ctx) → command` opcional; botão "corrigir" =
  comando undoável; "corrigir todos" = UM composto; sem fix mecânico → botão
  "✦ sugerir correção" roteando pro C5 do copiloto (pipeline existente).
- **Diferencial de governança**: perfil de lint como artefato da Biblioteca
  (versionado, promovível, com selo) via `ArtifactAdapter` — o mesmo padrão do
  `copilotPromptAdapter`. Nenhum concorrente tem política de modelagem versionada.
- Lint de executabilidade (seu perfil engine) REUSA este painel — uma superfície só.

### 1e — Auto-layout (você entregou o motor; validar a proposta)
- Motor Sugiyama zero-dep ✅. Validar a UX: botão "Arrumar" deve mostrar **preview
  antes/depois com card aplicar/recusar** (padrão do boundary proposto A-5) com
  contagem ("5 nós movidos · 2 rotas manuais 📍 preservadas") — se o seu aplica
  direto, é ⚠ a reconciliar (a cerca §1.7 exige proposta).
- Crossfade 160ms no aplicar (reduced-motion → 0); determinístico (mesmo grafo →
  mesmo layout, teste 10×).

### 1f — Ponte de execução (parcialmente adiado — ok)
- O que fica DESTE handoff: aba "Execução" no properties panel com **progressive
  disclosure** (essencial visível; headers/IO/timeout dobráveis), só com plugin de
  engine ativo; lint de executabilidade no painel 1d (você já fez as regras).
- **Deploy gated**: botão só habilita com versão VIGENTE + assinada; CANDIDATA →
  card "⚑ Deploy bloqueado → Ir para promoção". Mock no painel 1f.
- Passthrough `zeebe:*` no round-trip: mantém adiado (PR dedicada, sua decisão §2.1
  está certa — interage com byte-estabilidade).

### 1g — Matriz de conformidade pública
- **Gerada pelo script de conformance** (anti-drift) — nunca mantida à mão.
- Células de concorrentes: só "declarado pela doc deles" com link — nunca claim
  próprio sobre terceiros. Publicada no CONFORMANCE.md.

## §3 Fora de escopo (confirmando seus adiamentos)

Deploy direto para engine; compensação/transação/coreografia; multi-pool real
(pendência §3, decisão de produto); recálculo incremental do A* no drag; A* como
default (decisão visual de produto — traga um comparativo lado a lado antes).

## §4 Aceite global

1. Reconciliação §0 completa e aprovada ANTES dos refinos.
2. Cada checklist de painel 100% ✓ (ou divergência registrada e aprovada).
3. Teste de precedência de hit-test (cerca §1.4) — obrigatório e novo.
4. e2e por caso: pad (criar conectado + Tab + touch), guias (snap + badge), busca
   (propriedade/ref + drill), lint (fix undoável + corrigir todos), layout (proposta
   aplicar/recusar + 📍 preservada), engine (deploy bloqueado por estado).
5. apiSurface, pisos de cobertura, canário FPS, i18n, a11y — como sempre.

## §5 Ordem sugerida das PRs de refino

| PR | Escopo |
|---|---|
| U-1 | Reconciliação §0 (relatório, sem código) + registros em pendencias |
| U-2 | Refinos do context pad (slot de plugin, Tab, geometria, touch) + teste de precedência |
| U-3 | Guias: badges de distância igual + reconciliação 4/6px |
| U-4 | Busca em propriedades/refs + pulso de halo |
| U-5 | Painel de lint (dock + quick-fix + adapter de política na Biblioteca) |
| U-6 | Proposta do auto-layout (card aplicar/recusar) + aba Execução gated |

---
Regime de sempre: uma PR por vez; pipeline local completo; Actions verde antes e
depois do merge; relatório contra a checklist do painel correspondente (item a item,
com evidência) antes da PR seguinte. Comece pela **U-1** e aguarde validação da
reconciliação antes de codar.
