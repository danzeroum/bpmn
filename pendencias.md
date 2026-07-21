# Pendências — o que está realmente aberto

Documento vivo com os pontos onde parei por serem **decisões de produto/arquitetura** (não
apenas execução) ou por dependerem de credenciais/ações fora do repositório. Nada aqui bloqueia
o que já foi entregue.

> **Só pendências abertas vivem aqui.** O histórico de decisões fechadas/registradas (handoffs
> 3–14, reconciliações, escopos decididos) foi extraído para [`DECISIONS.md`](DECISIONS.md) —
> ~60% deste arquivo era histórico, o que tornava o rastreio das pendências reais pouco
> confiável. A análise técnica de melhorias (com status de implementação) está em
> [`docs/melhorias.md`](docs/melhorias.md).

Última atualização: 2026-07-14 (separação pendências/decisões + rodada de melhorias).

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

---

## 1.1 Handoff 6 — "política" sem node type correspondente (decisão de produto)

O Handoff 6 S-2 pede um adapter de **política** para a Biblioteca, mas nenhum pacote de domínio
define um node type "política" hoje. O `policyAdapter` mapeia para o conceito mais próximo — o
Approval Gate (`btv:gate`) do domain-example — e a classificação aceita override explícito via
`diagram.metadata.artifactType: 'política'`. Se "política" deve ser um tipo próprio (com shape,
validação e vocabulário), é uma extensão de domínio a especificar; o adapter atual troca de
predicado em uma linha quando isso existir.

---

## 1.2 Handoff 6 — deep-link do "Abrir no Designer" (decisão de produto)

O Studio está entregue (S-1…S-6) e "Abrir no Designer" abre o editor real; **voltar** restaura
filtros e seleção da Biblioteca via URL (§10.7 ✅). O que ficou aberto: o Designer do `example`
não tem API de carregamento por `versionId`/`artifactId` via URL, então o deep-link abre o
editor com o diagrama demo padrão, não a versão exata do artefato clicado. Dar essa API ao host
(ex.: `?load=<versionId>` resolvendo no registry, com modo leitura para versões fechadas) é uma
extensão do Designer, fora do escopo do Handoff 6 — o descritor da ação já carrega
`artifactId`/`versionId`/`nodeId`, então o host só precisa resolvê-los quando essa API existir.

---

## 2. Roteador de arestas com desvio de obstáculos (mantido pós-1.0)

**Atualização (Handoff 7 — PR 0 ✅):** a variante barata ("offset nas portas na origem/destino")
foi implementada em `routeOrthogonal` (`packages/core/src/geometry/index.ts`, const
`DEFAULT_PORT_OFFSET = 16`): a rota ganha um "toco" perpendicular garantido saindo da origem e
entrando no destino antes de dobrar, então a aresta — e o token animado que a percorre no
Handoff 7 — deixa/entra o nó perpendicular, limpando o corpo e o canto arredondado r8 em vez de
raspar a borda. Rotas retas continuam colapsando (inalteradas); o offset é clampeado a metade da
distância âncora-a-âncora para não passar do nó vizinho em layouts apertados. Testes de
invariante em `geometry.test.ts`.

**Atualização (Handoff 10 ✅ — esta seção estava desatualizada):** o roteador A\* completo FOI
entregue em `core/geometry/astar.ts` (visibility/Hanan grid sobre os obstáculos inflados por
clearance, custo `comprimento + 2·dobras + 4·cruzamentos`, determinístico, com fallback
"sem corredor" sinalizado) e está plugável como `astarConnection` (`react/canvas/routers.ts`)
com cache por aresta e crossfade de settle (R-2b) — o app demo já o usa. **O que permanece
aberto**, agora com escopo honesto: (a) tornar o A\* o roteador PADRÃO (hoje é bezier; trocar
muda o visual de todos os hosts — decisão de produto + major visual); (b) recálculo
incremental DURANTE o drag (hoje a rota re-assenta no drop, por orçamento de frame — ligado ao
follow-up do worker em `DECISIONS.md`).

---

## 2.1 Rodada "referência de mercado" — o que ficou aberto dos itens 5–6

Da sequência de paridade/interop (2026-07): entregues context pad, auto-layout/align/
distribute/smart guides, busca Ctrl+F, `@buildtovalue/lint` (etiqueta + executabilidade) e
`complexGateway` nativo. Ficaram abertos, cada um com escopo próprio:

- ~~**Passthrough de extensões estrangeiras (`zeebe:*`/`camunda:*`)**~~ → ENTREGUE (PR dedicada,
  2026-07-18): `foreignExtensions`/`foreignAttributes` em nós/arestas,
  `processForeignExtensions`/`foreignNamespaces` no diagrama; round-trip semanticamente lossless,
  byte-estável entre exports, Δ nomeado no diff/review; contrato de trim/CDATA no format-spec.
  Segue fora: mapear `zeebe:taskDefinition` preservada para as regras `EXEC_*` do lint (hoje o
  host injeta via propriedades — funciona; a leitura direta do passthrough é follow-up opcional).
- **Deploy direto para engine (Camunda 8/Flowable)** — integração de rede/produto; o passthrough
  acima (entregue) o destravou do lado do arquivo.
- **Compensação/transação e coreografia** — extensão de cobertura BPMN aditiva (event definitions
  + marcadores + round-trip); especificar junto com a publicação comparativa da CONFORMANCE.

## 2.2 Handoff 14 (UX Craft) — estado da fila U-1..U-7

A reconciliação (`docs/design_handoff_btv_ux_craft/RECONCILIACAO.md`) é o
retrato congelado da U-1 (validada); o estado vivo é este:

- **U-1** reconciliação — ✅ validada (decisões: Esc no pad NÃO entra na pilha;
  1g vira U-7; todas as divergências ⚠ adotaram a spec).
- **U-2** context pad (1a) — ✅ validada 100%.
- **U-3** smart guides (1b) — ✅ validada 100% (padrão "export mid-gesture"
  adotado para toda superfície transiente).
- **U-4** busca (1c) — ✅ validada 100% (cap 8 + overflow registrado).
- **U-5** painel de lint (1d) — ✅ validada 100% (`TRANSIENT_ATTRIBUTES` adotado
  como evolução do export mid-gesture).
- **U-6** (última) — entregue, aguardando validação: auto-layout por PROPOSTA
  (card aplicar/recusar + contagens + crossfade 160ms + preview ghosts),
  translado rígido das 📍 via `translateManualEdges`, layered no import sem DI
  (corpus 61/61 medido antes), aba "Execução" (`BpmnPlugin.engine`, progressive
  disclosure, deploy gated VIGENTE+assinada), e 1g anexada (colunas comparativas
  "declarado pela doc deles" no CONFORMANCE.md).
- **Balanço final**: `docs/design_handoff_btv_ux_craft/RECONCILIACAO.md`
  atualizado — placar 42 ✅ + 2 📌 (passthrough `zeebe:*` adiado com aval da
  spec; publicação em site = pendência de produto). Não restam ⚠ nem ⬜.

## 3. Multi-pool / colaboração real (decisão de escopo de produto)

O perfil v1 é single-process: N pools exportam como N participants apontando para o **mesmo**
processo, e `messageFlow` cruza raias visualmente dentro dele. Colaboração de verdade (um
processo por pool, message flows entre processos separados) é outro modelo de dados. Precisa de
caso de uso concreto antes de investir.

---

## 4. Comportamento de swimlane "completo" (pós-1.0)

Entregue na Fase 5a: soltar um nó dentro de uma lane atualiza a membership (undoável, com
highlight do alvo), refs velhas são filtradas no export e apontadas pela regra
`STALE_LANE_REF`. Ficaram para uma fase "swimlane layout" pós-1.0, se você quiser:

- Arrastar a lane/pool levando os nós internos junto.
- Redimensionar uma lane empurrando/reflowando as lanes irmãs.

---

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
  usa PT ("EVENTOS"). ~~i18n da UI core é decisão de produto em aberto~~ → **RESOLVIDO (Handoff 11
  N-6)**: dicionário injetado por prop (`<BpmnDesigner messages>` / `<StudioShell messages>`),
  fallback EN completo embutido, `useT()`/`t('chave')` em TODAS as superfícies react/studio, e
  `PT_BR` como segundo dicionário oficial. Cerca de CI `check:no-hardcoded-strings` proíbe literal
  de UI nas superfícies migradas + verifica cobertura de chave. Labels autorais de plugin
  (`item.label`, `group.label`, tipos de nó) seguem sendo conteúdo do plugin — traduzidos na
  origem, não no dicionário do core (fronteira deliberada).
- **Export XES do ledger** — ✅ ENTREGUE (PR-B2, Handoff 4 §B2): `toXES(ledger, { registry })`
  no `@buildtovalue/audit` + `bpmn-react export-xes` no CLI. Cada versão = trace; comandos,
  promoções, attestations, registros e publicações = events com concept/time/org/lifecycle.
  Habilita *process mining* do "processo real de design" vs. o documentado (ProM, Celonis,
  Disco) — diferencial que ferramentas de modelagem puras não têm. Sinergia futura: os
  critérios de aprovação do Gate btv são candidatos naturais a decision table quando a F9
  (DMN) chegar.

---

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

---

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
- **Fluxo cruzando fronteira de subProcess (Handoff 17 ES-3, reforço 7):** o editor permite
  fluxo de sequência entre um FILHO de subProcess e um nó de fora — comportamento herdado do F7
  e IDÊNTICO para subProcess comum e event subprocess (paridade testada em
  `eventSubprocessInteractions.test.tsx`). A OMG não permite sequence flow cruzar a fronteira do
  contêiner; a restrição futura deve cobrir OS DOIS tipos de contêiner de uma vez (nunca
  divergência silenciosa entre eles) — provavelmente como regra de lint/validação, não veto de
  gesto, para não travar autoria incremental.

## 9. Handoff 18 (Escalation) — transitórios entre ECs (registrado, não bug)

Itens deferidos DE PROPÓSITO na sequência EC-0..EC-5 do Handoff 18, cada um com dono na EC seguinte
(sem quebra intermediária):

- ~~**Lista de kinds do lint `EVT_SUBPROC_START` (EC-2 → EC-4):**~~ → **RESOLVIDO na EC-4**:
  `escalation` entrou em `SUBPROC_TRIGGER_KINDS` — um start de escalação em event subprocess é
  legal no lint (testes ES-4 que o rejeitavam migrados para positivos). Transitório fechado.
- **Regra geral "catch-only kind no host errado" (follow-up da EC-4 reforço 8):** a EC-4 adicionou
  `EVT_ESCALATION_CATCH_ILLEGAL` (um `intermediateCatchEvent` de escalação é ilegal — só boundary/
  esub-start capturam escalação). O ERRO tem a mesma restrição e hoje NÃO é acusado nesse host; uma
  regra geral "kind catch-only em intermediateCatchEvent" cobrindo erro+escalação de uma vez é um
  follow-up nomeado (não silêncio: a escalação já é acusada; o erro fica registrado aqui).
- ~~**Cola runtime do `escalationRaisedEntry` no ledger (EC-3 → EC-5):**~~ → **RESOLVIDO na EC-5**:
  o simulador ganhou `throwEscalation` e o `BpmnSimulator` expõe o callback `onEscalationThrown`
  (path a — o motor fica PURO). O demo `?simulate=1&escalation=1` dispara a escalação pelo card
  «Escalar» e o host appenda `escalationRaisedEntry` de verdade (ator IA `ia.copilot@…` → selo ✦),
  com `target` nomeando o destino previsto. `ESCALATION_RAISED` = "a escalação ACONTECEU" (o disparo,
  não o desenho). Transitório fechado. O demo `?agentbridge=1` (EC-3) segue mostrando o DESENHO da
  ponte (agentTask + boundary governado + autoridade + revisão humana).

O que FICA como pendência do Handoff 18 (registrado, fora do escopo entregue):

- **Propagação da escalação além do escopo direto:** uma escalação não capturada no escopo direto
  DISSOLVE (no-op declarado); a subida pela cadeia de contêineres (o catch de um escopo externo) não
  é modelada — mesma fronteira declarada da propagação do erro (`limitations.md`). A semântica de
  matching em si JÁ é modelada (EC-5); só a propagação cross-escopo fica.
- **Compensação/coreografia:** segue como pendência anterior (nenhuma semântica de matching aqui) —
  independente da família de gatilhos OMG completada por este handoff.

---

## 10. Passe mobile / Chrome mobile (onda de produto futura)

**(decisão de produto — onda futura, não bug)** Levantado na triagem do Handoff 21 (notas do
bpmnPlay). O editor hoje é desenhado para desktop: os `pointer events` básicos funcionam em telas
de toque, mas **pinch-zoom e menus de long-press não são implementados** (registrado como limitação
em [`docs/limitations.md`](docs/limitations.md) — "Interaction"); os handoffs de design pedem alvos
de toque ≥44px, mas não há um passe de UX mobile completo (gestos, layout responsivo dos painéis,
paleta/inspector em telas estreitas).

Um **"passe mobile do Chrome"** — varredura de usabilidade em Chrome mobile, com gestos de toque de
primeira classe e adaptação responsiva das superfícies — é uma **onda de produto** própria, não um
defeito da entrega atual. Fica registrado aqui para não se perder; entra quando for priorizado
(depende de decisão de produto sobre quais superfícies ganham suporte mobile primeiro). A limitação
de toque em `limitations.md` continua sendo o contrato honesto até lá (nada falha em silêncio).

---

## 11. Squad Lane (Handoff 22) — refinamentos registrados

Abertos durante a SL-1 (revisão de arquitetura), **não bloqueiam** a entrega:

- **Fronteira efeito↔gate (SL-1 headless × SL-12 core).** A SL-1 emite, no `agentflow`, o código
  headless **`TOOL_EFFECT_UNGATED`** (error): uma tool de efeito `write-irreversible`/
  `external-commitment` cujo **próprio contrato** declara `authorization !== 'gate'` — lê SÓ o
  `ToolContract` injetado, nunca o processo (acidez preservada, §2.3). As regras de **processo** que o
  handoff §6 lista — `EFFECT_NEEDS_GATE` e `GATE_NOT_COVERING` ("gate que cubra a ação" sobre
  `reachableGateFrom`) — precisam do diagrama em volta e nascem no **core na SL-12**, reusando o
  predicado puro `effectRequiresGate(effect)`. Os nomes foram mantidos distintos de propósito para o
  revisor/host não lerem como duplicata; a SL-12 deve documentar a fronteira no PR.
- **`authorization: 'proibida'` em uso.** Uma tool marcada como proibida e ainda assim referenciada por
  um nó merece código próprio (ex.: **`TOOL_FORBIDDEN`**), não cair em `TOOL_EFFECT_UNGATED` nem passar
  em silêncio quando o efeito é `read`. Refinamento a implementar (candidato à SL-6, junto do Painel de
  Problemas), com vetor positivo/negativo/remediação.
- **Drag-into-node do catálogo (SL-2, cortado do MVP).** O binding de ferramenta na SL-2 é por
  **seletor/autocomplete** no inspector (impossível digitar string solta — cerca §2.2). Arrastar um card
  do catálogo da Biblioteca para DENTRO de um nó `tool` é um **gesto novo** (spec visual no protótipo 01)
  e fica como polimento registrado, não escopo do MVP. O `ToolProvider` já nasce injetável (SL-2), então
  o drag só precisa escrever o mesmo `usesTool` que o seletor já escreve.
- **Abas de Onda no nó `agentTask` do canvas principal (SL-5 → SL-12).** A Onda 1 (Identidade/Inteligência)
  vive no inspector do **AgentStudio**, onde `workflow` + `toolProvider` já são props (SL-2) — degradabilidade
  herdada, zero encanamento novo. O `agentTask` no canvas principal só carrega `agentWorkflowRef` +
  `autonomyLevel` (o `AgentWorkflow` não é embutido no nó, snapshot é leitura degradada), então dar-lhe as
  abas exigiria um **resolver de agent-workflow injetado no EditorConfig**. Isso fica para a **ponte (SL-12)**,
  quando o deep-link `?load=<versionId>` e o resolver já existirem. A infra reutilizável já está pronta:
  `InspectorSection.tab` (opcional) + tab-registration genérica no `PropertiesPanel` (SL-5).
