# Pendências — decisões que deixei para você analisar

Documento vivo com os pontos onde parei por serem **decisões de produto/arquitetura** (não
apenas execução) ou por estarem, na minha avaliação, além do que consigo entregar sozinho com
segurança sem quebrar produção. Nada aqui bloqueia o que já foi entregue — são próximos passos.

Última atualização: implementação da Fase 4 (pools/lanes no perfil XML).

---

## 1. Roteador de arestas com desvio de obstáculos (avaliação pedida na Fase 4)

**Situação atual:** as arestas usam Bézier cúbica (padrão) ou ortogonal simples (Manhattan em
L, com colapso de waypoints colineares). Nenhum dos dois desvia de nós no caminho — uma aresta
pode cruzar por cima de uma tarefa.

**Avaliação:** implementar um roteador que evita obstáculos de verdade (estilo bpmn.io/A\*) é
**significativo** e, no meu julgamento, está no limite do que dá para fazer autonomamente sem
risco de regressão. Envolve:

- Grid de navegação / visibility graph a partir das bounding boxes de todos os nós;
- Busca de caminho (A\* ou Dijkstra) com penalização de curvas e proximidade;
- Simplificação do caminho + ancoragem estável nas portas (senão a aresta "pula" a cada
  micro-movimento);
- Recalcular de forma incremental e barata durante drag (hoje o `routeOrthogonal` é O(1); um
  A\* ingênuo a 60fps num diagrama de 300 nós não fecha o orçamento de performance que
  documentamos).

**Minha recomendação:** tratar como item **pós-1.0**, próprio, com uma interface de roteador
plugável (o core já registra routers), para não acoplar ao MVP. Se você quiser que eu avance,
sugiro fazer numa PR isolada e dedicada, com benchmark de performance como critério de aceite.
**Não implementei nesta rodada de propósito** — quis evitar entregar um roteador meia-boca que
piorasse a experiência atual. Preciso do seu aval para priorizar.

**Alternativa barata (se quiser algo já):** melhorar o ortogonal atual para desviar só do nó de
origem/destino (offset mínimo nas portas) — isso eu consigo fazer com segurança. Me diga se
vale.

---

## 2. Pools/lanes — fronteiras do MVP entregue

O que **entreguei** (Fase 4): tipos `pool` e `lane` no core, render como swimlane (contêiner
atrás do fluxo), ida-e-volta no XML (`collaboration`/`participant` + `laneSet`/`lane`/
`flowNodeRef`), DI com `isHorizontal`, itens de paleta, testes de round-trip e de z-order.

Ficaram **deliberadamente de fora** (precisam de decisão sua):

1. **Contenção geométrica / membership automática.** Hoje `lane.properties.flowNodeRefs` é dado
   puro: arrastar um nó para dentro de outra lane **não** atualiza a associação sozinho. Fazer
   isso direito exige hit-test de contêiner no drop, realce da lane-alvo e um comando que
   atualiza o `flowNodeRefs` de forma undoável. É viável, mas muda a semântica de drag e quero
   seu ok no comportamento esperado (ex.: mover nó move a lane junto? redimensionar a lane
   reflowa os filhos?).

2. **Multi-pool / colaboração real.** O MVP é single-process: N pools são exportados como N
   participants referenciando o **mesmo** processo. Colaboração de verdade (múltiplos processos,
   `messageFlow` entre pools) é outro modelo de dados e não cabe no MVP. Precisa de decisão de
   escopo.

3. **Redimensionar/auto-reflow de lanes.** Lanes hoje são retângulos independentes; não há
   "quando eu aumento a lane 2, empurra a lane 3". Comportamento de swimlane completo é um
   subsistema à parte.

**Minha recomendação:** deixar 1 e 3 para uma fase "swimlanes interativas" e 2 para quando
houver caso de uso concreto de colaboração entre processos. O MVP atual já cobre "desenhar e
trocar por XML um diagrama com raias".

---

## 3. Pontos menores (posso resolver sozinho quando você confirmar prioridade)

- **App de exemplo** não tem ainda um diagrama demonstrando raias. Posso adicionar um botão
  "inserir exemplo com pool/lanes" no demo — é seguro, só não quis inflar a PR da Fase 4.
- **Ícones de paleta** para pool/lane são caracteres unicode (▤ / ▬); se quiser SVG próprios,
  me avise.

---

*Se nenhum destes for prioridade agora, pode ignorar o arquivo — está aqui só para não perder o
contexto das decisões que ficaram em aberto.*
