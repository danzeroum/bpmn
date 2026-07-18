---
'@buildtovalue/lint': minor
'@buildtovalue/react': minor
'@buildtovalue/core': patch
---

Event subprocess lint (Handoff 17 ES-4, painel 4d): novas regras
`EVT_SUBPROC_FLOW` (fluxo de sequência tocando a casca — 1 finding por
aresta nomeando as duas pontas) e `EVT_SUBPROC_START` (exatamente 1 start
tipado entre os filhos DIRETOS — 0, >1 e sem-gatilho com mensagens
distintas; kind fora da lista aceita acusa nomeando os aceitos), quick-fix
mecânico só para 0 starts reusando o builder compartilhado
`typedMessageStartCommands` (a MESMA forma do composto da paleta ES-2),
aperto do `EVT_ERROR_START_TOPLEVEL` consumindo `isEventSubprocess`
(fonte única — concordância com a matriz de executáveis), perfis
etiquette/executability em 1.2.0. Core: o converter captura/emite
`triggeredByEvent`/`isInterrupting` por TAG OMG (subProcess/startEvent),
preservando os atributos mesmo quando o host mapeia a tag para um tipo
próprio via `preferredTypes`.
