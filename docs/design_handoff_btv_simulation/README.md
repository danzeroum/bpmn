# Handoff 7: Simulação e Inteligência de Processo — 7A tokens · 7B replay

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–6
**Pré-requisito:** Trust Layer merged. **7A independe do Handoff 6**; 7B usa `audit` (XES) e, para roteiros versionados, a `library` (adapter — opcional, degrada sem ela).
**Data:** julho 2026 · Revisado com parecer técnico externo (cercas §0 incorporadas)

---

## 0. Tese e cercas vinculantes

O produto modela, governa e prova — mas nunca **mostra o processo em movimento**. Este handoff fecha o ciclo *modelado ⇄ executado* em duas metades independentes: **7A — simulação de tokens** ("o modelo se comporta como espero?") e **7B — replay de execuções reais** ("a realidade se comporta como o modelo?").

Quatro cercas técnicas **vinculantes** (parecer externo, aceito integralmente):

1. **OR-join é aproximado, declaradamente.** A v1 executa semântica exata só de **XOR, AND e event-based**. OR-split = escolha múltipla manual; OR-join = aproximação local ("espera os tokens dos ramos ativados nesta sessão") **documentada em `limitations.md`**. Fingir semântica OR correta seria o primeiro ponto do produto a mentir — proibido.
2. **7B = token-replay fitness, nunca alignments.** Conformance checking significa: evento sem transição correspondente = desvio (fitness %). Alignments ótimos (A* sobre modelo×log) são literatura de process mining e ficam FORA — registrar em `pendencias.md` se houver demanda.
3. **Heatmap pré-agregado.** Uma passada no log gera frequências/tempos (O(n), sem DOM); a animação reproduz **apenas traces amostrados** (top variantes). Proibido 1 token DOM por evento. Orçamento: log de 100k eventos agrega em < 2s e o canvas mantém 60fps.
4. **Port-offset do roteador entra JUNTO (pré-requisito).** O token viajando sobre as arestas expõe rotas que atravessam nós. A melhoria barata já identificada (`pendencias.md` §2 — offset de portas na origem/destino) é a **PR 0** deste handoff. O roteador A* completo segue adiado.

Leis do repo inalteradas: zero runtime deps, headless + React separados, **pacotes desacoplados** (§2), PR estratégica → run do Actions confirmada verde antes e depois do merge.

## 1. Arquivos deste pacote

- `design-refs/Simulador de Tokens BTV.dc.html` — protótipo interativo 7A (token animado, escolha em gateway, boundary disparável, cobertura, registro no ledger, modo sem animação)
- `design-refs/Replay XES BTV.dc.html` — protótipo interativo 7B (heatmap por espessura, chips de tempo, desvios, fitness, variantes amostradas, comparação v2.0.0 × v2.1.0)
- `screenshots/` — estados capturados (§8)

Os dois protótipos navegam entre si (botões no header). Referências hifi — recriar em React, não copiar.

## 2. Arquitetura de pacotes (desacoplamento é requisito)

```
packages/simulation        <scope>/simulation        headless: motor de tokens (XOR/AND/event-based),
                                                     grafo a partir do modelo, cobertura de caminhos,
                                                     roteiros (record/replay de decisões). ZERO deps;
                                                     consome APENAS <scope>/core (tipos do modelo).
packages/replay            <scope>/replay            headless: parser XES 2.0 + CSV, pré-agregação
                                                     (frequência/tempo por transição), token-replay
                                                     fitness, extração de variantes. ZERO deps;
                                                     NÃO importa core — opera sobre um grafo abstrato
                                                     {nodes, edges} que o chamador fornece.
packages/react (extensão)  SimulationOverlay + ReplayOverlay — camada visual sobre o canvas
                                                     existente (token, heatmap, chips, escolha em gateway).
```

Regras de desacoplamento:
- `simulation` e `replay` **não se importam mutuamente** e não importam react. `replay` nem importa `core` — o adapter de grafo (`{ nodes: {id}[], edges: {id, source, target}[] }`) é fornecido pelo host; isso permite usar o fitness sobre qualquer grafo (DMN DRD futuro, por exemplo).
- Roteiros de simulação e resultados de sessão são **artefatos serializáveis** (JSON canônico). A integração com `library` (roteiros na Biblioteca) e com `audit` (sessão → ledger) acontece via **adapters no host**, nunca por import direto nos pacotes novos. Teste de grafo de dependência igual ao da `library` (Handoff 6 §10.2) para ambos.
- As integrações são **degradáveis**: sem registry → simulação funciona sem versionar roteiros; sem audit → sem registro no ledger; sem library → sem catálogo. Nenhum `import` condicional — só injeção.

## 3. 7A — Simulador de tokens (spec)

### Modo simulação
- Entrada pelo toolbar do Designer ("Simular…"); pill **MODO SIMULAÇÃO** azul (`#33567E`) no header. Canvas fica read-only; edição bloqueada até sair.
- **Token:** disco 18px dourado (`--btv-gold`) com anel branco 2.5 + halo `rgba(154,123,30,0.35)`, viajando **sobre a geometria real da aresta** (path sampling do `waypointsToPath` com cantos r8 — motivo da PR 0). Transição 450ms ease-in-out por segmento.
- **Modo passo a passo sem animação** (checkbox no painel + automático sob `prefers-reduced-motion`): transição 0ms — o token teleporta; toda a semântica preservada. A feature inteira funciona sem movimento (a11y vinculante).

### Semântica (motor headless)
- XOR: pausa e pede escolha (UI) ou escolhe por pesos (modo roteiro/aleatório).
- AND-split: N tokens visíveis; AND-join: espera todos (estado "aguardando 1 de 2" visível no join).
- Event-based gateway: escolha entre os catch events alvo.
- Boundary events: botão "disparar" contextual quando o token está no host (interrupting move o token; non-interrupting cria segundo token).
- OR: conforme cerca §0.1 — escolha múltipla no split, aproximação local no join, aviso "semântica aproximada (limitations.md)" visível no painel quando um OR participa.
- Elementos exercitados: aresta percorrida vira stroke verde 2.5 (persistente na sessão); nó atual: fill aquecido + stroke dourado 2.5.

### Escolha no gateway (touch-first)
Card flutuante na base do canvas (não popover no nó — dedo não oclui o diagrama): título "Gateway X — escolha a saída" + um botão ≥ 44px por sequence flow (label da condição). É a primeira interação da biblioteca melhor em touch que em desktop — testar em viewport touch no e2e.

### Painel de simulação (300px, substitui o inspector no modo)
1. Status da sessão + botões **▶ Avançar** / **↺ Reiniciar** (reiniciar preserva cobertura).
2. Disparo de boundary contextual.
3. **Cobertura de caminhos**: checklist dos caminhos estruturais (derivados do grafo — mesma análise do soundness), barra de progresso, "N/M exercitados".
4. **Trilha da sessão**: log mono das transições e decisões (é a serialização do roteiro).
5. **Registrar sessão no ledger**: grava `{ roteiro, cobertura, versão do diagrama, autor, timestamp }` como entrada auditável → vira **evidence no relatório SACM** do certify ("comportamento validado — N/M caminhos exercitados, roteiro #hash"). Conecta 7A ao Handoff 5 F-C3 sem custo novo.

### Roteiros
- Sessão gravada = roteiro reproduzível (mesmas decisões, replay determinístico).
- Roteiro é artefato versionável: adapter para a `library` (aparece na Biblioteca como tipo "ROTEIRO") — via host, conforme §2.
- **Gate opcional de promoção**: config do rules engine pode exigir "cobertura ≥ X% registrada para esta versão" — OFF por default; quando ON, o PromotionPanel/Revisão mostram o card de cobertura junto às verificações.

## 4. 7B — Replay de execuções (spec)

### Import
- XES 2.0 (padrão IEEE) e **CSV** (mínimo: `case`, `activity`, `timestamp`; mapeamento de colunas na UI). Parser headless em `replay`, streaming (linha a linha), nunca carrega o log inteiro em objetos ricos.
- Matching evento→nó por nome da atividade (normalizado) com relatório de não-mapeados.

### Heatmap (pill MODO REPLAY violeta `#7A4F9A`)
- **Espessura** da aresta = frequência (escala 2→8px, raiz quadrada) + rótulo de contagem com halo. Nunca só cor (a11y).
- **Chips de tempo médio** por atividade (pill âmbar `#FDFAF1`/`#E8D9AE`, mono 8.5px "⌀ 1,8 dias"); gargalo (maior ⌀) em vermelho com sufixo "GARGALO".
- **Desvios**: transições do log sem aresta correspondente = caminho pontilhado 3/5 vermelho sobre o canvas + pill "▲ DESVIO · N casos" + item clicável no painel (clique destaca no canvas). Fitness % no painel com barra.
- **Variantes**: top 3 sequências com % — botão "▶ Reproduzir" anima UM token pela variante amostrada (mesma mecânica do 7A, 650ms/passo).

### Integração com governança (o diferencial)
- Seletor de versão no header: execuções presas via `bindRun` filtram o log por versão — "12 execuções rodaram na v2.0.0".
- Card "antes de aprovar a vX": análise comparativa (gargalo real vs. o que a candidata muda) com ação **"anexar esta análise ao pedido de promoção"** → vira bloco na tela de Revisão do Aprovador (Handoff 6 §5) e entrada no ledger.

## 5. Matriz de estados

| Elemento | default | ativo/atual | exercitado | desvio | reduced-motion |
|---|---|---|---|---|---|
| Token 7A | — | disco dourado + halo, 450ms/segmento | — | — | 0ms (teleporta) |
| Token 7B | — | disco violeta, 650ms/passo | — | — | 0ms |
| Aresta 7A | tinta 1.5 | — | verde 2.5 persistente | — | idem |
| Aresta 7B | espessura 2–8 por frequência + contagem | — | — | pontilhada 3/5 vermelha + pill ▲ | idem |
| Nó 7A | normal | fill aquecido + stroke dourado 2.5 | — | — | idem |
| Nó 7B | normal + chip ⌀ | — | — | chip vermelho GARGALO | — |
| Gateway 7A | normal | card de escolha na base (botões ≥44px) | — | — | funciona igual |

## 6. Ordem das PRs

0. **PR 0** `fix(core): port-offset no roteador ortogonal` — pré-requisito visual (cerca §0.4); resolve pendência §2 na variante barata.
1. **7A-1** `feat(simulation): <scope>/simulation — motor headless` (grafo, semântica XOR/AND/event-based/boundary, OR aproximado + limitations.md, cobertura, roteiros; 100% testável sem DOM; teste de independência de deps)
2. **7A-2** `feat(react): SimulationOverlay — modo simulação no Designer` (token, escolha touch-first, painel, reduced-motion; e2e dos 3 caminhos do protótipo)
3. **7A-3** `feat(react+registry): roteiros versionados + sessão → ledger + evidence SACM` (integrações via injeção; gate opcional de cobertura no rules engine)
4. **7B-1** `feat(replay): <scope>/replay — parser XES/CSV + pré-agregação + fitness + variantes` (headless sobre grafo abstrato; benchmark 100k eventos < 2s)
5. **7B-2** `feat(react): ReplayOverlay — heatmap + desvios + reproduzir variante` (e2e com log fixture)
6. **7B-3** `feat(studio/react): replay ⇄ governança` (filtro bindRun por versão, "anexar ao pedido de promoção")

## 7. Critérios de aceite

1. **Semântica:** suíte do motor cobre: XOR escolha, AND N tokens + join sincronizando, event-based, boundary interrupting/non-interrupting, OR aproximado COM aviso; fixture "armadilha" (XOR-split→AND-join) trava no join exatamente como o soundness prevê — os dois concordam por construção.
2. **Cobertura:** os caminhos listados vêm da mesma análise de grafo do soundness (função compartilhada via core ou duplicação testada como idêntica — decidir e registrar); sessão com os 3 cenários do protótipo fecha 3/3.
3. **Desacoplamento:** testes de grafo de deps em `simulation` e `replay`; `replay` roda com grafo fake sem nenhum import do ecossistema (mesmo teste de acidez do Handoff 6).
4. **Reduced-motion:** com `prefers-reduced-motion`, nenhuma transição > 0ms e o fluxo completo é operável passo a passo (e2e com emulação).
5. **Performance:** log de 100k eventos: agregação < 2s, canvas 60fps após agregado (canário no CI com o limiar honesto de software rendering); simulação com 5 tokens paralelos sem queda de frame.
6. **Fitness:** fixture com desvio conhecido → fitness e lista de desvios exatos; log 100% aderente → fitness 100% e zero desvios.
7. **Ledger/SACM:** sessão registrada aparece no Ledger Explorer com tipo próprio; certify com `--assurance-case` inclui a evidence de cobertura quando existir.
8. **Touch:** escolha de gateway operável em viewport touch (Playwright touch) com alvos ≥ 44px.
9. **Export:** heatmap e desvios sobrevivem ao export PNG/SVG (geometria, não CSS filter).

## 8. Screenshots

| Arquivo | Estado |
|---|---|
| `01/02-simulador.jpg` | Token avançando; no gate com card de escolha touch-first |
| `03–05-simulador.jpg` | Sessão completa: 3/3 caminhos (feliz, rejeição, timeout), arestas exercitadas em verde, trilha da sessão |
| `01-replay.jpg` | Heatmap v2.0.0: espessuras + contagens, chips ⌀, gargalo, desvio destacado, fitness 91,2%, 2 desvios |
| `02-replay.jpg` | v2.1.0 (candidata): sem execuções, call-to-action de comparação antes da promoção |

## 9. O que NÃO fazer

- Não implementar semântica OR-join exata nem alignments (cercas §0.1/§0.2) — registrar demanda em `pendencias.md`.
- Não renderizar 1 token por evento no replay; não carregar o log inteiro em memória rica.
- Não acoplar `simulation`/`replay` a react, registry, library ou entre si — integração só por injeção no host.
- Não fazer da cobertura um gate obrigatório de promoção — opcional, OFF por default.
- Não inventar dados de simulação como "execução real" — 7A e 7B têm pills de modo distintas (azul/violeta) e nunca se misturam visualmente.
- Não publicar no npm sem o rename do escopo concluído (decisão @buildtovalue já tomada).
