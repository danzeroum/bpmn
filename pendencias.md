# Pendências — decisões que deixei para você analisar

Documento vivo com os pontos onde parei por serem **decisões de produto/arquitetura** (não
apenas execução) ou por dependerem de credenciais/ações fora do repositório. Nada aqui bloqueia
o que já foi entregue.

Última atualização: design system de notação BuildToValue (PRs 1–3 do handoff).

---

## 1. Publicação no npm (ação sua, obrigatória para fechar a v1.0)

**Escopo DECIDIDO e rename EXECUTADO (10/07/2026):** a organização `@buildtovalue` foi criada e
testada no npm pelo dono; o rename global `@bpmn-react/*` → `@buildtovalue/*` foi aplicado ao
monorepo inteiro em PR dedicada (nomes de pacote, dependências de workspace, imports, docs,
CONFORMANCE, lockfile regenerado). Os flags `"private": true` provisórios foram removidos — agora
só `example`, `domain-example` e `healthcare` permanecem privados (apps/demos, fora do release);
todo o resto entra no `pnpm -r publish` do `release.yml`. Pacotes novos (`sfeel`, `copilot` do
Handoff 9) já nascem `@buildtovalue/*`.

**O que ainda depende de você para o primeiro publish (I-6 do Handoff 8):**

1. **Adicionar o secret `NPM_TOKEN`** no GitHub (Settings → Secrets → Actions) com um token de
   automação do npm (ou configurar OIDC/provenance). O workflow `release.yml` roda em
   `workflow_dispatch` com `dry_run=true` por padrão — dá para validar tudo sem publicar;
   desmarque o dry-run quando quiser soltar.

Notas de fronteira do rename: o namespace XML de extensão **`bpmnr:`** e os prefixos CSS
**`bpmnr-`**/**`btv-`** NÃO mudam (mudá-los quebraria o round-trip de arquivos já exportados e o
theming de hosts); o binário da CLI segue **`bpmn-react`** (`bpmn-react certify` etc.) — renomear o
comando é decisão de produto separada, sem urgência.

## 1.1 Handoff 6 — "política" sem node type correspondente (decisão de produto)

O Handoff 6 S-2 pede um adapter de **política** para a Biblioteca, mas nenhum pacote de domínio
define um node type "política" hoje. O `policyAdapter` mapeia para o conceito mais próximo — o
Approval Gate (`btv:gate`) do domain-example — e a classificação aceita override explícito via
`diagram.metadata.artifactType: 'política'`. Se "política" deve ser um tipo próprio (com shape,
validação e vocabulário), é uma extensão de domínio a especificar; o adapter atual troca de
predicado em uma linha quando isso existir.

## 1.2 Handoff 6 — deep-link do "Abrir no Designer" (decisão de produto)

O Studio está entregue (S-1…S-6) e "Abrir no Designer" abre o editor real; **voltar** restaura
filtros e seleção da Biblioteca via URL (§10.7 ✅). O que ficou aberto: o Designer do `example`
não tem API de carregamento por `versionId`/`artifactId` via URL, então o deep-link abre o
editor com o diagrama demo padrão, não a versão exata do artefato clicado. Dar essa API ao host
(ex.: `?load=<versionId>` resolvendo no registry, com modo leitura para versões fechadas) é uma
extensão do Designer, fora do escopo do Handoff 6 — o descritor da ação já carrega
`artifactId`/`versionId`/`nodeId`, então o host só precisa resolvê-los quando essa API existir.

## 2. Roteador de arestas com desvio de obstáculos (mantido pós-1.0)

**Atualização (Handoff 7 — PR 0 ✅):** a variante barata ("offset nas portas na origem/destino")
foi implementada em `routeOrthogonal` (`packages/core/src/geometry/index.ts`, const
`DEFAULT_PORT_OFFSET = 16`): a rota ganha um "toco" perpendicular garantido saindo da origem e
entrando no destino antes de dobrar, então a aresta — e o token animado que a percorre no
Handoff 7 — deixa/entra o nó perpendicular, limpando o corpo e o canto arredondado r8 em vez de
raspar a borda. Rotas retas continuam colapsando (inalteradas); o offset é clampeado a metade da
distância âncora-a-âncora para não passar do nó vizinho em layouts apertados. Testes de
invariante em `geometry.test.ts`.

O **roteador A\* completo continua fora, de propósito** (esta era a parte cara). Um roteador
correto (visibility graph + A\*, ancoragem estável, recálculo incremental durante drag) é um
subsistema com orçamento de performance próprio; um meia-boca degradaria a UX atual. O core já
registra routers plugáveis, então dá para entregar como minor release (`1.x`) sem quebrar nada.

## 3. Multi-pool / colaboração real (decisão de escopo de produto)

O perfil v1 é single-process: N pools exportam como N participants apontando para o **mesmo**
processo, e `messageFlow` cruza raias visualmente dentro dele. Colaboração de verdade (um
processo por pool, message flows entre processos separados) é outro modelo de dados. Precisa de
caso de uso concreto antes de investir.

## 4. Comportamento de swimlane "completo" (pós-1.0)

Entregue na Fase 5a: soltar um nó dentro de uma lane atualiza a membership (undoável, com
highlight do alvo), refs velhas são filtradas no export e apontadas pela regra
`STALE_LANE_REF`. Ficaram para uma fase "swimlane layout" pós-1.0, se você quiser:

- Arrastar a lane/pool levando os nós internos junto.
- Redimensionar uma lane empurrando/reflowando as lanes irmãs.

## 5. Design system BuildToValue — follow-ups das PRs 1–3

As três primeiras PRs do handoff (`docs/design_handoff_btv_bpmn/`) entregaram: tokens `--btv-*`
(light+dark) em `packages/react/styles.css`; os 6 shapes na notação BTV (chanfro dourado, tags,
glifos) + ícones de paleta ReactNode; e estilos de aresta por tipo de domínio no `EdgeRenderer`
(campo declarativo `edgeStyles` no `BpmnPlugin`, sem `btv:*` hardcoded no react). Ficou de fora,
de propósito:

- **Estados de shape §5.3** (badge de erro de validação com código; cadeado de gate congelado
  fora do vértice direito). São overlays de canvas — vivem no `NodeRenderer`/`overlays.tsx`, não
  nos shapes puros (princípio §6.1), então são uma PR de canvas separada. O sinal de erro já
  existe de forma textual na validação; falta a camada visual sobre o nó.
- ~~**Ícones de linha da paleta core** (§5.5)~~ → entregue na PR do craft pack
  (`paletteIcons.tsx`, 18px stroke 1.5 `currentColor`).
- **Regra de rotulação das tags (documentar):** só os *cards* levam a tag small-caps
  (SQUAD/PROMPT/CONNECTOR); formas geométricas auto-identificáveis (Persona pílula, Gate hexágono,
  Deliverable flâmula) não. Está comentado no topo de `shapes.tsx`; convém elevar ao handoff/futuro
  `CONFORMANCE.md` para o próximo shape não quebrar a consistência de arquitetura de informação.
- ~~**Agrupamento da paleta** (Core / BuildToValue) com cabeçalhos~~ → entregue na PR do craft
  pack: `PaletteGroup` declarativo no plugin (`paletteGroups`), grupos Core BPMN / Events (badge
  F6) / BuildToValue, itens sem grupo continuam em lista plana (retrocompatível). Nota de idioma:
  os cabeçalhos core seguem o padrão EN da UI da biblioteca ("Core BPMN"/"Events"); o protótipo
  usa PT ("EVENTOS"). i18n da UI core é decisão de produto em aberto — a camada de aplicação pode
  registrar grupos com labels PT por cima se preferir.
- **Export XES do ledger** — ✅ ENTREGUE (PR-B2, Handoff 4 §B2): `toXES(ledger, { registry })`
  no `@buildtovalue/audit` + `bpmn-react export-xes` no CLI. Cada versão = trace; comandos,
  promoções, attestations, registros e publicações = events com concept/time/org/lifecycle.
  Habilita *process mining* do "processo real de design" vs. o documentado (ProM, Celonis,
  Disco) — diferencial que ferramentas de modelagem puras não têm. Sinergia futura: os
  critérios de aprovação do Gate btv são candidatos naturais a decision table quando a F9
  (DMN) chegar.

## 6. Boundary events — interação de anexação — FECHADO (Handoff 11 N-1)

Entregue na N-1: **anexar por drag-and-drop** (zona de snap 12px com highlight da borda; soltar =
UM comando atômico que grava `attachedToRef` + ancoragem paramétrica), **deslizar na borda**
(re-attach com novo `t`), **desanexar arrastando para fora** (vira `intermediateCatchEvent`, um
comando) e **reflow no resize do host** (`t` preservado dentro do MESMO comando do resize).
Decisão de modelo (corrige o texto do handoff 11, que supunha o paramétrico já existente): `side +
t` são estado **editor-only** em `properties.boundarySide`/`boundaryT` — nunca serializados; o XML
continua DI absoluto padrão e o import re-deriva o par da geometria (`boundaryAnchorOf`).
Evidência: `packages/core/tests/boundary.test.ts`, `packages/react/tests/boundaryAttach.test.tsx`,
`packages/example/e2e/boundary.spec.ts`. O roteamento das saídas do boundary segue no item 2.

## 7. Status do roadmap OMG (onde parei)

Progresso desta rodada autônoma (todas as PRs com CI verde → merge):

- **Design system BuildToValue** — PRs 1–3 entregues (tokens, shapes+ícones, edge styles).
- **F6 · Eventos (v1.1) — COMPLETO:**
  - Typed event definitions (message/timer/error/signal/escalation/conditional/link/terminate) em
    start/end/intermediate, com round-trip via `<bpmn:*EventDefinition>`.
  - Intermediate catch/throw (anel duplo; throw = glifo preenchido).
  - Boundary events interrupting + non-interrupting (`attachedToRef`/`cancelActivity`, ride-along no
    drag do host).
  - `eventBasedGateway` + artefato `group`.
- **F7 · Atividades compostas (v1.2) — PARCIAL:**
  - Entregue: `sendTask`/`receiveTask`/`manualTask` + marcadores de loop/multi-instância
    (round-trip via `loopCharacteristics`).
  - **Falta (canvas-pesado, próximas PRs):** `subProcess` aninhado (expand/collapse, drill-down no
    canvas, DI hierárquico), `callActivity` (sinergia com `@buildtovalue/registry` `activeAt`),
    `dataStore` + `dataAssociation`. Meta: classe OMG **Descriptive 100%**.

### Ainda no roadmap (F8→F10, intocado)
- **F8** validação XSD opcional (CLI/Node), corpus de interop ≥50 arquivos externos, `CONFORMANCE.md`
  gerado, declarar classe **Analytic**.
- **F9** DMN — novo pacote `@buildtovalue/dmn` (decision table + DRD mínimo).
- **F10** VDML/BMM via `extensionElements`.

### Polimento pendente da F6
- ~~Sub-menu de eventos na paleta~~ → entregue na PR do craft pack: grupo "Events" (badge F6)
  com catch/throw/timer/message/boundary NI/event gateway.
- Boundary: drag-to-attach e reflow por `t` no resize (seção 6).

### Nota
Foram enviados protótipos de design em `docs/design_handoff_btv_prototypes/` (screenshots) durante a
sessão. Em incorporação: craft pack (PR4) → selo de vigência (PR5) → fluxo de promoção (PR6),
antes de retomar a F7 (subProcess) em sessão dedicada.

## 8.1 Trust Layer (Handoff 4) — decisões registradas

- **XSD vs manifesto (PR-A2):** implementado o **manifesto estrutural** (opção B do handoff):
  `STRUCTURAL_MANIFEST` em `packages/conformance/src/manifest.ts` é um digest hand-derived do
  BPMN20.xsd/Semantic.xsd (atributos obrigatórios + pais legais por elemento do perfil), zero
  deps. Um validador XSD completo continua possível como evolução (os XSDs da OMG são
  redistribuíveis), mas o custo não se justificou frente ao ganho — o manifesto pega os erros
  estruturais que quebram interoperabilidade (flow sem endpoints, boundary sem attachedToRef,
  lane fora de laneSet). Se a validação XSD integral virar requisito (ex.: certificação formal
  OMG), tratar como PR própria.
- **Corpus — TAREFA ABERTA (coleta de exports genuínos):** proporção atual **0 reais / 51
  gerados** (equivalentes estruturais via `gen-corpus.mjs`, como o handoff permite). Validado
  com a ressalva de que reais < 20 ⇒ coletar **≥ 20 arquivos externos genuínos** com licença
  clara: `bpmn-io/bpmn-js-examples` (MIT), quick-starts Camunda (Apache-2.0), arquivos
  machine-readable anexos à spec OMG BPMN 2.0. Cada arquivo entra com header de
  origem/URL/licença, no `corpus.test.ts` e no snapshot de warnings; onde houver original
  genuíno do mesmo padrão, ele substitui o equivalente gerado.

- **Soundness — heurísticas estruturais (PR-C1):** `SND_DEADLOCK_JOIN` usa o *split mais
  próximo* por ramo de entrada do AND-join (backward BFS até o primeiro nó com 2+ saídas) em
  vez de análise de dominância completa; `SND_UNMATCHED_SPLIT` procura qualquer join do mesmo
  tipo alcançável a jusante. Ambas O(V+E), conforme o §3 do handoff (sem state space). Casos
  patológicos de gateways aninhados podem escapar da heurística — se um falso negativo real
  aparecer no uso, promover a análise de dominadores (ainda O(V+E) com Lengauer-Tarjan) em PR
  própria.

## 8.0 Handoff 5 (BPM+) — reconciliação §3.0: divergências mantidas (aprovadas 08/07)

- **Tamanho dos cards de activity (spec 150×70 × main 120×60):** mantido 120×60 — TODA a
  família activity da main (task, userTask, …) usa 120×60; mudar só businessRuleTask e
  callActivity quebraria a consistência interna. Proporções internas da spec preservadas
  (glifo, badge, marcador). Aprovado: "consistência de família vence".
- **Coordenadas dos filhos do subprocesso (spec relativas × main absolutas):** mantidas
  absolutas — o BPMN DI da OMG usa bounds absolutos; o round-trip lossless com
  Camunda/bpmn.io depende disso. Resultado visual idêntico. Aprovado: "a spec estava errada".
- **Bounds de colapso (spec força card 150×70 × main preserva o DI):** mantido o tamanho
  armazenado — forçar o card visual divergiria do DI exportado (Camunda também preserva o
  bounds colapsado). A transição de 160ms anima o fill (o que de fato muda), não a geometria.
- **Conflito de gesto no subprocesso expandido:** duplo-clique no TÍTULO (faixa 30px) =
  drill-down (§7.6); duplo-clique no CORPO = rename inline; campo Label no inspector
  garante descobribilidade. Coberto por e2e.

## 8.0.1 Handoff 5 F-B2 — decisões de escopo (editor de decision table)

- **Reordenação de regras por arrasto (spec §4.2 "arrasto reordena"):** implementada como
  botões ↑/↓ no menu contextual da regra (junto de duplicar/remover). Drag-and-drop de
  linhas HTML exige ghost row + auto-scroll + a11y própria — custo alto para o mesmo
  resultado; os botões cumprem o aceite (mutação = 1 comando no stack). Elevar para drag
  é polimento incremental se aprovado.
- **XML nativo `<decisionTable>` no export DMN:** a tabela hoje round-tripa como JSON na
  extensão `bpmnr:property` (byte-stável, coberto por teste). Serializar para o elemento
  canônico `dmn:decisionTable` (inputs/outputs/rules como XML) é o próximo passo de
  interoperabilidade com Camunda/Trisotech — mudança contida no `DmnXmlConverter`,
  registrada aqui em vez de decidida.
- **Popover de transbordo FEEL (folha de estados):** expressões longas hoje ficam na célula
  (o inline input rola horizontalmente). O popover dedicado de transbordo da folha hifi
  fica para quando houver telemetria de células longas reais.
- **Botão "Promover…" na superfície da tabela:** o `DecisionTableEditor` expõe `onPromote`
  (mesmo modal do Designer, §4.2); o demo DRD usa o LifecyclePanel ao lado em vez de abrir
  o modal de dentro da tabela — escolha de wiring do host, não do componente.

## 8.0.2 Handoff 5 F-C1 — interpretações registradas (elemento fechado + banner)

- **"viewingVersion !== active" (aceite 10.5.6):** o modelo não tem um conceito separado de
  "versão em visualização" — o banner aparece quando a superfície NÃO é a linha ativa editável:
  view somente-leitura (`BpmnViewer`/host) ou versão superseded (`deprecated`/`retired`).
  Draft/test/candidate/active em edição não exibem banner (o StatusBadge já dá o selo).
  Se o produto ganhar um "view snapshot vN" explícito, o banner já cobre (host carrega o
  snapshot em viewer).
- **Semver no selo "FECHADO vX.Y":** `removedInVersion` guarda o ID da versão e o diagrama não
  carrega um mapa id→semver do histórico. Quando o fechamento é da versão carregada, o selo usa
  o semver dela; caso contrário cai para `FECHADO #<id7>` (mono, estilo hash — a 5b mitigada
  prevê hash no pill). Um resolver de host (`versionLabels`) é aditivo se a fidelidade total
  for exigida.
- **Hachura sobre bounding box (rx10), não sobre o outline do shape:** shapes de plugin são
  arbitrários; recortar a hachura pelo path exigiria clipPath por nó (N defs — contra o
  orçamento "1 def/N usos"). O wash + hachura em card arredondado é o visual da folha de
  estresse.

## 8.0.3 Handoff 5 F-C2 — decisões de escopo (faixa de pedigree)

- **"hover = hash do ledger":** a faixa não consulta storage de governança (mesma regra do
  VersionTimeline) — o host injeta `ledgerHash(edge)` e o hash aparece no tooltip do card.
  O demo não injeta (a cadeia do sample é estática, sem entradas correspondentes no ledger
  da sessão); coberto por teste com resolver stub.
- **Rótulo do card:** label/purpose da edge + tag de versão (`vX.Y` quando criada na versão
  carregada; `#id7` caso contrário — mesmo fallback do selo FECHADO, §8.0.2).
- **Card raiz não clicável:** DiffView é sempre do par adjacente; a primeira versão não tem
  predecessor. Alternativa (diff contra vazio) rejeitada — renderizaria um "add" enganoso.

## 8.0.4 Handoff 5 F-C3 — interpretações registradas (relatório SACM)

- **"página n/N" (§11.2):** o gerador emite o padrão CSS Paged Media
  (`@page { @bottom-right: "página " counter(page)/counter(pages) }`) + o rodapé de auditoria
  em `position: fixed` (imprime em toda página no Chromium). Margin boxes com contadores são
  honrados por engines de paged media (Prince/WeasyPrint/pipelines de PDF); o print preview do
  Chromium ainda não os suporta — limitação do engine, não do documento. Se o produto exigir
  n/N visível no Chromium, a alternativa é paginação explícita no gerador (mudança contida).
- **Taxonomia canônica de claims:** C1 "aprovação formal" (arg A1 = aprovações + entradas de
  promoção) e C2 "conteúdo rastreável a comandos" (arg A2 = demais entradas da cadeia). É a
  menor taxonomia 100% derivável do ledger; novas famílias de claim (ex.: soundness no gate)
  são aditivas quando o produto pedir.
- **SACM 2.3 confirmado** em omg.org/spec/SACM (formal, out/2023) na implementação, como o
  §11.4 pede; o rótulo segue parametrizado (`SACM_SPEC_VERSION` / `--sacm-version`).

## 8. Protótipos (Handoff 3) — decisões de escopo em aberto

- **Handoff 2 recebido e reconciliado** (chegou via mensagem após as PRs 4–6; a pasta
  `docs/design_handoff_btv_craft_governance/` segue fora do repo — subir quando conveniente).
  Divergências resolvidas a favor do **Handoff 3 + protótipos (mais novos, hifi)**: halo de seleção
  stroke 2/opacity 0.35 (H2 §A2 pedia 1/0.3); sombra flood-opacity 0.10 (H2 §A3 pedia 0.08);
  labels do selo em CAPS da tabela canônica (H2 §B1 pedia title-case). Divergência resolvida a
  favor do **core como autoridade**: change_summary mínimo de 20 chars do `LifecycleEngine`
  (H2 §B2 pedia textarea min 10 — se 10 for o desejado, é um `lifecycleConfig`, não UI).
  Itens do H2 pendentes de decisão de produto: **promoção como comando no command bus** (hoje a
  promoção usa `replaceDiagram` + entrada explícita no ledger, como o painel demo sempre fez; um
  `PROMOTE_VERSION` command no core deixaria o ledger gravar sozinho — mudança de core, registrar
  aqui em vez de decidir); **chip de canal reutilizando `.bpmnr-timeline-channel`** no selo (hoje o
  canal aparece na linha de meta — visual do protótipo).
- **Glifo de supersede no diff:** o protótipo do modal de promoção usa `⤳`; o `DiffView` existente
  usa `⇄`. Mantido o `⇄` do componente (o handoff §4 manda usar "as cores do DiffView existente";
  trocar o glifo é decisão de design de 1 linha se preferir fidelidade total).
- **Hover de nó no canvas:** o craft pack aplica hover 120ms no chrome (paleta/toolbar/timeline).
  Hover visual em nós SVG exigiria estado por nó (re-render em mousemove com 350 nós) ou filtro CSS
  caro — fora do aceite §8.5; incluir só se o custo/benefício for aprovado.
- **NFR 60fps@350:** o e2e `perf.spec.ts` mede FPS real (pan+zoom, 350 nós) e imprime o valor.
  Medições em software rendering (sem GPU): ~41fps em container dedicado, ~26fps no runner
  compartilhado do GitHub — por isso o piso no CI é 15fps, um canário de regressão (um re-render
  por frame de 350 nós cai abaixo de 10fps), não o NFR. O alvo de 60fps vale para hardware real:
  rodar `pnpm --filter @buildtovalue/example dev` + `/?stress=350` numa máquina local com GPU para a
  verificação final; o gate de zoom desliga sombras (<50%) e chips (<60%) para proteger a taxa em
  diagramas densos.

## 9. Handoff 7 (Simulação & Inteligência) — decisões registradas

**Escopo dos pacotes novos (decisão sua, 08/07):** o rename para `@buildtovalue/*` **ainda não foi
executado** — todos os pacotes seguem `@buildtovalue/*`. Decidido manter a convenção da §1: os pacotes
novos do Handoff 7 (`<scope>/simulation`, e depois `<scope>/replay`) entram como `@buildtovalue/<x>` +
`"private": true` (workspace-only, isentos do release), sem rename agora. O rename vira uma PR única
quando o escopo npm for confirmado. Recomendação continua `@buildtovalue/*`.

**Cobertura de caminhos = mesma análise do soundness, por duplicação testada (aceite §7.2).** Como
`@buildtovalue/simulation` só pode depender de `core` (cerca §2 de desacoplamento) e a construção do
grafo de fluxo vive em `@buildtovalue/soundness`, a classificação flow-node/flow-edge foi **duplicada**
em `packages/simulation/src/graph.ts` e **pinada como idêntica** ao `buildScopeGraphs` do soundness
em `tests/soundnessAgreement.test.ts` (mesmos nós + mesma adjacência de sequence flow, em 7 fixtures).
Se um dia essa análise for promovida para `core`, os dois pacotes passam a importá-la de lá e a
duplicação some — mas isso é refactor do soundness, fora do 7A-1.

**OR-join exato / semântica inclusive completa — demanda adiada (cerca §0.1).** A v1 executa OR de
forma aproximada (documentado em `limitations.md`: split multi-seleção manual, join dispara quando
nenhum outro token vivo alcança o merge). Semântica inclusive exata (análise global de merge) fica
FORA; registrar aqui se houver demanda concreta de um caso real que a aproximação erre.

**Alignments ótimos (7B, cerca §0.2) — adiado, confirmado no 7B-1.** `@buildtovalue/replay` entrega
**token-replay fitness apenas** (`fitness = fit moves / total moves`, caso conformante = zero
desvios). Alignments A\* sobre modelo×log (custo ótimo de alinhamento) ficam FORA, de propósito —
é um subsistema de process mining com orçamento próprio. Registrar aqui se surgir demanda concreta
onde a fitness de frequência engane (ex.: log muito ruidoso onde o alinhamento ótimo daria um
diagnóstico materialmente diferente). Documentado em `limitations.md`.

**Replay ⇄ governança (7B-3) — run-store é do host.** `bindRun` (registry) é uma *factory* de
valor imutável (`RunBinding`), não um armazém: o registry não guarda runs nem tem query
"runs-por-versão". O host injeta esse armazenamento — no demo, uma lista de execuções por versão
alimenta o seletor de versão ("N execuções presas à vX") e filtra o log. A análise comparativa
(gargalo real vs. o que a candidata muda) é anexada ao pedido de promoção como **entrada no ledger**
(`REPLAY_ANALYSIS_ATTACHED`, adapter `replayAnalysisEntry` em adapters-bpmn) e relida na Revisão do
Aprovador via `latestReplayAnalysis` — tudo por injeção, degradável (sem análise → sem bloco). O
pacote `replay` continua sem importar audit/registry.

## 10. Handoff 8 (Identidade, Assinatura & Âncora) — decisões registradas

**Escopo do pacote novo (I-1).** `@buildtovalue/identity` entrou como `@buildtovalue/<x>` + `"private":
true` (workspace-only, isento do release), **não** `@buildtovalue/identity` como o handoff §3 escreve.
Segue a decisão do §1/§9: o rename `@buildtovalue/*` continua diferido para uma PR única quando o
escopo npm for confirmado (I-6, com provenance OIDC). Recomendação continua `@buildtovalue/*`.

**WebCrypto Ed25519 — caveat de runtime do host.** A verificação usa WebCrypto Ed25519, estável no
Node ≥ 20 e em navegadores recentes (Chrome 137+, Safari 17+). Navegadores mais antigos precisam de um
verificador provido pelo host — a lib nunca embute criptografia própria (cerca §9). Documentado em
`docs/limitations.md`. Se um alvo corporativo exigir navegador legado, o host injeta um verificador
Ed25519 (mesmo padrão de injeção do Signer); nenhuma mudança na `identity`.

**I-2 — assinatura na UI (decisões de escopo, 09/07).**
- **`SignedApproval` persiste no `details` do ledger** (`APPROVAL_RECORDED`), **não** em
  `core.ApprovalRecord`. Evita mudança de core; a assinatura entra na hash-chain (tamper-evident) e
  viaja pelo `onDecided`. Promover a um campo próprio de `ApprovalRecord` fica para quando/se o core
  ganhar o seam de assinatura em `LifecycleEngine.approve`.
- **Badges no Ledger Explorer (§4.1) adiados** para a mesma PR que estende "Verificar cadeia" a
  assinaturas (I-5): ambos precisam do mesmo resolver de chave pública + re-verificação assíncrona no
  explorer. Na I-2, os badges vivem nas duas superfícies de aprovação (PromotionPanel + ReviewScreen).
- **Estado `invalid` no e2e adiado** junto com o item acima (não há, na I-2, superfície in-app que
  exiba uma assinatura *gravada* que falhe a verificação — só a recém-assinada, válida por
  construção). O caminho `invalid` é coberto em teste de componente
  (`packages/react/tests/promotionPanel.test.tsx`, assinatura adulterada → `✕ ASSINATURA INVÁLIDA`).
- **Badges no SACM (§4.1)** são I-5 (SACM assinado).

**I-3 — âncora + terceiro estado (decisões de escopo, 09/07).**
- **Contrato `AnchorAdapter` em `@buildtovalue/identity`** (headless, §3), adapters em pacotes próprios
  com transport injetado (`@buildtovalue/anchor-git` — o host provê `commit`/`read`, a lib nunca faz
  rede nem shella `git`). `deriveAnchorState` deriva os 4 estados; o ciclo pendente→ancorada vive no
  hook `useAnchorCycle` (react) e o selo em `AnchorSeal`.
- **Terceiro estado entregue** na Revisão do Aprovador (selo abaixo da confirmação de assinatura):
  assinar → falha de âncora → `PENDENTE` (não regride, retry) → `ANCORADA`; sem adapter → `SEM
  ÂNCORA CONFIGURADA` (§1.4). e2e cobre o ciclo.
- **`CADEIA ≠ ÂNCORA` (broken) + banner no Ledger Explorer adiados para a I-5**, junto da extensão de
  "Verificar cadeia" a assinaturas/âncora — o explorer precisa re-verificar um *receipt gravado*
  contra a cadeia atual (mesmo resolver/verificação da I-5). A **detecção** de mismatch já está
  entregue e testada (`anchor-git` `verify → mismatch`; `AnchorSeal`/`useAnchorCycle` estado
  `broken`); falta só a superfície do banner no explorer. `anchor-rfc3161`/`anchor-s3` são I-4.

**I-5 — SACM assinado + gate de assinatura + verifyLedger estendido (decisões de escopo, 09/07).**
- **Gate de assinatura** (`signaturePromotionRule` em `@buildtovalue/audit`) é um `PromotionRule` que o
  host injeta em `lifecycleConfig.promotionRules` — ON por default quando a instalação configura
  identity (i.e., quando o host injeta a regra). Fecha só a promoção a `active`; papel sem assinatura
  válida bloqueia. Fica como injeção do host (não hard-coded no core, que não conhece identity).
- **`verifyLedgerSignatures` + `collectSignedApprovals`** (audit) re-verificam as assinaturas gravadas
  no `details.signedApproval` — base para o explorer e para o SACM.
- **SACM assinado**: `buildAssuranceCase` enriquece os aprovadores com o estado da assinatura
  (`resolvePublicKey` injetado) + linha de âncora no rodapé; assinatura inválida → claim C1 "não
  sustentada". Invariante do gerador estendido para "…e assinada quando a instalação suporta".
- **Banner de "Verificar cadeia" 3-estados no Ledger Explorer (íntegra / íntegra-mas-não-ancorada /
  rompida) + `CADEIA ≠ ÂNCORA` — follow-up contido.** Precisa persistir o *receipt* da âncora no
  ledger (entrada `ANCHOR_RECORDED`) para o explorer re-verificar contra a cadeia atual; a biblioteca
  de verificação (`verifyLedgerSignatures` + `AnchorAdapter.verify`) já está pronta. A **detecção** de
  assinatura inválida e de mismatch de âncora já está entregue e testada (audit + `useAnchorCycle`).

**Nota para o Handoff 9 (registrar, não implementar — §7 do handoff).** O **Copiloto (IA governada)**
vem depois do 8: autoria `ia.copilot@modelo` só tem força quando as aprovações humanas são assinadas
(depende da cadeia de assinatura desta camada). Junto dele, avaliação **S-FEEL mínima** para o
`businessRuleTask` do simulador, com **lista de exclusão explícita**: sem invocação de função externa,
sem aritmética complexa de data/duração, sem `for`/`some`/`every`, sem contexto aninhado — apenas
comparações, ranges, listas de valores e `-`. Célula fora do subconjunto ⇒ decisão **"não-simulável"**
declarada (o token para com aviso honesto), nunca avaliação silenciosamente errada.

## 11. Handoff 10 (Roteador A*) — decisões de contrato registradas (R-1)

Decisões tomadas ao iniciar a R-1 (visibility graph + A\* headless), aprovadas com o handoff:

1. **`EdgeRouterFn` — extensão aditiva.** A assinatura ganha um 3º parâmetro **opcional** de
   contexto (obstáculos + arestas já roteadas + identidade da aresta). `bezier`/`orthogonal` e o
   consumo em `simulation/edgePath.ts` ficam intactos (ignoram o parâmetro). Materializa-se na R-2;
   a R-1 entrega a função pura `routeAStar(source, target, { obstacles, routedEdges, … })` no core.
2. **Nomes de router.** Mantém-se `'bezier'` como está (API existente prevalece); adiciona-se
   `'astar'` e expõe-se `'straight'` como opção nomeada (R-2).
3. **Router por diagrama/aresta = metadado de APRESENTAÇÃO.** Vive em `extensionElements` (`bpmnr:`),
   nunca em properties semânticas — ferramentas externas ignoram sem quebrar round-trip. Herança
   diagrama→aresta (R-2).
4. **`routeMode='manual'`.** Import externo com waypoints ⇒ tratado como manual; **mas** o
   `routeMode` é gravado no export para que o round-trip **interno** preserve o estado real
   (re-importar um arquivo próprio não torna tudo manual). Materializa-se na R-3.

Escopo R-1 (entregue): `core/src/geometry/astar.ts` — Hanan grid com clearance 12px + A\* de custo
`comprimento + 2×curvas + 4×cruzamentos`, determinístico (byte-idêntico), seleção de porta pela de
menor custo, fallback honesto (`routed:false`). Orçamento: rota típica < 5ms em 100 nós (medido
~1.3ms); pior caso (diagonal de campo inteiro) reconstrói o grid inteiro (~30ms) — a amortização por
**reuso de grid no frame** para o "Limpar roteamento" de 200 arestas fica para a R-4. Data
associations ficam fora do §8.6 (lacuna de idempotência de DI pré-existente, anotada no teste).

### 11.1 R-2b — waypoints cacheados + assentamento (decisões registradas)

Decisões tomadas ao iniciar a R-2b (assentamento no drop + estados visuais), aprovadas:

1. **Vocabulário `routeMode` (gravado JÁ, na R-2b).** `edge.properties.routeMode` é metadado de
   apresentação (`bpmnr:`, §1.3) com dois valores:
   - `'auto'` — rota A\* **derivada e cacheada** pela biblioteca (no load e a cada assentamento de
     drop). Pode ser recomputada livremente.
   - `'manual'` — rota **autorada pelo usuário** (materializa-se na R-3).
   - **Ausência de `routeMode` + presença de `waypoints`** = import externo ⇒ tratado como **manual**
     (nunca recomputado automaticamente). É a regra que protege waypoints de terceiros: só rotas
     marcadas `'auto'` (ou sem waypoints, resolvidas a `astar`) entram no re-roteamento.
2. **Atomicidade do assentamento.** Os waypoints das arestas afetadas por um move são gravados
   **DENTRO do mesmo comando** (o composto `Move nodes`), via `updateEdgeCommand({ waypoints })`
   estendido — um único passo de undo restaura posição **e** rota. `EdgePatch.waypoints` aceita
   `Point[]` (grava/substitui) ou `null` (limpa de volta para auto).
3. **Roteamento de load = derivação, NÃO edição.** `deriveAstarRoutes` roda na **construção** do
   `CommandStack` e em cada `replaceDiagram` (import), **fora** da pilha de comandos: sem entrada de
   undo, sem registro no ledger. Escolha registrada: *compute-e-grave-sem-comando* (a alternativa
   "não-auditável dentro de comando" foi descartada para não poluir o histórico no load).
4. **Garantia central de zero-recalc.** `rerouteConnectedEdges` só toca arestas que (a) tocam um nó
   movido, (b) resolvem a `astar` e (c) não são manual/externas. Aresta cacheada pinta de
   `waypointsToPath` sem chamar o router por render. Coberto pelo e2e-spy (`?astar=1`,
   `window.__routerCalls`): um pan não dispara **nenhuma** rechamada de router.
5. **Assentamento crossfade (nunca morph de waypoints).** No drop, a prévia ortogonal do arrasto é
   pintada por cima nas posições finais e desvanece (160ms) revelando a rota A\* já assentada por
   baixo — puro cruzamento de opacidade de dois traçados sobrepostos. `prefers-reduced-motion`
   suprime o overlay a montante (o handler nunca seta `settling`): snap instantâneo, waypoints
   cacheados na mesma. Estado de fallback (`routeFallback`, sem corredor): traço tracejado
   `--btv-error` + chip ⚠ informativo — a rota melhor-esforço é mantida.

Escopo R-2b (entregue): `EdgePatch.waypoints` (core); `computeRoutedWaypoints`/`deriveAstarRoutes`/
`rerouteConnectedEdges` + tipo `RouteMode` (`react/canvas/routeEdge.ts`); assentamento atômico no
`useInteractions.onPointerUp`; derivação de load no `DiagramProvider`; `SettlingOverlay` (crossfade)
+ estado de fallback no `EdgeRenderer`; e2e-spy de zero-recalc e de reduced-motion (`?astar=1`).

### 11.2 R-3 — rotas manuais (decisões registradas)

Decisões tomadas ao iniciar a R-3 (handles, badge, translação rígida, voltar ao automático):

1. **Transição auto→manual = UM comando.** O primeiro arrasto de segmento ou waypoint de uma aresta
   `auto` grava waypoints **e** `routeMode:'manual'` juntos, num único `updateEdgeCommand` — undo
   volta à rota anterior (auto) atomicamente. Gestos (`useInteractions`): arrastar segmento insere um
   bend; arrastar waypoint move; duplo-clique em waypoint interior remove. Um clique sem arrasto só
   seleciona (limiar de drag), nunca autora bend.
2. **Translação rígida no move do host (caso de borda 6) — DENTRO do comando de move.**
   `translateManualEdges` roda no mesmo composto `Move nodes` (mesma atomicidade da R-2b). Regra:
   ambos os âncoras movidos ⇒ rota inteira translada; só um âncora ⇒ só o waypoint daquela ponta
   segue, bends interiores intactos. Se a translação **colidir** com uma forma, a rota manual é
   **mantida** e ganha `routeCollision` ⇒ chip ⚠ — **nunca** re-roteia silenciosamente. Coberto por
   unit + e2e (`?manual=1`).
3. **"Voltar ao automático" = comando atômico.** `backToAutoPatch` recomputa o A\* agora e cacheia
   (`routeMode:'auto'`), ou — router não-`astar` — limpa os waypoints (segue o router do diagrama);
   um `updateEdgeCommand`, undo restaura a rota manual. Exposto no **inspector** (`PropertiesPanel`);
   menu de contexto de aresta fica para a R-3b (não há infra de context-menu no editor ainda).
4. **Estados sem poluição.** Badge `📍 rota manual` e handles aparecem **só em hover/seleção**;
   handles preenchidos dourados para manual, vazados (branco) para auto — affordance "arraste para
   fixar". Edição ao vivo requer seleção; hit-area invisível de 44px (r=22) por handle interior para
   touch. Fora de hover/seleção a manual é idêntica à automática.
5. **Import externo = manual (§1.4).** `isManualEdge` trata waypoints sem marcador `auto` como
   manual: nunca são re-roteados automaticamente, transladam rígido e podem ser resetados via
   "voltar ao automático".

Escopo R-3 (entregue): helpers `isManualEdge`/`segmentIntersectsRect`/`edgeRouteCollides`/
`translateManualWaypoints`/`translateManualEdges`/`backToAutoPatch` (`routeEdge.ts`); gestos de
edição + translação rígida no `useInteractions`; `RouteEditLayer` + `ManualBadge` + estado de
colisão no `EdgeRenderer`; botão "Voltar ao automático" no `PropertiesPanel`; `EdgeDragState`/
`hoveredEdgeId` no store; unit + integração + e2e (`?manual=1`, caso de borda 6 + §8.3).

**R-3b:** os dois itens de layout (label no maior segmento livre e histerese de porta) foram
**incorporados na R-4** (o critério §8.1 de legibilidade depende do label; a histerese evita o
flip-flop que "Limpar roteamento" tornaria frequente). Fica só o **menu de contexto de aresta** —
conveniência pura, o inspector já cobre "voltar ao automático".

### 11.3 R-4 — limpar roteamento + corredores paralelos + fallback (decisões registradas)

Decisões tomadas ao iniciar a R-4:

1. **"Limpar roteamento" = UM comando undoável para o diagrama inteiro.** `clearRoutingCommands`
   recomputa todas as arestas `astar` automáticas e, por default, **preserva rotas manuais**;
   o toolbar embrulha o resultado num único `compositeCommand('Clear routing', …)`. O toast reporta
   **contagens reais** (`reoptimized` re-otimizadas / `preserved` manuais preservadas). Reset total
   (`includeManual: true`, dobra as manuais de volta a auto) só via botão secundário com
   `window.confirm`. Rota idêntica à atual não gera comando (no-op honesto).
2. **Corredores paralelos 8px (§4, caso de borda 5).** `routeAndSpread`: 2 passes determinísticos —
   (1) roteia cada aresta para descobrir o lado de saída; (2) grupos de ≥2 irmãs que compartilham
   origem+lado são ordenados pela posição do alvo e re-roteados de uma porta deslocada `±8px` ao
   longo da borda (via nova opção `sourcePort` do `routeAStar`). Lanes na mesma ordem dos alvos ⇒
   **sem cruzamento entre irmãs**. Aplicado no batch (load `deriveAstarRoutes` + "Limpar
   roteamento"); o move de host individual continua per-aresta com histerese.
3. **Fallback sem-corredor revalida sozinho (caso de borda 4).** Além do reroute das arestas
   conectadas (R-2b), todo move re-tenta as arestas auto **já marcadas `routeFallback`** (poucas,
   limitado) e limpa o ⚠ **só** se um corredor aparecer — então afastar o obstáculo cura a rota sem
   ação. Arestas saudáveis não relacionadas continuam intocadas (zero-recalc, §8.2).
4. **Histerese de porta (§6, ex-R-3b).** `routeAStar` ganha `preferredSourceSide`/
   `preferredTargetSide` + `hysteresis` e retorna os lados escolhidos; `computeRoutedWaypoints`
   deriva os lados anteriores dos waypoints atuais e exige ganho de custo > 20% para trocar de face —
   mata o flip-flop ao mover 2px.
5. **Label no maior segmento livre (§4, ex-R-3b).** `longestSegmentMidpoint` posiciona o rótulo no
   ponto médio do segmento mais longo da rota (não no ponto médio geométrico) — de que depende o
   critério de legibilidade §8.1.

Escopo R-4 (entregue): `routeAStar` com `sourcePort`/histerese + lados no retorno (core);
`astarAutoEdgeIds`/`routeAndSpread`/`clearRoutingCommands`/`sideOfAnchor` + histerese em
`computeRoutedWaypoints` + recuperação de fallback no `useInteractions` (`routeEdge.ts`);
`longestSegmentMidpoint` no `EdgeRenderer`; botões "Limpar roteamento"/reset + toast no `Toolbar`;
unit + integração + e2e (`?fallback=1` recuperação + toast, `?fanout=1` corredores).

**Adiado (pós-Handoff 10):** menu de contexto de aresta; re-spread da fan-out no move de host
individual (hoje só no batch); re-ranqueamento em idle das arestas que cruzam a área antiga/nova de
um nó movido (§3) — o "Limpar roteamento" cobre a re-otimização global sob demanda.

## 12. Handoff 9 (Copiloto + S-FEEL) — decisões registradas (SF-1)

1. **Hit policies A/P/R/O/C não são avaliadas (§5 do handoff).** O `@buildtovalue/sfeel` avalia
   **U** (Unique, com violação declarada quando 2+ regras casam) e **F** (First). As demais
   permanecem metadado do editor DMN; `evaluate` sobre uma tabela A/P/R/O/C retorna `nonSimulable`
   declarado ("only U and F are simulable"). Implementar a avaliação delas é demanda futura — só
   mediante caso de uso do simulador.
2. **Expressões de input NÃO são avaliadas.** O `expression` da coluna de input é usado **verbatim
   como chave do contexto** (`context[expression]`); uma expressão que precise de avaliação
   (aritmética, path) está fora do subconjunto — variável ausente do contexto é falha declarada.
3. **Honestidade dinâmica ampliada (além da cerca §1.6 estática):** variável ausente, mismatch de
   tipo entre teste e valor, e violação de Unique também retornam `nonSimulable {cell, reason}` —
   as três alternativas silenciosas produziriam resultado errado. Sem terceiro estado.
4. **Listas OR aceitam qualquer teste do subconjunto** (`< 3, > 10`, `[1..3], 7`) — S-FEEL padrão
   de "positive unary tests"; a §5 lista o caso de valores, o parser aceita o geral (documentado no
   README do pacote). `not(…)` segue estrito à §5: só lista de literais.

## 13. Handoff 11 (Biblioteca como produto npm) — triagem e decisões registradas

- **H9 §8.5 (nuance, sem urgência):** a *asserção literal* de que a resposta da C1 declara a
  degradação sem-DMN não existe — a garantia é estrutural (o vocabulário do contrato de prompt só
  exprime decisões como gateway XOR). Adicionar a frase ao fixture + e2e é uma linha, sob demanda.
- **Triagem N-2 (corpus):** o corpus real já estava entregue (27 arquivos, `fetch:corpus` no CI,
  `corpusExternal.test.ts` ≥20). Proveniência por arquivo fica no `MANIFEST.json` — **decidido**:
  header em arquivo alteraria os bytes do round-trip; o MANIFEST é a fonte única, a documentar no
  `CONFORMANCE.md`. Restante da N-2: proporção real/gerado no CONFORMANCE + flag do `certify`
  (`--xsd` só se validar contra XSD de verdade; senão `--strict` documentado).
- **Triagem N-3 (event bus):** renomear para o catálogo do handoff **com aliases deprecados** —
  os nomes antigos (`node.created`) emitem junto por uma minor com warning único; `shape.render.error`
  entra no catálogo documentado. O contrato de estabilidade semver nasce na N-3.
- **Triagem N-7 (viewer):** o nome `BpmnViewer` já existe como wrapper readOnly do Designer; o
  realinhamento para o entry point leve exige **teste de equivalência de render** antes de mexer.
- **N-2 ENTREGUE:** `corpusPolicy.ts` é a fonte única (contagem gerada anti-drift + bounds do
  fetch); CONFORMANCE.md ganhou as seções "Corpus real vs gerado" (com a decisão
  MANIFEST-como-proveniência) e "`certify --strict` vs validação XSD"; o CLI ganhou `--strict`
  (gate estrutural, exit 1) e REJEITA `--xsd` com mensagem honesta até existir validador real.
  Fecha o follow-up de XSD/corpus dos itens §7/§8.1 no perfil atual — validação XSD integral
  permanece possível como evolução, sob demanda de certificação formal.

## Resolvidas (para histórico)

- ~~Lane membership manual/data-only~~ → interativa na Fase 5a.
- ~~`messageFlow`/`association` ausentes do perfil XML~~ → mapeados de verdade na Fase 5a.
- ~~Pools/lanes marcados como "unreachable" pela validação~~ → corrigido na Fase 5a.
- ~~Exemplo sem raias / ícones de paleta~~ → paleta tem Pool/Lane; demo continua focado no
  domínio BTV (adicionar um exemplo com raias ao demo é trivial se você quiser).
- ~~Export PNG/SVG frágil a assets externos (#27, §8.7)~~ → `exporters.ts` agora torna a saída
  **auto-contida**: inlina as custom properties `--bpmnr-*`/`--btv-*` vivas (var() resolve ao valor
  temático, não ao fallback), embute `<image>` como data URI (asset cross-origin não tinge o canvas
  → `toBlob` deixa de retornar null) e embute `@font-face` same-origin. `exportSvg`/`exportPng`
  passaram a ser assíncronos; assets inalcançáveis são deixados como estão (a saída ainda é
  produzida, sem lançar). Unit (inline de imagem + falha graciosa) + e2e (`export.spec.ts`: PNG com
  assinatura mágica válida, SVG bem-formado sem camadas transitórias). O menu de contexto de aresta
  (§11.3) segue como única conveniência adiada do roteamento.

*Se nada disto for prioridade agora, pode ignorar o arquivo — está aqui para não perder o
contexto das decisões em aberto.*
