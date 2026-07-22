# @buildtovalue/forms

Schema de formulário versionado da plataforma BuildToValue (D3) — **formato
definitivo desde o início**: o artefato é persistido no registry
(`formId@versão`) e instância antiga exibe o formulário pinado.

- **Campos v1:** text, textarea, number, date, select, radio, checkbox
  (extras entram por minor).
- **`dataClassification` OBRIGATÓRIA** por campo (LGPD, G-LGPD-3):
  `public | internal | personal | sensitive`. `sensitive` implica no servidor
  (D20): cifrado via KeyProvider, mascarado por padrão, fora de logs/exports,
  não buscável por conteúdo.
- **Expressões S-FEEL** em `validation`/`visibleWhen` com a convenção do
  ADENDO-01 §4: `value` = o próprio campo; outras chaves = outros campos.
  **`value` é palavra reservada** — nunca pode ser `key` (validado).
- **Avaliação injetada** (`ExpressionEvaluator`): o pacote não importa
  `sfeel` — cliente e SERVIDOR validam a submissão com o MESMO schema e o
  mesmo avaliador (`validateSubmission`). Campo oculto por `visibleWhen` é
  ignorado e nunca exigido nem persistido; expressão inválida é erro
  declarado, nunca aprovação silenciosa.
