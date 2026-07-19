# DECISIONS — registro histórico de decisões fechadas

Decisões de produto/arquitetura **já tomadas e registradas**, extraídas de `pendencias.md`
(que agora só carrega o realmente aberto). Cada seção preserva o texto original do handoff
correspondente. Novas decisões entram no topo da seção "Decisões recentes".

## Decisões recentes (rodada de melhorias, 2026-07-14)

- **Gate de audit da CI tolera o endpoint aposentado do npm (2026-07-15, decisão do
  owner):** o npm aposentou o endpoint de security-audit que o `pnpm audit` chama
  (HTTP 410 em `/-/npm/v1/security/audits[/quick]`; o pnpm 10.33 — latest na data —
  ainda o usa). O step passou a converter SOMENTE `ERR_PNPM_AUDIT_BAD_RESPONSE` em
  warning de workflow; qualquer advisory real continua derrubando o build. Revisitar
  (remover a tolerância) quando o pnpm migrar para o bulk advisory endpoint.

- **Handoff 14 / 1d — o LintPanel é dono de `issueBadges` enquanto aberto (U-5):** ao
  abrir, o dock espelha seus findings como badges de canvas (mesmo campo que o Validate
  e o PromotionPanel populam — última superfície vence); ao fechar, limpa. Os badges
  nunca vazam para o export: além dos elementos `[data-node-issue]` (já em
  `TRANSIENT_SELECTORS`), o exporter agora remove **atributos** transitórios
  (`TRANSIENT_ATTRIBUTES`, hoje `data-node-issue-state`) — extensão do padrão
  "export mid-gesture" adotado na U-3.
- **Handoff 14 / 1c+1d — `panViewportTo`/`reducedMotion` viraram API pública:** o pan
  animado da busca foi extraído para `canvas/viewport.ts` e é reusado pelo painel de
  lint (ordem da validação da U-4: "reuse o pan animado, não crie mecanismo novo");
  como `index.ts` reexporta o módulo, os dois helpers entraram no apiSurface —
  deliberado, hosts ganham a MESMA navegação animada.
- **Handoff 14 / 1d — perfis de lint versionados como identidade de artefato:**
  `LintProfile {id, name, version, source, rules}` no `@buildtovalue/lint`
  (`lint-etiquette@1.0.0`, `lint-engine@1.0.0`); o header do painel e o
  `lintProfileAdapter` da Biblioteca leem o MESMO registro `LINT_PROFILES` (padrão
  anti-drift do copilotPromptAdapter). Mudar regra = nova versão promovível.
- **Handoff 14 / 1a — Esc não fecha o context pad pela pilha de dismissal** (validado
  na U-1): o pad é affordance passiva da seleção (como portas e resize handles), não
  um overlay aberto pelo usuário — Esc limpa a seleção e o pad some junto. Entrada
  própria na pilha mudaria a semântica do primeiro Esc sem ganho.
- **Handoff 14 / 1g — colunas comparativas ANEXADAS à U-6** (decisão revista na
  validação da U-5; a U-1 havia aberto U-7): extensão do gerador anti-drift
  (`THIRD_PARTY_DECLARATIONS`) com células de terceiros sempre "declarado pela doc
  deles" com link no cabeçalho da coluna — nunca claim próprio sobre concorrentes;
  "—" significa "sem declaração registrada", não falta de suporte.
- **Handoff 14 / 1e — import sem DI usa o layout layered** (era grade): mesma
  regra de sempre — aplica direto COM aviso declarado (não há geometria do usuário
  para propor contra); grade permanece como fallback para diagramas com
  pools/lanes (fora do escopo do motor v1). Impacto medido antes: corpus 61/61.
- **Handoff 14 / 1f — contrato `BpmnPlugin.engine` (EngineBridge):** a aba
  "Execução" só existe com plugin de engine (primeiro vence); a verdade da
  assinatura (`isSigned`) e o transporte de deploy são do HOST — o editor só
  aplica o gate (VIGENTE + assinada) e o card de bloqueio. Deploy de rede segue
  fora de escopo (§3).
- **Handoff 14 / 1e — translado de rotas 📍 no auto-layout reusa `translateManualEdges`
  (R-3)**, translação rígida, sem mecanismo novo (correção definida na validação da U-1).

- **Receita de hash do ledger versionada (v2).** `computeEntryHash` passa a despachar por
  `AuditEntry.hashVersion`: entradas novas usam v2 = SHA-256 de `canonicalJsonExact` do objeto
  inteiro (sem arredondamento numérico e sem o `join('|')` ambíguo do preimage v1); entradas
  sem o campo continuam verificando pela receita v1 — cadeias existentes permanecem válidas
  para sempre. `computeDiagramHash` (registry) segue arredondando coordenadas de propósito:
  mudá-lo invalidaria hashes de snapshot já registrados. Assinaturas identity migraram para
  `canonicalJsonExact` sem quebra (payload é só strings — bytes idênticos, coberto por teste).
- **Prettier removido.** Estava em devDependencies sem config, script ou gate — impor agora
  reformataria 134–267 arquivos. Se formatação automática for desejada no futuro, adotar em
  PR dedicada com o reformat completo de uma vez.
- **Roteamento no worker adiado (follow-up).** O harness `workers/executor.ts` está pronto,
  mas nenhum código de produção o consome; ligar o seeding de rotas (que não pode entrar no
  histórico de undo) a um pipeline assíncrono exige guardas de corrida próprias e validação
  e2e dedicada — PR separada (ver melhorias.md F7).
- **Regras compiler do eslint-plugin-react-hooks v6 não adotadas.** `rules-of-hooks` e
  `exhaustive-deps` estão ativas; as regras novas (refs-during-render, set-state-in-effect,
  immutability) flagam ~50 padrões deliberados do código (refs sincronizados no render,
  effects de sync com o store) — adotá-las é refactor comportamental, não troca de lint.
- **Handoffs de design permanecem em `docs/design_handoff_btv_*`** (≈3 MB com screenshots):
  são registro histórico consultado com frequência; movê-los quebraria links de PRs antigas.

---

## Passthrough de extensões estrangeiras (`zeebe:*`/`camunda:*`) — FECHADO (2026-07-18)

Decisões da PR dedicada (plano validado com 2 reforços):
- **Garantia**: lossless SEMÂNTICO na importação + byte-estável entre os NOSSOS exports; nunca
  byte-idêntico ao arquivo de terceiros. `trim()` de bordas do texto e CDATA→texto escapado são
  contrato documentado no format-spec (reforço 2), não efeito colateral.
- **Modelo**: campos opcionais aditivos (`foreignExtensions`/`foreignAttributes`/
  `processForeignExtensions`/`foreignNamespaces`); ausentes ⇒ hashes e bytes pré-PR inalterados
  (fixture congelada `passthroughFrozen.json` prova).
- **Diff nomeado** (reforço 1): mudanças aparecem como o TAG do elemento estrangeiro
  (`zeebe:taskDefinition`) ou `@atributo` (`@zeebe:modelerTemplate`) no computeDiff/diffDiagrams
  e no popover ΔN do review — nunca blob.
- **Mudança de leitura**: `property`/`meta` com prefixo DIFERENTE do nosso deixam de ser
  misparseados como nossos (viravam propriedades silenciosamente) e agora são preservados como
  estrangeiros; sem prefixo continua legado-tolerante.
- **Fora de escopo registrado**: filhos estrangeiros de `definitions` fora do processo (pendência
  compensação/coreografia) e o mapeamento lint `EXEC_*`←passthrough (follow-up opcional).

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

---

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

---

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

- **Round-trip de filhos de subProcess — PR 1 virou trava de contrato (10/07/2026):** um
  diagnóstico externo apontava round-trip **defeituoso** de filhos de subprocesso (supostamente
  documentado num `docs/known-issues.md`) como pré-requisito do reparent-on-drop. A triagem no
  código **não confirmou o defeito**: `docs/known-issues.md` não existe; o export já aninha
  filhos (`ElementSerializer.writeNode` recursiona `childrenOf`, `edgeScopeOf` escopa os flows
  internos, `parentId` é reservado e nunca vaza como `bpmnr:property`); o DI escreve shape por nó
  e re-lê por `bpmnElement`. Corpus (`25/26/27-subprocess`, `52/53/54-nested-subprocess`) e unit
  (`converter.test.ts` — import + export autorado) já cobrem e passam. Reproduzi o cenário exato
  do reparent (escrever `parentId` em nós antes top-level → export aninhado → re-import
  equivalente) e ele round-tripa limpo. **Decisão:** não fabricar um bug nem uma entrada de
  known-issues falsa. O PR 1 fica **fino**, como *trava de contrato*: `converter.test.ts` ganha o
  grupo "reparent export contract (F7 · pre-PR2)" — reparent de nó top-level (nível 1),
  round-trip byte-estável do resultado, DI absoluto sem translação, e o caso ANINHADO de 2 níveis
  (`outer ⊃ inner ⊃ deep`, o caso de borda do hit-test hierárquico do PR 2). Assim a saída
  autorada do PR 2 nunca pode regredir o serializer silenciosamente. A ordem vinculante dos 3 PRs
  é mantida — o PR 1 só deixou de "corrigir" para "travar".

- **Reparent-on-drop em subprocesso expandido — PR 2 (10/07/2026):** o gesto que faltava (nenhuma
  UI escrevia `properties.parentId`). Decisões de escopo:
  - **Hit-test no core, precedência na composição.** `subProcessContainerAt(diagram, point,
    exclude)` (em `model/types.ts`) devolve o subprocesso expandido MAIS PROFUNDO sob o cursor,
    excluindo os nós arrastados + subárvore (sem auto-reparent); testado em `model.test.ts`
    (aninhamento, exclusão, colapsado/removido ignorados). A **precedência do boundary snap** vive
    na ordem do `onPointerMove` (só arma reparent quando `boundarySnap === null`) e no drop (os
    ramos de boundary dão early-return antes do caminho genérico) — testada no react
    (`reparentOnDrop.test.tsx`), não no core, porque é composição de dois sinais (o de boundary
    depende de `registry`/`drillId`, que são de UI). Não quebra o gesto da N-1.
  - **Reparent + move = 1 comando composto** (`reparentCommands` no padrão de
    `laneMembershipCommands`, dentro do mesmo `compositeCommand('Move nodes')`). Só os nós
    GRABBED (roots) reparentam; descendentes que vão de carona mantêm o parentId interno; boundary
    events seguem o host, nunca reparentam por parentId. `rootIds` foi adicionado ao `DragState`.
  - **DI absoluto reusado (decisão §8.0):** reparent NÃO translada coordenadas — só muda parentId.
    Colapso/drill/visibilidade e `crossScopeEdgeRule` já são keyed por parentId, então "valem"
    para os novos filhos sem código novo (re-assertado em unit + e2e).
  - **Arestas cruzando a fronteira (ponto 5):** o reparent nunca deleta nem silencia a aresta; a
    validação existente `crossScopeEdgeRule` (`CROSS_SCOPE_EDGE`) passa a acusá-la — coberto em
    `reparentOnDrop.test.tsx`.
  - **Reparent durante drag multi-seleção: MANTIDO, não cortado.** Todos os roots selecionados
    reparentam para o mesmo alvo — é o caminho natural do `reparentCommands(rootIds, …)` e
    reproduz o sintoma original (dois nós conectados arrastados para dentro; o fluxo entre eles
    continua interno e visível). Coberto pelo teste "the original symptom".
  - **Highlight condicional:** `ReparentTargetOverlay` reusa o padrão do `BoundarySnapOverlay`
    (stroke selected 2px, transição 120ms). Sem highlight ⇒ sem reparent no drop.
  - **Canário de FPS:** o hit-test novo no `onPointerMove` é O(n) sobre os subprocessos; `perf.spec`
    segue verde (nenhuma regressão de FPS no drag).

- **Menu de contexto "Mover para dentro / Remover do subprocesso" — PR 3 (10/07/2026):**
  built-in condicional de nó no contrato N-5 (`ContextMenu.tsx`), o caminho de teclado/a11y e
  touch para o reparent (o drag não é acessível). Decisões:
  - **`when` condicional:** "Mover para dentro de {nome}" aparece quando o nó sobrepõe um
    subprocesso expandido do qual **não** é filho (`subProcessContainerAt` com o centro do nó,
    excluindo self+subárvore, e `container.id !== parentId atual`); "Remover do subprocesso"
    aparece no caso inverso (o nó tem `parentId`). O nome do container vai no rótulo por
    interpolação i18n.
  - **Ações = comandos.** Ambas despacham `updateNodeCommand({properties:{parentId}})` via
    `execute` — undoáveis, e os eventos do catálogo (`command.executed`/`element.changed`) saem de
    graça pelo pipeline de comando. O menu nunca muta o diagrama direto (regra N-5).
  - **Elegibilidade:** exclui swimlanes (pool/lane) e boundary events (seguem o host, não usam
    parentId). Intermediários e subprocessos são elegíveis (nós de fluxo normais). Nuance vs. o
    drag: o drag trata evento intermediário solto perto de borda como boundary-attach; o menu, por
    ser explícito e sem ambiguidade de proximidade, oferece o reparent direto — o caminho do menu
    é o mais permissivo/correto de propósito.
  - **i18n:** rótulos só nos fragments (`menus.ts`, en+ptBR); zero hardcoded (cerca N-6 verde,
    373 keys).
  - **Cobertura:** unit react (presença condicional + inverso, um comando por ação, operação por
    teclado, exclusão de container/boundary); e2e cobre o "Remover do subprocesso" por teclado no
    demo (o "Mover para dentro" fica no unit determinístico — na demo um nó só sobrepõe um
    subprocesso expandido transitoriamente, então o e2e usaria o próprio drag para criar o estado).

---

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

---

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

---

## 8.0.3 Handoff 5 F-C2 — decisões de escopo (faixa de pedigree)

- **"hover = hash do ledger":** a faixa não consulta storage de governança (mesma regra do
  VersionTimeline) — o host injeta `ledgerHash(edge)` e o hash aparece no tooltip do card.
  O demo não injeta (a cadeia do sample é estática, sem entradas correspondentes no ledger
  da sessão); coberto por teste com resolver stub.
- **Rótulo do card:** label/purpose da edge + tag de versão (`vX.Y` quando criada na versão
  carregada; `#id7` caso contrário — mesmo fallback do selo FECHADO, §8.0.2).
- **Card raiz não clicável:** DiffView é sempre do par adjacente; a primeira versão não tem
  predecessor. Alternativa (diff contra vazio) rejeitada — renderizaria um "add" enganoso.

---

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

---

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

---

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

---

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

**Adiado (pós-Handoff 10):** ~~menu de contexto de aresta~~ (**entregue na N-5 do Handoff 11** —
ver §13); re-spread da fan-out no move de host individual (hoje só no batch); re-ranqueamento em
idle das arestas que cruzam a área antiga/nova de um nó movido (§3) — o "Limpar roteamento" cobre
a re-otimização global sob demanda.

---

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

---

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
  → **ENTREGUE (N-7):** `@buildtovalue/react/viewer` é o entry point leve (render + pan/zoom +
  overlays read-only: selos/⚠), sem `useInteractions`/toolbar/paleta/inspector/comandos. O
  `viewerEquivalence.test` (escrito PRIMEIRO) prova que `<BpmnViewer>` pinta o mesmo canvas que
  `<BpmnDesigner readOnly>` (compara o SVG); `viewerBundle.test` mede o grafo de deps (o entry NÃO
  alcança nenhum módulo do editor) e o tamanho (viewer = 44.8% do editor, ≤50% medido). O export
  `BpmnViewer` da raiz foi realinhado para a impl leve sem quebrar consumidores (equivalência como
  prova). Substrato compartilhado: `canvas/renderList.ts` (visível+z-order+cull) usado pelo canvas
  do editor e pelo `ViewerCanvas`, para os dois caminhos nunca divergirem.
- **N-8 ENTREGUE (fecha o Handoff 11):**
  - **A11y:** passe com axe (`color-contrast` desabilitado — jsdom não calcula layout) nas
    superfícies principais: Designer/Viewer/menus/painéis (react) e as 3 telas do Studio
    (Biblioteca/Revisão/Auditoria). Gate de CI = **zero violações CRÍTICAS** (asserção nos testes
    `a11y.test`, que rodam no `test:coverage`). Resultado real: **zero violações de QUALQUER
    impacto** — os 3 problemas encontrados foram corrigidos, não só registrados: `role="list"` sem
    `listitem` na grade da Biblioteca (crítico), `role="listbox"` vazio na Revisão/Auditoria
    (crítico), `<p>` direto dentro de `<ol>` no ledger (sério), e `<main>` aninhado na Revisão
    (moderado ×3 → `<section>`). Sem dívida sérias/moderadas a registrar. Teclado do canvas
    re-assertado (role=application + nome + Esc na pilha de dismissal).
  - **Web Workers opcionais:** harness genérico zero-dep (`workers/executor.ts`) — `createSyncExecutor`
    (default = comportamento síncrono atual), `createWorkerExecutor(worker)`, `createWorkerHandler`,
    e a entrada `@buildtovalue/react/worker`. Jobs puros serializáveis: `route` embutido (react); o
    host registra `soundness`/`layout` do mesmo modo (não há algoritmo de auto-layout no código
    ainda — o harness já o comporta). Degradável: sem worker = síncrono. Equivalência **byte a byte**
    provada (`workers.test` para route; `workerSoundness.test` no studio para soundness) via round-trip
    JSON simulando a fronteira do worker.
  - **TypeDoc:** `docs/api` gerado dos tipos públicos (react index + viewer) com `typedoc.json`
    (`outputFileStrategy: modules`, `disableSources` → saída determinística). Frescor no CI
    (`check:docs-fresh`): regenera e diffa (mesmo padrão do CONFORMANCE.md) — mudança na superfície
    pública sem regenerar deixa o CI vermelho.
- **N-2 ENTREGUE:** `corpusPolicy.ts` é a fonte única (contagem gerada anti-drift + bounds do
  fetch); CONFORMANCE.md ganhou as seções "Corpus real vs gerado" (com a decisão
  MANIFEST-como-proveniência) e "`certify --strict` vs validação XSD"; o CLI ganhou `--strict`
  (gate estrutural, exit 1) e REJEITA `--xsd` com mensagem honesta até existir validador real.
  Fecha o follow-up de XSD/corpus dos itens §7/§8.1 no perfil atual — validação XSD integral
  permanece possível como evolução, sob demanda de certificação formal.
- **N-5 ENTREGUE (fecha o §11.3 "menu de contexto de aresta"):** ContextMenu plugável — built-ins
  condicionais de ARESTA completos ("Voltar ao automático" só se manual, "Adicionar waypoint aqui",
  "Editar rótulo" inline via `EdgeLabelEditor`); contrato de plugin `contextMenuItems(target)` →
  `{id, label, when(ctx), run(ctx, {execute})}` — `run` recebe **só** o dispatcher de comandos
  (zero acesso direto ao estado, garantido por teste do shape da API); teclado completo
  (Menu/Shift+F10, setas, Enter) com o menu entrando na pilha única de Esc (fecha antes de
  qualquer outra coisa) e, aberto, DONO do teclado (atalhos globais silenciam — setas não
  empurram a seleção atrás do menu); long-press (touch, 500ms) abre e alvos ≥44px via
  `pointer: coarse`. **Built-ins de NÓ/CANVAS mínimos por decisão:** nó tem só "Editar rótulo";
  disparo de boundary em simulação, duplicar/colar no canvas etc. são EXTENSÕES FUTURAS — a infra
  (target kinds `node`/`edge`/`canvas` + seções de plugin) já as comporta sem mudança de contrato.

---

## 14. Handoff 12 (Agent Lane) — decisões registradas (A-1)

- **Forma canônica de ref (DECIDIDO, A-1):** referência de artefato = string `id@semver`,
  idêntica ao `calledElement` do callActivity (`agnt-rsch@2.1.0`, `prm:research@2.0.0`). Os
  prefixos `agnt-`/`prm:` são **convenção de id, não sintaxe** — o único separador estrutural é o
  ÚLTIMO `@`, então o id pode conter `-`, `:`, `.`. Parser único (`packages/agentflow/src/ref.ts`,
  `parseRef`) normaliza as três formas hoje existentes: string `id@semver` (callActivity), objeto
  `{id, version}` (copilot `PromptTemplateRef`), e as formas ABREVIADAS do protótipo
  (`prm:research@2`, `agnt-verify@1.0`) → expandidas para `major.minor.patch` **com aviso**
  (`PROMPT_REF_ABBREVIATED`/`DELEGATE_REF_ABBREVIATED`). O protótipo (`AgentStudio BTV.dc.html`)
  usa a forma abreviada como **display, não como storage** — nunca aceita silenciosamente.
- **Protótipo vs. normativo — aresta delegate e autonomia (nota):** o canvas do protótipo desenha
  uma aresta `delegate` (⤳ `agnt-verify@1.0`) enquanto exibe o pill "2 · Bounded Loop". Pela regra
  §4 ("o grafo é quem manda"), uma aresta delegate força autonomia 4 (Multi-Agent). Portanto o
  template `Research Agent` fica um Bounded Loop nível 2 LIMPO (sem delegate) e o comportamento
  delegate/nível-4 é exercitado por teste (`acidez`/`autonomy`/`validate`). Os 3 templates mapeiam
  1:1 os níveis 1/2/3 (Approval Gate / Research / Document Review) — pedagogia da escala §4.
- **Divisão da regra de autonomia→gate (cerca §7, DECIDIDO):** a metade agnóstica de grafo vive no
  `agentflow` (`autonomy.ts`: `minCoherentLevel`, coerência declarado<grafo = erro `AUTONOMY_INCOHERENT`,
  predicado puro `gateRequirement`). A metade que precisa do processo BPMN — "nível ≤3 sem `btv:gate`
  alcançável a jusante = erro que bloqueia promoção" — é do **core (A-3)**, que conhece `btv:gate` e
  alcançabilidade e consome `gateRequirement`. O `agentflow` nunca importa core.
- **Fronteira A-3 — RESOLVIDO (namespace do agentTask):** decidido **reusar o namespace `bpmnr:`
  existente**, NÃO introduzir um `btv:` dedicado. O §5 do handoff mostra `<btv:agentTask>` /
  `<btv:agentWorkflowSnapshot>` como XML ilustrativo; a implementação segue a convenção de extensão
  única do repo (restrição inviolável honrada: o prefixo `bpmnr:` já exportado NÃO muda). Concreto:
  o agentTask exporta como `<bpmn:task>` + `bpmnr:meta type="agentTask"` (identidade) + os campos
  (`agentWorkflowRef`/`autonomyLevel`/`inputMapping`/`outputMapping`) como `bpmnr:property` — tudo já
  round-trip pelo mecanismo existente, zero código novo. O **snapshot** é o único elemento novo: um
  `bpmnr:agentWorkflowSnapshot` dedicado (atributo `snapshot` com o JSON escapado), fora do bag de
  propriedades, escrito só quando presente e lido simetricamente (byte-estável nos dois sentidos —
  teste `agentTask.test.ts`). Degradação: editor externo lê `<bpmn:task>` e ignora a extensão
  `bpmnr:` desconhecida (comportamento provado por `NodeTypeRegistry` sem `agentTask` → tipo `task`,
  e pela fixture do corpus `58-agent-task-v1.bpmn`). Se um `btv:` dedicado for exigido depois, é uma
  migração aditiva de namespace — sob demanda.
- **Regra autonomia→gate no core — por injeção (A-3):** `agentAutonomyGateRule({ requiresGate,
  isGate })` — `requiresGate` é o `requiresDownstreamGate` puro do agentflow, `isGate` é o predicado
  de domínio (`btv:gate`). O core faz a alcançabilidade a jusante (BFS de sequenceFlow) e NÃO importa
  agentflow nem domain-example. Bloqueia promoção a `active` via `evaluateGates` (template
  `soundnessPromotionRule`), com remediação exata. `resolveAgentWorkflow` faz o fallback de snapshot
  (registry = fonte de verdade; snapshot = leitura degradada com aviso; nunca fonte de verdade).
- **A-4 — AgentStudio shell (entregue):** shape do agentTask reusa `ActivityBox` (geometria/tokens
  padrão, SEM borda dupla do callActivity — marcador 🤖 próprio traço 1.2 + rodapé mono da ref);
  badge de ref não resolvida reusa o `CALL_REF_MISSING` (regra do registry, A-6). Modal com `useDismissal`
  (Esc fecha antes do Designer), eventos N-3 (`element.added`/`changed`/`removed` + `command.executed`/
  `command.undone`) emitidos de DENTRO do modal via `emitEditorEvent`, i18n via fragment `agentStudio`
  (superfície no MIGRATED do grep). **Undo isolado:** pilha própria via `useReducer`
  (`agentEditorReducer`, past/present/future) — NÃO reusa o `CommandStack` do core (que é sobre
  `BpmnDiagram`); undo no modal nunca desfaz o BPMN. **Layout do canvas:** derivado
  (`layoutWorkflow`, layered BFS) porque o schema §3 é grafo puro sem coordenadas — determinístico.
  **Deferido para A-5 (declarado):** o botão Simular (trilha compartilhada), a PROPOSTA undoável do
  boundary event (o aviso já é renderizado no inspector; o comando `attachBoundaryCommand` é A-5) e
  a instância de templates com fixtures de simulação. A-4 entrega o SHELL (§8).
- **A-5 — simulação + boundary proposto + templates (entregue):** **trilha compartilhada** — o
  `SimulationState` do agentflow (paridade estrutural com o H7) é passado direto à mesma UI:
  `BlockedDecisionNotice` (o chip de bloqueio existente) + as classes CSS `bpmnr-sim-trail` — zero
  adaptador, zero fork; a `BlockedDecision` mostra nó (na trilha `⛔ dec-3`) + razão + contagem.
  **Reduced-motion:** `prefersReducedMotion()` (mesmo sinal do H7) → passo a passo 0ms (sem
  `setInterval`), fluxo completo operável. **Boundary PROPOSTO, nunca silencioso:** ao salvar com
  errorBoundary, card accept/refuse; accept = UM comando undoável (`proposeErrorBoundaryCommand` =
  `compositeCommand([addNodeCommand, attachBoundaryCommand])`, N-1) na pilha do macro (undo remove
  tudo); refuse = nada muda e não re-pergunta na sessão (`boundaryResolved`). **Templates:** canvas
  vazio → chooser com Approval Gate Agent ★ default. **Ledger:** `agentSimulationSessionEntry`
  (`AGENT_SIMULATION_SESSION`, tipo aditivo em adapters-bpmn) com ref@versão + parada honesta.
  **Deferido:** o editor de fixtures por nó no inspector (hoje as fixtures chegam por prop
  `simulationFixtures`; default vazio → bloqueio honesto por campo ausente, que é o caminho §3) — UI
  de edição de fixtures é incremento sob demanda; Shadow/Live Mode segue fora da v1.
- **Fronteira A-6 — RESOLVIDO (adapter "AGENTE" = BESPOKE):** decidido **adapter bespoke sobre a
  interface `ArtifactAdapter`**, NÃO envelopar o `AgentWorkflow` como pseudo-`BpmnDiagram` num
  `kindAdapter`. Racional: o `VersionRegistry` é hardcoded a `BpmnDiagram` (snapshot + `computeDiagramHash`);
  forçar o JSON do agente por ele — mais `classifyDiagram`/diff/thumbnails — seria **desonestidade de
  tipo** (assumiriam semântica BPMN que o grafo não tem). O contrato `ArtifactAdapter` do H6 existe
  exatamente para artefatos não-BPMN (a Biblioteca é genérica por design) — o agente é o primeiro que
  prova isso. **Caminho: path 2** — o adapter (`agentWorkflowAdapter`) guarda versões como JSON
  canônico + hash (`canonicalJson`/`sha256Hex` do core) sobre uma `source` injetada e implementa o
  mínimo do contrato (list→cards AGENTE com autonomia em TEXTO + 🤖 icon, sem cor nova; get→ficha com
  timeline/ações/proveniência). Resolução versionada (`id@semver`) e a **vigência REUSADA** do
  callActivity: `agentReferenceCurrencyWarnings` avisa quando processo ativo referencia versão de
  agente não-`active` (candidata/obsoleta). Promoção de agente = `agentPromotionGate` (validação §3
  do grafo como gate, shape `RuleVerdict` padrão). Ledger: `AGENT_SIMULATION_SESSION` categorizado em
  Simulações; ref@versão vira filtro por artefato (deep-link à ficha = navegação do host, mesmo item
  aberto do callActivity §1.2). `classifyDiagram` permanece BPMN-only (o agente não é um kind dele).
- **A-7 — LangGraph JSON ≥0.2 (entregue; FECHA o Handoff 12):** `importLangGraph`/`exportLangGraph`
  sobre um **subconjunto DOCUMENTADO** (README campo a campo: id/name/version, input/output_schema,
  nodes id/type/config, edges source/target/data.{edgeType,when}). Import: campos fora do subconjunto
  (`interrupts`/`checkpointer`/…) **ignorados e DECLARADOS** em `warnings`; nó de tipo não-mapeável →
  `LangGraphImportError` **nomeando o nó** (nunca perda silenciosa). Export: só o subconjunto;
  `autonomyLevel` (sempre), decoradores e arestas `delegate` (a2a:1.0) **declarados** como fora.
  Round-trip do subconjunto = grafo equivalente (`autonomyLevel` recomputado por `minCoherentLevel`).
  Zero deps (JSON puro). `interop` no package.json: `{ langgraph: ">=0.2", a2a: "1.0" }`.
- **Extensões futuras registradas (Handoff 12):** Shadow/Live Mode (execução real via `AIProvider`
  do H9) FORA da v1; editor de fixtures por nó no inspector do Studio (hoje via prop); gramática de
  condição mais rica que o subconjunto `output.<path> <op> <literal>`; subconjunto LangGraph maior
  (mapear mais construtos) se houver consumidor; namespace `btv:` dedicado no converter se exigido
  (hoje `bpmnr:`); deep-link ledger→ficha do agente (navegação do host). Cortados em definitivo
  (não reabrir sem novo parecer): OWL/SPARQL/RDF, CrewAI/GraphML, JSON-LD, memória/planner como nós,
  A2A/MCP como protocolo, 4º tipo de nó.
- **Shadow / Live Mode — FORA da v1 (§7):** a simulação da v1 é só mock client-side. Shadow/Live
  entra como evolução futura via `AIProvider` (H9), sob demanda — sem runtime de execução real de
  agente no código ainda.
- **A-2 — subconjunto de condição simulável (DECIDIDO):** o motor mock avalia apenas
  `output.<path> <op> <literal>` (`===`/`!==`/`>`/`<`/`>=`/`<=`, literais boolean/number/string).
  Qualquer coisa fora disso — expressão composta, campo ausente, compare de ordem em não-número —
  é **bloqueio declarado** (`BlockedDecision`, disciplina S-FEEL), nunca rota adivinhada. Gramática
  de condição mais rica é evolução sob demanda; o A-1 (`validate`) já casa o mesmo subconjunto.
- **A-2 — paridade de shape verificada estruturalmente, não por import (cerca §2):** o
  `agentflow` redefine `SimulationState`/`TransitionRecord`/`BlockedDecision` estruturalmente
  idênticos aos do H7; `tests/structuralShape.test.ts` INLINA as formas do H7 (sem import) e
  afirma assignability mútua via `expectTypeOf` (quebra o build se qualquer lado derivar). Um teste
  de assignability cross-package (importando ambos) pode ser adicionado a partir de um pacote que já
  depende do ecossistema (ex.: A-6) — o `agentflow` permanece zero imports.

---

## 15. Handoff 18 (Escalation Governada) — decisões registradas

- **Errata do mock 5c — autonomy pill:** o protótipo do painel 5c mostrava um *pill de autonomia*
  sob o agentTask ("autonomia: propõe · budget 2h"). A implementação NÃO o pinta no canvas: vence
  o princípio de arquitetura declarado no Handoff 12 (§6.1, comentário em `AgentTaskShape`) —
  "autonomy/authorship live in the inspector and seals, never here". O elemento visível do
  agentTask é o rodapé do ref governado (🤖 + `nome@semver`), que carrega a autonomia via o
  workflow governado. Validado pelo owner na EC-3 (o princípio vence o mock).
- **`escalationAuthority` no CATCH, não no userTask:** o mock 5c mostra "↟ autoridade" sob a
  revisão humana; a implementação põe a prop no CATCH de escalação (o overlay de EC-2 renderiza o
  chip para nós de escalação), coberto pela cláusula "no userTask OU no catch" da spec.
- **Predicado de catch de escalação no CORE (`eligibleEscalationCatches`):** fonte única headless
  (enumeração diagram-wide, sem escopo/tiers) que o lint (EC-4 `ESC_NO_CATCH`) e o simulador
  (EC-5 `throwEscalation`) consomem — zero fork; o lint não importa simulation.
- **`ESCALATION_RAISED` = "aconteceu", não "desenhado":** a entrada de ledger não é amarrada à
  criação do boundary; a cola runtime (append no `throwEscalation`) é da EC-5 (`pendencias.md §9`).

---

## 16. Handoff 19 (Compensação — Desfazer Governado) — decisões registradas

- **Errata do §0.2 do README (kind/glifo NÃO existiam):** a spec assumia que o kind `compensation`
  e o glifo rewind já existiam desde o H6. A reconciliação da CO-0 corrigiu contra a main real:
  `compensat` (case-insensitive) tem **zero** ocorrências em `core/src` e `react/src` —
  `EVENT_DEFINITION_KINDS` (`core/model/types.ts:243-252`) não inclui compensação e `eventGlyph`
  (`react/shapes/shapes.tsx`) não tem o caso. Kind e glifo são **NOVOS** (CO-1/CO-2), não extensão.
- **Nome interno do kind = `compensate` (não `compensation`):** o tag OMG é `compensateEventDefinition`;
  o serializer emite `bpmn:${kind}EventDefinition` e o deserializer extrai o prefixo por regex
  (`/^(.+)EventDefinition$/`), então **todo kind atual tem nome interno == prefixo OMG**. `compensate`
  round-trippa com **zero** special-case; o rótulo de UI é "compensação"/"compensa" (i18n). Validado
  pelo owner na CO-0.
- **`bpmn:association` já era aresta de primeira classe:** tipo embutido (`types.ts:234`), fora do
  fluxo (`flow.ts:22`), round-trip byte-estável já testado (`converter.test.ts:387`) e já na matriz
  de conformidade (`matrix.ts:82`). A compensação **reusa** a aresta (zero fork); o NOVO é criar a
  associação boundary⟲→handler + o veto estrutural + a semântica. CO-1 promove só
  `compensateEventDefinition`.
- **`isForCompensation` era descartado em silêncio no import:** `readNode` não tinha o ramo e
  `withForeignAttributes` só captura atributos com prefixo. Corrigido **dentro** da CO-1 (ler+emitir,
  default `false` omitido), sem micro-PR à parte.
- **Completados na simulação DERIVADOS da trilha:** `compensate()` lê as atividades já concluídas dos
  records `'move'`/`'end'` da trilha (sem novo `TransitionRecord`, para não arriscar byte-drift nos
  cenários das 4 famílias anteriores). Ambiguidade de loop (mesma atividade concluída 2×) é DECLARADA
  na CO-4 (última conclusão vence), não vira registro. Validado pelo owner na CO-0.
- **Veto estrutural cobre os DOIS lados (reforço da CO-1):** o handler (`isForCompensation`) não
  recebe nem emite sequence flow **E** o boundary ⟲ não emite sequence flow de saída (só associação);
  testes dos dois + negativo (boundary de erro continua emitindo fluxo normal).
- **Estilo de `association` é GLOBAL (CO-2, decisão 1):** o `edgeStyle` do tipo `association`
  (tracejado `3,3`, marcador `none` — sem seta de fluxo) vale para **toda** associação, não só a de
  compensação. É BPMN-correto (associação vive fora da sequência). Isso muda também associações de
  `textAnnotation` (antes sólidas com seta) — mudança INTENCIONAL e aprovada pelo owner. Nenhum
  snapshot commitado exercita marcador de associação, então a suíte react (567) passou sem
  atualização de snapshot; a mudança é visível no editor/export.
- **`compensableActivitiesOf` no CORE (CO-2, decisão 2):** fonte única scope-aware (atividades do
  MESMO escopo com boundary ⟲) que o picker (CO-2), o `COMP_REF_NOT_COMPENSABLE` (CO-3) e o
  `compensate()` (CO-4) consomem — zero fork, precedente `eligibleEscalationCatches`.
- **Marcador ◀◀ lê `isForCompensation` direto (CO-2, decisão 3):** não é `properties.marker`
  (loop/MI); coexiste com o loop marker (◀◀ desloca à esquerda quando há loop). Teste de coexistência.
- **Piso de cobertura por-pacote: checar com `--project <pkg> --coverage` (lição CO-3/CO-4):** o CI
  aplica pisos de branches por pacote (ex.: `lint`/`simulation` ≥85%) via `test:coverage`. O CI
  **constrói antes de testar**, então testes de OUTRO pacote (ex.: react) importam o alvo
  **construído (dist)** e NÃO contam para `<alvo>/src`. Localmente, sem build, importam a FONTE e
  inflam o número — mascarando a falha. A checagem fiel do piso de um pacote é
  `npx vitest run --project <pkg> --coverage` (só os testes do próprio pacote contam para
  `<pkg>/src`), rodada ANTES do push. `npx vitest run --coverage` agregado não substitui isso.
- **`compensate()` na simulação (CO-4, decisões A/B/C):** completados DERIVADOS da trilha (`'move'`
  edge.source atividade), última conclusão vence no loop (declarado); handler resolvido sim-side
  sobre a enumeração congelada do core (`compensableActivitiesOf`) via a associação do boundary;
  compensação sem ref-matching → **sem tiers** da ES-5 (broadcast = boundary-handlers + esub-starts
  do escopo juntos; específica = só aquele handler, esub-start não participa — declarado em
  `limitations.md`).
- **Planner `compensationPlan(activityRef?)` público + READ-ONLY (CO-5, decisão aprovada + reforço
  7):** o planner é a FONTE ÚNICA do plano de compensação — lê trilha/diagrama e **nunca muta
  estado**. Tanto o `compensate()` (grava + executa) quanto a cola do ledger (appenda o revertido
  EXECUTADO) o consomem, então os dois nunca re-derivam. Um alvo específico não-compensável ou
  não-concluído fica `blocked` e não produz passos → nada executa. Tipos `CompensationPlan`/
  `CompensationStep` exportados (type-only → apagam no runtime, fora do apiSurface).
- **A entrada do ledger amarra o plano EXECUTADO, não o previsto (CO-5, reforço 8):** o
  `compensationTriggeredEntry` (adapters-bpmn) é um builder PURO; o HOST appenda pelo callback
  `onCompensationTriggered` do `BpmnSimulator` (caminho a — motor intacto) **só quando a
  compensação ACONTECE**. Um alvo específico bloqueado (`plan.blocked`) appenda NADA. A entrada
  carrega `compensated` (ordem reversa) + `uncompensated` (declaradas); `details.author` prefixado
  `ia.copilot@` pinta o selo ✦ (regra do `aiAuthorOf`). Marco: a **família de gatilhos OMG**
  (message/signal/error/escalation/compensation) fica 100% completa.

---

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
  assinatura mágica válida, SVG bem-formado sem camadas transitórias).
- ~~Menu de contexto de aresta (§11.3, adiado do roteamento)~~ → entregue na N-5 do Handoff 11
  como ContextMenu plugável (§13).

*Se nada disto for prioridade agora, pode ignorar o arquivo — está aqui para não perder o
contexto das decisões em aberto.*
