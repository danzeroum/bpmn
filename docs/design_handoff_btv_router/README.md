# Handoff 10: Roteador A* com desvio de obstáculos

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–9 · resolve a pendência §2 (parte adiada)
**Pré-requisito:** craft pack (cantos r8) e port-offset (PR 0 do Handoff 7) merged. Independente dos handoffs 5–9.
**Data:** julho 2026 · Origem: brief de design do time (roteamento inteligente)

---

## 0. Tese e régua de qualidade

Feature de roadmap, não bug: o A* foi deliberadamente adiado; a variante barata (port-offset 16px) já está entregue. A régua: **um roteador "meia-boca" degrada a UX atual** — rota que pisca, oscila no drag ou cruza formas imprevisivelmente é pior que o ortogonal de hoje. Menos escopo bem-acabado > mais escopo instável.

## 1. Decisões de UX (respostas às perguntas do brief — vinculantes)

1. **Auto-routing: global por diagrama + override por aresta (herança).** O diagrama define o router default (`straight|orthogonal|astar`); cada aresta pode divergir (rota manual ou router próprio). Mesmo modelo de herança do resto do produto.
2. **Drag: preview barato + assentamento.** Durante o drag, as arestas do nó movido seguem com o **roteador ortogonal atual** (imediato, estável, 60fps). Ao soltar, o A* **assenta com crossfade de 160ms ease-out**. A* ao vivo foi avaliado e **recusado**: oscila em diagramas densos (o risco "dança" do brief) e quebra o determinismo percebido. Arestas não relacionadas ao nó movido **nunca** recalculam.
3. **Auto vs. manual sem poluição:** nenhum indicador permanente no canvas. Badge `📍 rota manual` (pill `#FDFAF1`/borda dourada, mono 9px) e waypoints como **handles preenchidos** (auto = vazados) aparecem **só em hover/seleção**. "Voltar ao automático" no menu de contexto da aresta + no inspector. A autoria da rota (auto/manual/autor) vive no ledger.
4. **"Limpar roteamento": sim, ação explícita no toolbar.** Re-otimiza todas as arestas automáticas; **preserva rotas manuais por default** — toast: "6 arestas re-otimizadas · 1 rota manual preservada · undoável". Reset total (incluindo manuais) é opção secundária com confirmação. Tudo 1 comando undoável.

## 2. Arquivos

- `design-refs/Roteador A-Star BTV.dc.html` — protótipo navegável antes/depois: toggle Ortogonal↔A* (crossfade), 2 obstáculos com selo "✕ atravessado"/"desviado ✓", fan-out em corredores paralelos de 8px, rota manual selecionável com badge e handles, fallback "⚠ sem corredor" em nós sobrepostos, ação Limpar roteamento com toast.
- `screenshots/` — os dois modos + estados (§8).

## 3. Algoritmo (contrato com a engenharia)

- **Visibility graph ortogonal** sobre os bounds dos nós inflados com **clearance de 12px**; A* com custo composto: `comprimento + 2×(nº de curvas) + 4×(nº de cruzamentos com arestas já roteadas)` — favorece rotas retas e com poucos cruzamentos, na ordem que o brief pede (legibilidade > distância).
- **Determinismo:** desempate estável (ordem de criação da aresta); mesmo diagrama → mesma rota, sempre. Sem aleatoriedade, sem dependência de ordem de render.
- **Roteamento incremental:** mover um nó invalida apenas as arestas conectadas a ele (+ as que cruzavam sua área antiga/nova, re-rankeadas em idle). Nunca reroteamento global implícito — global só via "Limpar roteamento".
- **Router plugável:** `astar` entra como terceiro router no contrato existente; `straight`/`orthogonal` intactos; seleção por diagrama e por aresta (§1.1).
- **Orçamento de performance:** rota única < 5ms em diagrama de 100 nós; "Limpar roteamento" de 200 arestas < 300ms (benchmark no CI com limiar honesto de software rendering). Grid do visibility graph reutilizado entre chamadas no mesmo frame.

## 4. Estados visuais (tokens do sistema — nada novo inventado)

| Estado | Spec |
|---|---|
| Roteada normal | tinta 1.5, cantos r8 (herda craft pack), marcadores por tipo de fluxo inalterados (sequence/message/association já diferem) |
| Durante drag do host | rota ortogonal preview, **opacidade 0.7** (sinaliza transitório) |
| Assentamento (soltar) | crossfade preview→A* 160ms ease-out; **nunca morphing de path** (trajetória imprevisível); `prefers-reduced-motion` → 0ms |
| Manual (hover/seleção) | stroke `--btv-gold` 2.5 + handles preenchidos dourados r5 + badge 📍; fora de hover/seleção: idêntica às automáticas |
| Auto (seleção) | handles vazados (fill branco, stroke selected) — affordance de "arraste para fixar" |
| Sem rota válida | reta tracejada 3/4 em `--btv-error` opacity 0.85 + chip `⚠ sem corredor` (pill `#FDF3F1`/borda error, mono 8.5px); nunca trava |
| Hover de aresta | craft pack existente (stroke 2, color-mix) — inalterado |
| Corredores densos | arestas paralelas no mesmo canal espaçadas **8px**; acima de 4 no mesmo corredor, agrupamento visual mantém 8px e desloca o canal |

**Labels de aresta:** posicionadas no **maior segmento livre** da rota (não no ponto médio geométrico), com halo `paint-order: stroke` existente; se nenhum segmento comporta, label acima do segmento mais longo com leader line de 4px.

## 5. Casos de borda (cobrir com fixture + e2e cada)

1. **Self-loop:** rota em U pela direita do nó (offset 24px), determinística.
2. **Boundary event:** sai perpendicular à borda do host com clearance do próprio host (não colide com o pai) — integra a ancoragem paramétrica existente.
3. **Message flow entre pools:** atravessa a fronteira perpendicularmente; corredor preferencial no gap entre pools.
4. **Nós sobrepostos/sem corredor:** fallback honesto (§4); revalida quando o usuário afasta os nós (recupera sozinho, sem ação).
5. **Fan-out do gateway:** N arestas para alvos próximos → corredores paralelos 8px, ordenadas pela posição do alvo (sem cruzamento entre irmãs).
6. **Aresta manual cujo nó âncora foi movido:** waypoints manuais transladam rígido com o segmento conectado; se a translação criar colisão, a aresta mantém a rota manual e ganha o chip ⚠ (nunca re-rotear silenciosamente — cerca §1.3 do brief).

## 6. Interação

- **Editar:** arrastar segmento cria bend (vira manual); duplo-clique em waypoint remove; arrastar waypoint move. Toda edição = comando undoável.
- **Resetar:** menu de contexto "Voltar ao automático" + botão no inspector; undoável.
- **Touch:** handles r5 visuais com hit-area 44px (invisível); tolerância de snap 8px; sem gesto novo — os mesmos de pointer.
- **Ancoragem de portas:** lado escolhido pelo A* (menor custo), estável por histerese — só muda de lado se o custo melhorar > 20% (evita flip-flop ao mover 2px).

## 7. Ordem das PRs

1. **R-1** `feat(core): visibility graph + A* router headless` (função pura waypoints; determinismo por fixture; benchmark; casos de borda 1–5 como fixtures de rota exata)
2. **R-2** `feat(react): router selecionável + assentamento pós-drag + estados visuais` (preview 0.7, crossfade 160ms, reduced-motion; e2e drag denso sem recálculo de arestas alheias)
3. **R-3** `feat(react+core): rotas manuais — handles, badge, translação rígida, voltar ao automático` (comandos undoáveis; e2e do caso de borda 6)
4. **R-4** `feat(react): limpar roteamento + fallback sem-corredor + corredores paralelos` (toast com contagem; e2e de preservação de manuais)

## 8. Critérios de aceite ("não meia-boca", do brief)

1. Diagrama de 100+ nós: zero arestas atravessando formas (exceto fallbacks declarados); cruzamentos reduzidos vs. ortogonal (contagem no teste com o diagrama de stress).
2. Drag a 60fps (canário CI com limiar honesto); arestas não relacionadas: **zero** recálculo (spy no teste).
3. Rota manual nunca é sobrescrita por reroteamento automático — nem por "Limpar roteamento" no modo default (e2e).
4. Nenhum estado trava: sem-corredor → fallback visível; recupera sozinho ao liberar espaço.
5. Determinismo: mesma fixture roteada 10× → waypoints idênticos byte a byte.
6. Round-trip: waypoints exportados no DI (absolutos, como sempre); import de diagrama externo com waypoints respeita-os como manuais.
7. Export PNG/SVG fiel (fallback e badges por geometria).

## 9. O que NÃO fazer

- Não recalcular A* ao vivo durante drag (§1.2) — nem como opção escondida.
- Não fazer morphing de path no assentamento — crossfade apenas.
- Não re-rotear rotas manuais silenciosamente, jamais (§5.6).
- Não mover nós (auto-layout é outro produto); não curvas estilizadas — estética ortogonal.
- Não quebrar os routers existentes nem o DI round-trip.
- Não otimização global implícita — só a ação explícita e undoável.
