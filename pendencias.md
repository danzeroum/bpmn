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
- **Ícones de linha da paleta core** (§5.5): a folha 07 desenha 16 ícones; as PRs 1–3 só trocaram
  os 6 do domínio. Trocar os core (`start`/`task`/`gateway`/…) por SVG ReactNode é retrocompatível
  (`PaletteItem.icon` já é `ReactNode`), mas mexe em `packages/react/src/ui/paletteItems.ts` e no
  `apiSurface` — fazer quando priorizado.
- **Regra de rotulação das tags (documentar):** só os *cards* levam a tag small-caps
  (SQUAD/PROMPT/CONNECTOR); formas geométricas auto-identificáveis (Persona pílula, Gate hexágono,
  Deliverable flâmula) não. Está comentado no topo de `shapes.tsx`; convém elevar ao handoff/futuro
  `CONFORMANCE.md` para o próximo shape não quebrar a consistência de arquitetura de informação.
- **Agrupamento da paleta** (Core / BuildToValue) com cabeçalhos — hoje é lista plana. Prepara o
  sub-menu de eventos da F6; é mudança de UI no `Palette.tsx`.
- **Export XES do ledger** (candidato pós-F8): o ledger hash-chained + o registry já são um event
  log. Exportar em XES habilitaria *process mining* do "processo real de design" vs. o documentado —
  diferencial que ferramentas de modelagem puras não têm. Sinergia: os critérios de aprovação do
  Gate btv são candidatos naturais a decision table quando a F9 (DMN) chegar.

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

## Resolvidas (para histórico)

- ~~Lane membership manual/data-only~~ → interativa na Fase 5a.
- ~~`messageFlow`/`association` ausentes do perfil XML~~ → mapeados de verdade na Fase 5a.
- ~~Pools/lanes marcados como "unreachable" pela validação~~ → corrigido na Fase 5a.
- ~~Exemplo sem raias / ícones de paleta~~ → paleta tem Pool/Lane; demo continua focado no
  domínio BTV (adicionar um exemplo com raias ao demo é trivial se você quiser).

*Se nada disto for prioridade agora, pode ignorar o arquivo — está aqui para não perder o
contexto das decisões em aberto.*
