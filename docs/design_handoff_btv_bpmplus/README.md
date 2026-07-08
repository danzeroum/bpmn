# Handoff 5: Componentes OMG BPM+ — DMN · PPMN/SACM · Healthcare

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–4 (`docs/design_handoff_btv_bpmn/`, `docs/design_handoff_btv_craft_governance/`, `docs/design_handoff_btv_prototypes/`, `docs/design_handoff_btv_trust/`)
**Pré-requisito:** F7 completo e Trust Layer (Handoff 4) merged — este handoff ASSUME subprocesso aninhado, callActivity, drill-down, certify, soundness e audit já na main.
**Data:** julho 2026 · **Origem:** análise dos grupos OMG (BMI DTF, Healthcare DTF, SysA PTF) × roadmap F9+

> **⚠ Reconciliação obrigatória (leia antes da Fase A):** partes da Fase A foram escritas antes do F7 ser concluído e JÁ ESTÃO implementadas na main (subprocesso expandido, callActivity, drill-down). A Fase A é um alvo de CONVERGÊNCIA, não uma implementação do zero — ver §3.0.

---

## 1. Arquivos

- `design-refs/btv-dmn-tokens.css` — **pronto para uso**: anexar após `btv-tokens.css`. Todo consumo com fallback, zero breaking change.
- `design-refs/BTV DMN Notation.dc.html` — folha hifi: Fases A–D, tokens, dark, gramática da família (fonte visual da verdade).
- `design-refs/Wireframes BPM+ UX.dc.html` — **lo-fi de co-criação**: alternativas para cada decisão em aberto (§7 do briefing), com a recomendada marcada. Validar as escolhas ANTES de implementar as interações.

**Fidelidade:** folha de notação = alta (recriar fielmente). Wireframes = estrutural (fluxo e hierarquia contam; pixels não).

## 2. Decisões em aberto — FECHADAS na revisão de 08/07/2026

Escolhas confirmadas: **1c · 2c+2d (complementares) · 3a · 4b (pedigree de EDGE) · 5b (variante mitigada) · 6b**. Hifi dos complementos em `design-refs/BTV BPM+ Estados e Interações.dc.html` e `design-refs/Relatorio SACM Certify.dc.html`. Trade-offs originais:

| Questão | Recomendação | Wireframe |
|---|---|---|
| (a) Navegação BPMN⇄DMN | **Drill-down + breadcrumb de governança** (cada nível carrega semver + selo de vigência). Mesmo gesto do subprocesso expandido → 1 padrão para toda a família. Split rejeitado: divide espaço e duplica foco de undo. | 2c (2a/2b alternativas) |
| (b) Tabela no canvas ou superfície própria | **Híbrido**: peek read-only (overlay DOM sobre o canvas, hit policy + nº de regras + versão + "editar →") e edição em superfície própria via drill-down. Embed total fere o orçamento SVG. | 1c |
| (c) Elemento fechado em versão antiga | **Hachura 45° 6px + dessaturação + selo pill "FECHADO vX.Y"**. Não depende de cor (a11y); tracejado rejeitado (já significa rascunho e non-interrupting); fantasma rejeitado (some no dark). | 5b |
| (d) Identidade do SACM | **Sub-marca "certify"**: mesmos tokens BTV, gramática de DOCUMENTO (filete ouro 4px no topo, rodapé de auditoria com hash/aprovadores/paginação, print-ready). Identidade 100% própria custaria coesão sem ganhar autoridade. | 6b |

## 3. Especificação pixel a pixel — Fase A

### 3.0 Reconciliação com a main (fazer PRIMEIRO, antes de codar)

O F7 já entregou subprocesso aninhado (expand/collapse + drill-down), callActivity e dataStore. Portanto:

1. **Diff spec × implementação:** compare §3.2/§3.3 com o código real merged. Liste as divergências (medidas, marcadores, faixa de título, animação de colapso, estado CALL_REF_MISSING) em um comentário da PR F-A. Ajuste a implementação à spec APENAS onde a divergência for visual/UX; onde a implementação real tiver razões técnicas superiores, registre em `pendencias.md` e mantenha.
2. **`GovernanceBreadcrumb`:** se o drill-down do F7 já tem breadcrumb, promova-o a componente compartilhado com semver + StatusBadge por nível (§10.3); se não tem, crie-o conforme spec. É pré-requisito da F-B2.
3. **Trabalho genuinamente novo da Fase A:** `businessRuleTask` (§3.1) — era F9, não existe na main — e o badge de decisão vinculada.

Geometria core **neutra ao padrão OMG** (sem chanfro/tag). Traço 1.5 default / 2.5 selecionado; estados de seleção/erro idênticos aos já implementados (halo + portas do craft pack, badge "!" de erro).

### 3.1 `businessRuleTask`
- Card 150×70 rx 10, fill `--bpmnr-fill-task` (branco), stroke tinta 1.5.
- **Glifo de tabela** 16×12 rx 1 no canto sup. esq. (x 9, y 8): moldura + linha de header em y 4 + divisor vertical em x 5.5; header com barra 3px op. 0.25. Stroke tinta 1.2.
- **Badge de decisão vinculada** (só quando `properties.decisionRef`): pill 30×16 r 8 centrada sobre a borda, canto sup. dir. (x = w−21, y = −8); fundo `--btv-dmn-link-badge-bg`, borda `--btv-dmn-link-badge-stroke` 1; conteúdo: mini-tabela 9×9 + check 1.4. Clique no badge = abrir a decisão (drill-down).
- Hover: fill `--bpmnr-hover`; selecionado: stroke `--bpmnr-selected` 2.5 + halo offset 3 op. 0.35 + portas r 4.

### 3.2 `callActivity`
- Card 150×70 rx 10, **borda 3.5** (spec: thick border), fill branco.
- Marcador de colapso **+** 14×14 rx 2 centrado na base (y = h−16), traço 1.5.
- **Referência quebrada** (`calledElement` não resolve no registry / sem versão `activeAt`): stroke e marcador `--btv-error`, badge circular r 9 preenchido no vértice sup. dir. com "!" branco 11px 700, código `CALL_REF_MISSING` mono 9px abaixo do shape.
- Com referência resolvida, o rodapé interno pode exibir mono 9px `→ nome@semver` (truncado com ellipsis).

### 3.3 Subprocesso expandido
- Container min 300×160 rx 12, fill branco, stroke tinta 1.5, **faixa de título 30px** (nome 12px 600 à esquerda, tag `subProcess` mono 9px à direita, divisor 1px `#E2DDD3`).
- Filhos em coordenadas **relativas ao container** (DI hierárquico F7); container atrás dos filhos, à frente de lanes.
- Marcador − (expandido) / + (colapsado) 14×14 rx 2, base centrada. Colapso anima 160ms ease-out para o card 150×70 padrão.
- Duplo-clique no título = drill-down (breadcrumb) — gesto idêntico ao DMN (§2a).
- Sombra `feDropShadow` padrão de activity; filhos mantêm as próprias.

## 4. Especificação pixel a pixel — Fase B

Família DMN = degrau **185° petróleo** da roda de 9 matizes. Tokens em `btv-dmn-tokens.css` (light+dark). Diferenciação interna por **forma** (spec DMN) e peso de fill: lógica `--btv-dmn-fill`, dado `--btv-dmn-input-fill` (mais claro), autoridade `--btv-dmn-knowledge-fill` (papel).

### 4.1 DRD (mínimo viável)
| Nó | Tamanho | Geometria |
|---|---|---|
| `decision` | 150×60 | retângulo **reto** (rx 0); glifo tabela 12×9 canto inf. esq. quando tem decision table |
| `inputData` | 140×44 | oval achatado (rx = h/2) |
| `knowledgeSource` | 120×60 | retângulo com **base ondulada** (2 curvas C alternadas, amplitude 8) |
| `businessKnowledgeModel` | 140×44 | retângulo com 2 cantos cortados 12px (sup. esq. em perspectiva + inf. dir.), aresta interna visível |

Requirement edges (cor única `--btv-dmn-edge`, roteamento **reto**, não ortogonal):
- *information* — sólida 1.5, seta cheia 9×9;
- *knowledge* — tracejada 5/4, seta aberta (2 linhas);
- *authority* — pontilhada 2/4, **disco cheio r 3.5** na ponta.

Seleção/erro: mesmos overlays do BPMN (verde 2.5 + portas; erro vermelho + badge "!").

### 4.2 Editor de Decision Table (HTML/DOM, compartilha tokens)
- **Anatomia canônica DMN:** célula de hit policy no canto sup. esq. (40px, letra 17px 700 mono, fundo `--btv-dmn-hit-bg` ouro — clique abre menu U/A/P/F/R/O/C com frase de efeito); headers de input/output `--btv-dmn-table-header-bg`; **duplo traço 3px** `--btv-dmn-stroke` separando inputs de outputs; coluna de nº de regra `--btv-dmn-table-rule-bg`; coluna de anotação com borda tracejada e texto itálico `--btv-dmn-annotation-fg`.
- Grid `--btv-dmn-table-grid` 1.5px; linhas 34px (alvo ≥ 24px); expressões FEEL em IBM-Plex-Mono-equivalente do sistema (`ui-monospace` stack — sem webfont no export).
- **Interações:** 1 clique seleciona célula · Enter/duplo-clique edita inline (caret visível) · Tab/setas navegam · header de coluna abre popover (nome, tipo, expressão FEEL, remover) · nº da regra: clique seleciona linha (fundo `--btv-dmn-cell-selected`), arrasto reordena, menu contextual duplica/remove · "+ coluna" insere antes do duplo traço (input) ou depois (output).
- **Célula inválida:** fundo `--btv-dmn-cell-invalid-bg` + borda 2 `--btv-error` + prefixo ▲ + tooltip com a mensagem — nunca só cor.
- **Governança:** breadcrumb no topo (`fluxo vX ▸ nó ▸ tabela vY [SELO]`), StatusBadge canônico, botão Promover… (mesmo modal do Designer). Toda mutação = comando no `CommandStack` compartilhado (undo global); tabela é artefato versionável no registry (draft→…→retired), edição bloqueada quando não-rascunho — editar cria nova versão (supersede), padrão do core.

### 4.3 Vínculo BPMN ⇄ DMN
- Inspector do `businessRuleTask` ganha seção `DECISÃO · DMN` (wireframe 2d): busca no registry, card da decisão vinculada (nome, semver, selo, hit, nº de regras) com ações **abrir → / diff / desvincular**, ou "+ criar nova tabela" (nasce RASCUNHO).
- Vincular/desvincular = comando undoável + entrada no ledger.
- Navegação: duplo-clique no nó (ou badge, ou "abrir →") = drill-down com breadcrumb de governança; Esc/breadcrumb sobe.
- **Peek (spec revisada):** gatilho = **seleção** (hover só antecipa em desktop — touch básico sem hover, limitations.md). Overlay DOM 300 × ≤168px rx 10, sombra `0 4 14 rgba(68,64,58,.12)`, à direita do nó (flip se não couber) offset 12px. Conteúdo: nome + StatusBadge + semver · hit policy 20px + resumo ("First · 4 regras · 2→1") · **2 primeiras regras** + "+n regras…" · footer "editar tabela →". Fecha em Esc / deseleção / drill-down. Zero nós inseridos no SVG.

## 5. Fase C — governança visível

- **Elemento fechado:** dessaturar (fill `#F0EEE9` / dark `#2C2825`, stroke `--btv-pedigree-line`), hachura `<pattern>` 45° 6px linha 1px `--btv-closed-hatch`, selo pill 18px "FECHADO vX.Y" (estilo ARQUIVADA da tabela canônica). 1 def de pattern por SVG, N usos — barato.
- **Faixa de pedigree** (sobre `getEdgeChain`): faixa inferior do canvas 180px; trilho horizontal 1.5 `--btv-pedigree-line`, tempo flui →; cards 70×48 = snapshot do shape por versão (fechados hachurados, atual borda gold 2.5 fill `#FDFAF1` + badge de vigência); rótulo mono 8.5px sob cada card; "supersede ▸" ouro entre cards; clique = `DiffView` lado a lado; hover = hash do ledger.
- **Relatório SACM (`certify`):** documento print-ready sub-marca certify — filete ouro 4px no topo, kicker `BTV CERTIFY · ASSURANCE CASE · SACM`, notação canônica: **claim** retângulo `--btv-sacm-claim`, **argument** paralelogramo `--btv-sacm-argument`, **evidence** círculo `--btv-sacm-evidence` contendo hash de entrada do ledger; relações inferidas tracejadas; rodapé de auditoria (hash da cadeia SHA-256, data, aprovadores, página n/N). Evidências = entradas do ledger + aprovações de promoção — geradas, nunca digitadas.

## 6. Fase D — pack Healthcare

Degrau **305° violeta clínico** (`--btv-hc-*`). Assinatura de plugin (chanfro dourado 14 + tag small-caps 8px). Mapeamentos: `clinicalTask`→userTask, `clinicalDecision`→businessRuleTask, `guideline`→dataObjectReference, `pathwayGate`→exclusiveGateway — via `bpmnr:meta type`, export interoperável. **Validação visível:** clinical decision sem DMN vinculada = chip warning âmbar (`--btv-hc-warning-*`, "▲ sem tabela DMN vinculada") no mesmo slot do badge de vínculo.

## 7. Gramática visual da família (regras de coesão — adotar como política)

1. **Padrão OMG = geometria neutra** — forma canônica, sem chanfro/tag. Interoperabilidade visual com Camunda/bpmn.io.
2. **Plugin de domínio = assinatura BTV** — chanfro ouro 14px + tag 8px é o "carimbo de extensão"; corpo na cor do domínio.
3. **Uma família de notação = um degrau da roda** — DMN 185°; CMMN futuro reivindica 105° ou 65°. Diferenciação interna por forma.
4. **Um domínio de negócio = um degrau, por PR** — plugin declara `colorWheelDegree`; colisão = build warning. Livres: 65°, 105°.
5. **Ouro e verde reservados** — ouro = governança/valor; verde = aprovação/seleção. Nunca cor de corpo de domínio.
6. **Um gesto de navegação** — duplo-clique desce, breadcrumb com selo de vigência sobe: vale para subprocesso, DMN, pedigree e o que vier.

## 8. Restrições respeitadas (checklist p/ code review)

- SVG nativo, sem filtros novos além do `feDropShadow` existente; hachura via `pattern` (1 def/N usos); DRD com linhas retas (sem roteador novo).
- Cores só `var(--btv-…, #fallback)`; dark completo no CSS; export PNG seguro (font stack de sistema, `ui-monospace` para FEEL).
- Estados nunca só por cor (▲ em inválidas, hachura em fechados, cadeado em congelados, forma nos edges).
- Alvos ≥ 24px em toda a decision table; editor de tabela em DOM, fora do orçamento SVG.
- Tudo undoável via CommandStack; imutabilidade temporal preservada (fechar/suceder, nunca deletar).

## 9. Ordem sugerida das PRs

1. `feat(react): btv-dmn tokens` (css puro, sem risco)
2. `feat(core+react): businessRuleTask + callActivity` (Fase A, shapes + converter + fixtures)
3. `feat(react): subprocesso expandido + drill-down/breadcrumb` (o breadcrumb nasce aqui e o DMN o reusa)
4. `feat(dmn): pacote <scope>/dmn — modelo + decision table editor` (headless + React, DOM) — **escopo npm conforme decisão da pendência §1 de `pendencias.md`** (recomendação registrada: `@buildtovalue/*`); não publicar sem essa decisão
5. `feat(dmn): DRD no canvas + vínculo businessRuleTask ⇄ decision` (inspector + comandos + ledger)
6. `feat(react): estado "fechado" + faixa de pedigree` (Fase C.7)
7. `feat(cli): relatório SACM do certify` (Fase C.8)
8. `feat(domain-healthcare): pack demo` (Fase D)

## 10. Consolidação final (revisão do designer-manager, 08/07/2026)

### 10.1 Complementos hifi entregues
- `BTV BPM+ Estados e Interações.dc.html` — peek revisado (seleção, 2 regras, badge), inspector "Decisão" vazio + vinculado, estados do editor (tabela vazia, popover de header, popover de transbordo FEEL, drag de linha), **pedigree de edge** e teste de estresse da hachura.
- `Relatorio SACM Certify.dc.html` — relatório print-ready completo (saída do `certify --assurance-case`): claim → argument → evidence, tabela de evidências do ledger, veredito, aprovadores, rodapé de auditoria. Dashboard interativa = iteração futura.

### 10.2 Correções de domínio incorporadas
- **Pedigree é centrado em edge** (`supersedesEdgeId`/`getEdgeChain`): card 200×72 = miniatura origem → destino com o estilo REAL do edge (rewire visível). Pedigree de nó = caso derivado (mesma faixa, 1 forma). Onion-skin só como micro-preview no hover (máx. 2 versões).
- **Hachura em escala (5b mitigada, ADOTADA):** hachura + dessaturação sempre; selo pill (com hash) só em hover/seleção; banner fixo no canto sup. esq. do canvas: "🔒 VISUALIZANDO vX.Y · somente leitura · N elementos fechados nesta versão". Selo por elemento vira "confete" acima de ~8 fechados — rejeitado como default.
- **Popover de transbordo FEEL:** abre junto da edição inline apenas quando a expressão não cabe (célula com ellipsis); mesmo caret, mesmo commit — um único modelo de edição (3b permanece rejeitada).

### 10.3 Contrato de API do plugin (implicações p/ dev)
- `colorWheelDegree: number` entra em `PluginDefinition` (**minor**, retrocompatível); colisão entre plugins registrados = **warning de build**; teste em `apiSurface.test.ts`.
- Regra de lint de plugin: **ouro (`--btv-gold`) e verde (`--btv-green`) proibidos como cor de corpo de domínio** (reservados a governança/aprovação).
- Breadcrumb de governança promovido a **componente do sistema** (`GovernanceBreadcrumb`): cada nível = nome + semver + StatusBadge; serve subprocesso expandido (F7), DMN e futura CMMN. Par único de gestos: duplo-clique desce, breadcrumb/Esc sobe.

### 10.4 Matriz de estados por componente
| Componente | default | hover | selecionado | inválido/erro | fechado (versão antiga) | dark |
|---|---|---|---|---|---|---|
| businessRuleTask | tinta 1.5 + glifo tabela | fill --bpmnr-hover | verde 2.5 + halo + portas r4 | stroke --btv-error + badge "!" | hachura + dessat. | strokes clareados, badge gold dark |
| badge de vínculo DMN | pill ouro 30×16 (só com decisionRef) | cursor pointer + tooltip | herda seleção do nó | — (ausência = sem badge) | some (segue o nó) | --btv-dmn-link-* dark |
| callActivity | borda 3.5 + marcador + | fill hover | verde 2.5 + halo | CALL_REF_MISSING (vermelho + "!") | hachura + dessat. | idem |
| subProcess expandido | container + faixa título | título sublinhado (drill) | halo no container | filho inválido não propaga | hachura no container | idem |
| nós DRD | formas spec, degrau 185° | fill hover | verde 2.5 + portas | vermelho + badge | hachura + dessat. | tokens dmn dark |
| decision table (célula) | grid 1.5 | fundo row hover suave | célula outline verde / linha --btv-dmn-cell-selected | --btv-dmn-cell-invalid + borda 2 + ▲ + tooltip | tabela inteira read-only + banner | tokens table dark |
| peek | fechado | (desktop) antecipa | ABERTO na seleção | — | mostra selo da versão | fundo #2C2825 |
| pedigree card | op. .85 | hash do ledger | borda gold 2.5 (atual) | — | hachura + op. .75 | trilho/hachura dark |
| relatório SACM | claims sustentados | — (documento) | — | claim sem evidência = --btv-error + "não sustentado" | n/a (sempre de uma versão) | só light (papel impresso) |

### 10.5 Critérios de aceite (INVEST — testáveis)
1. **Peek:** abre em ≤1 frame após a seleção de um businessRuleTask com decisionRef; nenhum nó é inserido no SVG (`canvas.querySelectorAll` invariante); funciona por toque sem hover; Esc fecha.
2. **Vínculo:** vincular/desvincular/criar são 1 comando undoável cada (undo restaura o estado anterior em 1 passo) e geram 1 entrada de ledger cada; desvincular NUNCA deleta a tabela.
3. **Breadcrumb:** em qualquer profundidade (subprocesso, DMN), cada nível exibe semver + selo; clique em nível N leva a N com seleção preservada; o mesmo componente é usado nas duas superfícies (1 import).
4. **Decision table:** toda mutação passa pelo CommandStack (undo global mescla canvas+tabela em ordem cronológica); célula inválida tem indicador não-cromático (▲) verificável por snapshot; alvos de toque ≥24px medidos; tabela não-rascunho é read-only e "editar" propõe nova versão (supersede).
5. **DRD:** os 4 nós + 3 requirement edges exportam/importam DMN XML round-trip idêntico (normalizeForDiff); estilos só por `var(--btv-dmn-*, fallback)` — export PNG não taints.
6. **Fechado:** com 30+ elementos fechados, 60fps em pan/zoom (1 `<pattern>` def por SVG); nenhum selo renderizado sem hover/seleção; banner de versão presente sempre que `viewingVersion !== active`.
7. **Pedigree:** dado um `supersedesEdgeId`, a faixa renderiza a cadeia completa de `getEdgeChain` em ordem temporal; clique abre DiffView das duas versões adjacentes; snapshot do card usa as formas reais do plugin registrado.
8. **SACM:** relatório gerado 100% do ledger (nenhum campo de texto livre); claim sem evidência rende "não sustentado" em --btv-error; verificação da cadeia sha-256 roda na geração e o resultado consta no rodapé.
9. **Tokens:** `btv-dmn-tokens.css` aplicado sem nenhum breaking change (suite visual existente inalterada em light e dark).
10. **API:** `colorWheelDegree` publicado como minor com teste em `apiSurface.test.ts`; dois plugins no mesmo degrau disparam warning de build; lint de plugin rejeita ouro/verde como cor de corpo.

## 11. Aprovação final e notas de fechamento (08/07/2026)

**Spec APROVADA para implementação.** Quatro invariantes finais, vinculantes:

1. **Precedência do Esc (pilha de dismissal):** `Esc` sempre fecha o overlay mais alto primeiro, nesta ordem: popover (header/FEEL) → peek → seleção → subir um nível no breadcrumb. Só navega para cima quando não há overlay aberto nem seleção ativa. Implementar como pilha única de dismissal no host de interações — nunca listeners independentes por componente.
2. **Relatório SACM multipágina:** a tabela de evidências repete o header em cada quebra de página; evidências agrupadas por argument (A1, A2…) com subtotal por grupo; acima de 20 evidências por argument, colapsar em "N evidências · faixa de hashes #x…#y" com anexo completo ao final. Rodapé "página n/N" em todas as páginas.
3. **SACM sem dark mode (exceção declarada):** o relatório print-ready permanece na base papel (`#FAF9F6`/tinta) mesmo sob `prefers-color-scheme: dark` — exceção intencional à regra "dark obrigatório" (§4 do briefing). Documento de auditoria tem UMA aparência canônica. Não é bug.
4. **Versão da spec parametrizada:** a string "SACM x.y" do cabeçalho vem de configuração do gerador (confirmar versão vigente em omg.org/spec/SACM na implementação), nunca hardcoded. Vale também para "DMN 1.x" no inspector.

**Invariante do gerador (literal, para docs/):** *"Todo conteúdo do assurance case é derivado do ledger, nunca digitado."* Claims sem evidência renderizam em `--btv-error` com veredito "não sustentado".

### Mapeamento final de PRs (substitui a numeração do §9)
- **F-A** — reconciliação §3.0 (diff spec × main do subprocesso/callActivity) + businessRuleTask + badge de vínculo + `GovernanceBreadcrumb` (que F-B2 reusa)
- **F-B1** — tokens 185° + nós/edges DRD + converter DMN XML
- **F-B2** — editor de decision table + peek + inspector "Decisão" (2d) + pilha de Esc
- **F-C1** — elemento fechado (variante B) + banner de versão
- **F-C2** — faixa de pedigree de edge + plug do DiffView
- **F-C3** — `certify --assurance-case` (relatório SACM print-ready)
- **F-D** — plugin healthcare (degrau 305° + validação visível)

Cada PR atualiza `apiSurface.test.ts` (incl. o contrato `colorWheelDegree`). Dashboard interativa do assurance case: **adiada** — apresentação sobre os mesmos dados do ledger, não bloqueia F-C3.
