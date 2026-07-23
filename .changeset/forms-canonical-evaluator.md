---
'@buildtovalue/forms': minor
---

Avaliador S-FEEL CANÔNICO de formulários: `formExpressionEvaluator` (novo
export) passa a ser o padrão de `validateSubmission` — a MESMA implementação no
preview do cliente e na validação do servidor. Fecha a divergência histórica em
que o servidor validava só igualdade (`variavel = literal`) enquanto o preview
aceitava comparações e `and`/`or`: `visibleWhen`/`validation` como `value > 5000`
ou `value > 0 and value <= 50000` agora valem idênticas nos dois lados.

`validateSubmission` deixa de exigir um avaliador injetado (o parâmetro segue
opcional, para testes/casos especiais); expressão fora do subconjunto v1 continua
retornando `{ error }` — nunca um booleano silenciosamente errado.

Também novo: o CORPUS de conformidade `SFEEL_FORM_CORPUS` (com o veredito
esperado por caso) publicado no subpath `@buildtovalue/forms/corpus` — fixture
de teste fora do bundle de runtime. É a fonte única contra a qual consumidores
(ex.: buildtovalue-platform) afirmam equivalência, permitindo apagar cópias
locais sem perder a checagem de drift.
