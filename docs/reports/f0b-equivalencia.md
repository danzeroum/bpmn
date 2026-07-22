# Relatório F0b.4 — Equivalência simulation×engine e corpus de replay

> **Data:** 2026-07-22 · **Responde:** itens 1–3 da triagem do dono sobre o
> aceite da F0b.4 (critério D10).

## 1. Por que projeções — e o que mudou após a triagem

O simulador e o engine diferem **por design** no ponto de parada: o
`simulation` é small-step (o token repousa em CADA nó e `advance()` o move um
salto — todo nó é um estado transiente observável), enquanto o engine roda até
a quiescência e só para em **espera** (user task, job, timer). Comparar
"estado a estado" literal exigiria igualar estados que num dos lados não
existem — por isso a equivalência é sobre o que os dois motores AFIRMAM.

O critério D10 ("mesma sequência de efeitos, tarefas e estado final") é
coberto em duas pernas complementares:

- **Efeitos e estado final, byte a byte** → CORPUS DE REPLAY
  (`tests/replay.test.ts`): para cada cenário, o par (estado canônico,
  efeitos canônicos) após **cada evento** é gravado em JSON comitado e
  reexecutado com identidade exigida por `canonicalJsonExact`. É a forma
  mais forte de "mesma sequência de efeitos" — qualquer reordenação, omissão
  ou duplicação de efeito quebra o fixture.
- **Tarefas e caminhada** → HARNESS DE EQUIVALÊNCIA
  (`tests/equivalence.test.ts`), agora com **igualdade de conjunto** (a
  triagem estava certa: ⊆ deixava passar espera OMITIDA em ramo paralelo com
  terminal idêntico):
  1. terminal: `complete`↔`completed`, `deadlocked`↔`incident(deadlock)`;
  2. rotas de gateway idênticas (aresta a aresta);
  3. **pontos de pausa: conjunto de esperas do engine == conjunto de
     elementos de tipo-espera visitados pelo simulador** — omissão agora
     falha;
  4. boundaries de timer armados pelo engine == boundaries anexados aos
     hosts de pausa visitados pelo simulador;
  5. `joinArrivals` residual equivalente (vazio ao completar; não-vazio dos
     dois lados em deadlock).

## 2. Corpus herdado — consumo integral e proporção honesta de skips

O harness agora importa **as 8 fixtures canônicas** de
`packages/simulation/tests/fixtures.ts`:

| Fixture herdada | Status no harness |
|---|---|
| `linear` | ✅ executada |
| `xorSplit` | ✅ executada (piloto: simulador segue as rotas do engine) |
| `andParallel` | ✅ executada |
| `trap` (XOR→AND) | ✅ executada — deadlock declarado nos DOIS motores |
| `threePaths` | ✅ caminho feliz executado; boundary: ver divergência abaixo |
| `nonInterruptingBoundary` | ✅ caminho feliz executado; idem |
| `orRegion` | ⏭ skip explícito `todo:F5` (OR fora do subset v1, D19) |
| `eventBased` | ⏭ skip explícito `todo:F5` (idem) |

Proporção real: **6 de 8 fixtures herdadas executam** (2 skips por elemento
fora do subset v1 — rejeitado no deploy pelo lint, D19). Os demais 5 skips
`todo:F5` do harness não são fixtures herdadas puladas: são **famílias
semânticas inteiras** do simulador sem contraparte no engine v1
(signal/message, error/escalation, event subprocess, compensação,
businessRuleTask), listadas nominalmente para reativação na F5.

Esperas que o corpus herdado não exercita (ele usa `task` genérica) têm
cenários autorados dedicados: **user task, service task/job, timer
intermediário (não-boundary)** — cobrindo os dois itens que a triagem
apontou como ausentes — XOR condicionado nas duas rotas, AND com esperas e
boundary timer sobre user/service task.

## 3. Divergência DECLARADA: boundary sobre task genérica

Nas fixtures herdadas `threePaths` e `nonInterruptingBoundary`, o boundary
está anexado a uma **task genérica**. No simulador qualquer nó é ponto de
repouso, então o boundary é disparável; no engine, task genérica é travessia
(não gera espera), logo **não há janela para o boundary armar** — o caminho
do boundary não existe. Postura v1: o **deploy lint restringirá boundary a
atividades de espera** (user/service task); o runtime já cobre o caminho
feliz dessas fixtures e os cenários autorados cobrem o boundary sobre hosts
de espera. Registrado aqui para o lint da F3.1 (D19) incluir a regra.

## 4. Higiene do replay (item 3 da triagem)

`UPDATE_REPLAY_FIXTURES=1` com `CI` setado agora **falha o job** na carga do
módulo de teste — regeneração de fixture de replay só acontece local e
deliberadamente (decisão consciente de major, D6). O CI nunca reescreve o
contrato.
