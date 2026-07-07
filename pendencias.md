# Pendências — decisões que deixei para você analisar

Documento vivo com os pontos onde parei por serem **decisões de produto/arquitetura** (não
apenas execução) ou por dependerem de credenciais/ações fora do repositório. Nada aqui bloqueia
o que já foi entregue.

Última atualização: Fase 5 (caminho para a v1.0).

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

## Resolvidas (para histórico)

- ~~Lane membership manual/data-only~~ → interativa na Fase 5a.
- ~~`messageFlow`/`association` ausentes do perfil XML~~ → mapeados de verdade na Fase 5a.
- ~~Pools/lanes marcados como "unreachable" pela validação~~ → corrigido na Fase 5a.
- ~~Exemplo sem raias / ícones de paleta~~ → paleta tem Pool/Lane; demo continua focado no
  domínio BTV (adicionar um exemplo com raias ao demo é trivial se você quiser).

*Se nada disto for prioridade agora, pode ignorar o arquivo — está aqui para não perder o
contexto das decisões em aberto.*
