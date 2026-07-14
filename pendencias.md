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

O **roteador A\* completo continua fora, de propósito** (esta era a parte cara). Um roteador
correto (visibility graph + A\*, ancoragem estável, recálculo incremental durante drag) é um
subsistema com orçamento de performance próprio; um meia-boca degradaria a UX atual. O core já
registra routers plugáveis, então dá para entregar como minor release (`1.x`) sem quebrar nada.

---

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
