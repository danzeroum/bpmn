# Handoff: BuildToValue BPMN — bibliotecas + design system de notação

**Para:** desenvolvedor com Claude Code
**Repositório alvo:** `danzeroum/bpmn` (monorepo pnpm, TypeScript, zero runtime deps no core)
**Data:** julho 2026

---

## 1. Overview

Este pacote entrega duas coisas que devem ser implementadas **no repositório existente**, mantendo React e o regime de engenharia já praticado (PRs estratégicas, CI verde → merge):

1. **O design system de notação BuildToValue (`btv:`)** — tokens, shapes SVG, edges e ícones de paleta, especificados pixel a pixel na seção 5.
2. **O roadmap de conformidade OMG (F5a → F10)** — a sequência de bibliotecas/funcionalidades a desenvolver, com critérios de aceite, na seção 4.

## 2. Sobre os arquivos de design (`design-refs/`)

Os arquivos neste bundle são **referências de design criadas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar diretamente**. Exceções parciais:

- `btv-tokens.css` — **pronto para uso**: anexar a `packages/react/styles.css`. Zero breaking change (todo consumo usa fallback).
- `btv-shapes.tsx` — **ponto de partida real**: usa a API pública existente (`ShapeProps`, `ShapeLabel`, `theme` de `@bpmn-react/react`) e substitui `packages/domain-example/src/shapes.tsx`. Revisar, tipar contra o build atual e cobrir com os testes de fixture existentes antes do merge.
- `BTV Notation.dc.html` / `Roadmap OMG.dc.html` — folhas de especificação visual (podem não renderizar fora da ferramenta de design; toda a informação delas está duplicada neste README).

**Fidelidade: alta (hifi).** Cores, medidas, traços e geometria são finais — recriar fielmente.

## 3. Identidade BuildToValue (racional)

Numerologia de BUILDTOVALUE: destino 45→9, alma 27→9, expressão 18→9 (**9·9·9** = completude, entrega de valor). Cromoterapia do 9: **dourado** `#9A7B1E` (valor realizado) + **verde** `#1A6A54` (equilíbrio/aprovação), sobre a base de papel quente do editor (`--bpmnr-canvas-bg #FAF9F6`, tinta `#44403A`). Roda cromática dividida em 9 degraus de 40° — cada tipo do domínio ocupa um degrau.

**Assinatura visual dos shapes btv:** chanfro de valor dourado (14 px, traço 2.5) no canto superior direito dos cards; tag de tipo em small-caps 8 px letter-spacing 1.4; glifos desenhados no stroke do próprio tipo; traço 1.5 default / 2.5 selecionado.

## 4. Roadmap de implementação (bibliotecas)

Ordem de execução. Cada fase = 1–3 PRs gated em CI verde (build-test + e2e).

### F5a/5b · v1.0 (em curso)
- Lanes interativas: drag de nó para dentro/fora atualiza `properties.flowNodeRefs`, undoável, com highlight da lane alvo.
- `messageFlow` e `association` reais no `BpmnXmlConverter` (import/export/round-trip).
- Multi-pool: processos separados por participant + message flows entre eles.
- Endurecimento: StrictMode, stress ~350 nós, cleanup de listeners. Release: bump 1.0.0, CHANGELOG, política semver, workflow npm.
- **Aceite:** round-trip lossless com Camunda incluindo colaboração multi-pool.

### F6 · v1.1 — Eventos
- `eventDefinition`: message, timer, error, signal, escalation, conditional, link, terminate.
- Intermediate throw/catch (círculo duplo; throw = glifo preenchido).
- `boundaryEvent` interrupting e **non-interrupting** (borda tracejada) — maior valor por esforço; exige ancoragem à borda da activity (ver §6, roteador).
- `eventBasedGateway`; artefato `group` (retângulo tracejado não-semântico).
- Paleta com sub-menu de eventos.
- **Aceite:** diagramas Camunda com boundary/timer/message importam sem warnings.

### F7 · v1.2 — Atividades compostas
- `subProcess` aninhado (expand/collapse, drill-down no canvas, DI hierárquico).
- `callActivity` — sinergia com `@bpmn-react/registry`: referenciar diagrama versionado (`activeAt`).
- `sendTask` / `receiveTask` / `manualTask` (glifos novos na mesma `ActivityBox`).
- Marcadores loop / multi-instance na base da activity. `dataStore`, `dataAssociation`.
- **Aceite:** classe OMG **Descriptive 100%**.

### F8 · v1.3 — Conformidade formal
- Validação XSD **opcional** contra o schema oficial (CLI/Node apenas — pesado demais no browser; browser mantém validação estrutural XXE-safe).
- Corpus de interoperabilidade: ≥ 50 arquivos externos (Camunda, bpmn.io, Signavio) como fixtures de round-trip.
- `CONFORMANCE.md` gerado por script a partir dos testes; declarar classe **Analytic** no README.

### F9 · v2.0 — DMN (novo pacote `@bpmn-react/dmn`)
- `businessRuleTask` + decision table DMN 1.x: editor de tabela, import/export DMN XML, link bidirecional gateway ↔ decisão.
- Mesma filosofia do perfil MVP: perfil documentado, warnings em import. Limitar a decision table + DRD mínimo.

### F10 · v2.x — VDML/BMM
- Mapeamento do domínio btv via `extensionElements` (sem novo editor): deliverable → value proposition (VDML), gate → governance decision, squad → org unit; anotações BMM (goal/means) ligadas ao ledger.

**Fora de escopo deliberado:** Conversation/Choreography diagrams, complexGateway (import degrada com warning), CMMN, ioSpecification/Common Executable, transaction/compensation e eventSubProcess antes de v2.x.

## 5. Especificação do design (recriar fielmente)

### 5.1 Tokens (`btv-tokens.css` — pronto)

Light: gold `#9A7B1E` (soft `#F6EDD4`) · green `#1A6A54` · squad `#E8ECF7`/`#5566A6` (índigo 265°) · persona `#FBF1DC`/`#B08A47` + avatar `#F0DFB8` (âmbar 85°) · gate pending `#F6EDD4`/`#9A7B1E`, approved `#DFF0E6`/`#1A6A54` · prompt `#F5E9F0`/`#9A5580` (ameixa 345°) · connector `#E3EEF6`/`#2F6E94` (azul 225°) · deliverable `#E3EFE4`/`#3B7D4F` (verde 145°) · edges: handoff `#44403A`, approval `#1A6A54`, feedback `#9A5580`, escalation `#B3372F` · error `#B3372F`. Dark: ver arquivo (fills ~L0.28, strokes clareados; gold dark `#CBA84B`).

### 5.2 Shapes do domínio (medidas default)

| Shape | Tamanho | Geometria | Mapeia p/ BPMN |
|---|---|---|---|
| Squad | 180×100 | card rx 12, chanfro 14 no canto sup. dir. + linha dourada 2.5, glifo de time (2 cabeças), tag SQUAD | `subProcess` |
| Persona | 150×56 | pílula (rx = h/2), avatar disc r 20 com glifo de pessoa, nome 12/600 + role 10 muted | `userTask` |
| Approval Gate | 72×56 | hexágono (pontos 25%/75% e meios), círculo r 11 central; pendente = 2 barras (pausa), aprovado = check; label externo abaixo | `inclusiveGateway` |
| Prompt | 130×64 | nota com dobra de papel 16 no canto sup. dir. (a dobra é o "chanfro" do tipo), 2 hairlines de texto op. 0.5, tag PROMPT | `scriptTask` |
| Connector | 130×60 | card rx 10 com borda **tracejada 6/3** (fronteira externa), glifo de plugue, tag CONNECTOR | `serviceTask` |
| Deliverable | 120×70 | flâmula (base em V a 72% da altura) + filete interno offset 5 op. 0.35 | `endEvent` |

### 5.3 Estados
- **Selecionado:** stroke `--bpmnr-selected` 2.5 + portas r 4 (fill branco, stroke selected 1.5) nos 4 pontos médios.
- **Erro de validação:** stroke `--btv-error` 2 + badge circular r 9 preenchido no canto do chanfro com "!" branco; código do erro em mono 9 px abaixo do shape.
- **Gate congelado** (`approved=true`): badge de cadeado r 8 fora do vértice direito; novas conexões bloqueadas — rewire só via supersede (regra `edge.connect.pre` já existe no plugin).

### 5.4 Edges do domínio
- `handoff` — sólido 1.5 tinta, seta cheia; **chip de purpose obrigatório** (pill `#F6EDD4`, borda gold 1, texto mono 8.5 `#7A611E`) sobre o segmento médio.
- `approval` — sólido 2 verde, seta cheia, disco-check r 8 no ponto médio.
- `feedback` — tracejado 5/4 ameixa, seta aberta (duas linhas).
- `escalation` — sólido 1.5 vermelho, chevron duplo na ponta.

### 5.5 Paleta
Substituir emojis por ícones de linha: grade 20 px, traço 1.5, cor `--bpmnr-text` (core) ou stroke do tipo (btv). Os 16 desenhos estão na seção 07 da folha `BTV Notation.dc.html`. Requer ampliar `PaletteItem.icon` para `string | ReactNode` em `packages/react/src/plugins/types.ts` (mudança retrocompatível).

### 5.6 Core BPMN
Geometria core permanece neutra ao padrão OMG — **não** aplicar chanfro/tags. A identidade vive só nas fills tonais `--bpmnr-fill-*` já existentes.

## 6. Orientação de arquitetura React + código limpo

Princípios já estabelecidos no repo — manter:

1. **Shapes são funções puras** `(props: ShapeProps) => JSX`: sem estado, sem hooks, sem side effects. Todo dado vem de `node` (`width/height/label/properties`) e `selected`. Interação complexa (drag, connect, boundary anchoring) vive nos hooks do canvas (`useInteractions`), nunca no shape.
2. **Cores só via CSS vars com fallback** (`var(--btv-x, #hex)`) — nunca hex solto no JSX. Dark mode sai de graça; o fallback mantém o SVG correto em export/PNG.
3. **Domínio via plugin declarativo**, não fork: `nodeTypes` + `shapes` + `paletteItems` + `validationRules` + `registerRules`. Novos elementos core (F6/F7) entram como `NodeTypeDefinition` no core com `xml.tag`, shape no react, e mapeamento no converter — três camadas, três PRs pequenas se preciso.
4. **Composição sobre condição:** extrair primitivas compartilhadas (o repo já tem `ActivityBox`, `ShapeLabel`, `strokeFor`; adicionar `ChamferedCard`, `EventCircle(defGlyph)`, `GatewayDiamond(marker)`) em vez de shapes gigantes com if/else. Um glifo por componente pequeno.
5. **Boundary events (F6):** modelar como nó com `attachedToRef` + posição relativa à borda (parâmetro t ∈ [0,1] por lado, não coordenadas absolutas) para sobreviver a resize/drag da activity. Saídas de edge usam port-offset no roteador ortogonal existente (solução barata documentada em `pendencias.md`); roteador A* com desvio de obstáculos é PR isolada posterior com orçamento de performance.
6. **Temporal immutability é sagrada:** nunca deletar/editar edges versionadas — fechar (`removedInVersion`) e suceder (`supersedesEdgeId`). Toda feature nova (lanes interativas, boundary, DMN link) passa pelo command bus + ledger, nunca mutação direta.
7. **Testes por fixture:** cada elemento novo = fixture XML de export + round-trip normalizado (diff idêntico) + import externo (arquivo Camunda real) + teste de shape (render + z-order). Piso de cobertura no CI não regride.
8. **Performance:** virtualização do canvas antes/junto da F7 (subprocessos multiplicam elementos). `React.memo` nos shapes com comparador raso de `node`; evitar re-render em pan/zoom (transform no `<g>` raiz, não nos nós).
9. **Zero deps no core** permanece lei. DMN (F9) nasce como pacote irmão com o mesmo contrato (headless, pure TS, React layer separada).

## 7. Arquivos

- `design-refs/btv-tokens.css` — tokens light+dark (pronto para colar).
- `design-refs/btv-shapes.tsx` — shapes redesenhados, mesma API do plugin (ponto de partida).
- `design-refs/BTV Notation.dc.html` — folha de notação: shapes, estados, dark, core, edges, ícones (fonte visual da verdade).
- `design-refs/Roadmap OMG.dc.html` — roadmap + matriz de conformidade elemento a elemento.

## 8. Ordem sugerida das primeiras PRs

1. `feat(react): btv tokens + PaletteItem icon ReactNode` (css + type widening, sem risco)
2. `feat(domain-example): shapes BuildToValue` (btv-shapes.tsx tipado + fixtures atualizadas)
3. `feat(react): edge styles por tipo de domínio no EdgeRenderer` (BTV_EDGE_STYLES)
4. Continuar F5a conforme seção 4.
