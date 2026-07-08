# Pendências — decisões que deixei para você analisar

Documento vivo com os pontos onde parei por serem **decisões de produto/arquitetura** (não
apenas execução) ou por dependerem de credenciais/ações fora do repositório. Nada aqui bloqueia
o que já foi entregue.

Última atualização: design system de notação BuildToValue (PRs 1–3 do handoff).

---

## 1. Publicação no npm (ação sua, obrigatória para fechar a v1.0)

O release está preparado no repositório (versões `1.0.0`, `CHANGELOG.md`, workflow de
publicação), mas **publicar de fato exige duas ações que só você pode fazer**:

1. **Reservar o escopo `@bpmn-react` no npm** (criar a organização em npmjs.com) — ou me dizer
   qual escopo usar (`@buildtovalue/bpmn-*`? outro?). Se o escopo já estiver tomado por
   terceiros, precisamos renomear os pacotes *antes* do primeiro publish.
2. **Adicionar o secret `NPM_TOKEN`** no GitHub (Settings → Secrets → Actions) com um token de
   automação do npm. O workflow `release.yml` roda em `workflow_dispatch` com `dry_run=true` por
   padrão — dá para validar tudo sem publicar; desmarque o dry-run quando quiser soltar.

**Atualização (Handoff 6 — decisão agora URGENTE):** o BuildToValue Studio adiciona **4 pacotes
novos** que precisam do escopo definido antes de qualquer publish: `<scope>/library`,
`<scope>/library-react`, `<scope>/studio` e `<scope>/adapters-bpmn`. Enquanto a decisão não sai,
eles seguem o padrão do `dmn`/`healthcare`: nome provisório `@bpmn-react/<x>` + `"private": true`
(workspace-only, isentos do release). Nada é publicado sem a sua decisão (Handoff 6 §11). A
recomendação registrada no handoff continua sendo `@buildtovalue/*`.

## 1.1 Handoff 6 — "política" sem node type correspondente (decisão de produto)

O Handoff 6 S-2 pede um adapter de **política** para a Biblioteca, mas nenhum pacote de domínio
define um node type "política" hoje. O `policyAdapter` mapeia para o conceito mais próximo — o
Approval Gate (`btv:gate`) do domain-example — e a classificação aceita override explícito via
`diagram.metadata.artifactType: 'política'`. Se "política" deve ser um tipo próprio (com shape,
validação e vocabulário), é uma extensão de domínio a especificar; o adapter atual troca de
predicado em uma linha quando isso existir.

## 2. Roteador de arestas com desvio de obstáculos (mantido pós-1.0)

Continua fora, de propósito. Um roteador correto (visibility graph + A\*, ancoragem estável,
recálculo incremental durante drag) é um subsistema com orçamento de performance próprio; um
meia-boca degradaria a UX atual. O core já registra routers plugáveis, então dá para entregar
como minor release (`1.x`) sem quebrar nada. Se quiser algo imediato e barato: melhorar o
ortogonal para desviar dos nós de origem/destino (offset nas portas) — consigo fazer com
segurança, me diga se prioriza.

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
  no `@bpmn-react/audit` + `bpmn-react export-xes` no CLI. Cada versão = trace; comandos,
  promoções, attestations, registros e publicações = events com concept/time/org/lifecycle.
  Habilita *process mining* do "processo real de design" vs. o documentado (ProM, Celonis,
  Disco) — diferencial que ferramentas de modelagem puras não têm. Sinergia futura: os
  critérios de aprovação do Gate btv são candidatos naturais a decision table quando a F9
  (DMN) chegar.

## 6. Boundary events — interação de anexação (pós-F6 PR-B)

O modelo, o round-trip XML (`attachedToRef` + `cancelActivity` + `eventDefinition`), o render
(anel duplo sólido/tracejado) e o **ride-along** (arrastar o host move os boundary events
anexados) já estão entregues. Ficaram para uma PR de interação dedicada:

- **Anexar por drag-and-drop:** soltar um evento sobre a borda de uma activity define
  `attachedToRef` e o posiciona na borda. Hoje o vínculo é criado por import ou via `properties`.
- **Deslizar na borda e reflow no resize:** ancoragem por parâmetro `t ∈ [0,1]` por lado (§6.5 do
  handoff) para o evento acompanhar o redimensionamento do host mantendo a posição relativa. Hoje o
  boundary guarda coordenadas absolutas e só acompanha o *move* do host.
- **Roteamento das saídas do boundary:** usar port-offset no roteador ortogonal (barato) antes do
  A\* com desvio de obstáculos (já registrado no item 2).

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
    canvas, DI hierárquico), `callActivity` (sinergia com `@bpmn-react/registry` `activeAt`),
    `dataStore` + `dataAssociation`. Meta: classe OMG **Descriptive 100%**.

### Ainda no roadmap (F8→F10, intocado)
- **F8** validação XSD opcional (CLI/Node), corpus de interop ≥50 arquivos externos, `CONFORMANCE.md`
  gerado, declarar classe **Analytic**.
- **F9** DMN — novo pacote `@bpmn-react/dmn` (decision table + DRD mínimo).
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
  rodar `pnpm --filter @bpmn-react/example dev` + `/?stress=350` numa máquina local com GPU para a
  verificação final; o gate de zoom desliga sombras (<50%) e chips (<60%) para proteger a taxa em
  diagramas densos.

## Resolvidas (para histórico)

- ~~Lane membership manual/data-only~~ → interativa na Fase 5a.
- ~~`messageFlow`/`association` ausentes do perfil XML~~ → mapeados de verdade na Fase 5a.
- ~~Pools/lanes marcados como "unreachable" pela validação~~ → corrigido na Fase 5a.
- ~~Exemplo sem raias / ícones de paleta~~ → paleta tem Pool/Lane; demo continua focado no
  domínio BTV (adicionar um exemplo com raias ao demo é trivial se você quiser).

*Se nada disto for prioridade agora, pode ignorar o arquivo — está aqui para não perder o
contexto das decisões em aberto.*
