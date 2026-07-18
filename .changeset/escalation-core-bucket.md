---
'@buildtovalue/core': minor
'@buildtovalue/conformance': patch
---

feat(core): escalation como o 4º bucket nomeado (Handoff 18 EC-1, §5a)

Escalation entra nas MESMAS fontes únicas da E-1/E-3 (zero fork), completando a
família de gatilhos OMG pelo caminho já pavimentado:

- **Modelo aditivo**: `EscalationEventDefinition { id, name, escalationCode? }`
  (molde exato do `errorCode`, código omitido quando indefinido); `EventDefinitions`
  ganha `escalations` (opcional/aditivo — `eventDefinitionsOf` preenche o bucket
  ausente, então o resto do core o trata como sempre-presente).
- **Fonte única**: `EVENT_DEFINITION_REF_KINDS`/`EVENT_DEFINITION_BUCKETS`/`ID_PREFIX`
  (prefixo `esc`) ganham o kind; os comandos parametrizados (add id auto `esc-1`,
  update `name`/`escalationCode`, remoção vetada listando usos, rename cascata 1
  undo) e a resolução de picker/refs seguem por construção.
- **Converter OMG**: root `<bpmn:escalation id name escalationCode?/>` na ordem do
  XSD (após error, antes do process); `escalationRef` no child dos 4 hosts (throw
  intermediate/end, catch boundary + start de event subprocess); órfã sintetiza com
  warning; round-trip byte-estável (fixpoint com o anchor de boundary re-derivado).
- **Neutralidade congelada**: fixture nova `escalationFrozen.json` (bucket ausente/
  vazio = bytes e hash idênticos); `eventDefsFrozen`/`passthroughFrozen`/
  `eventSubprocFrozen` intactas.
- **CONFORMANCE**: promove `bpmn:escalation` (root) via o gerador; `certify` passa a
  mapear os roots de definição nomeada (message/signal/error/escalation) — lacuna
  latente da H16 que o 1º corpus com root de definição expôs. Corpus real novo
  `59-escalation-v1.bpmn` (root + boundary não-interrupting + end throw) importa com
  significado pleno e 0 warnings.

Fora da EC-1 (próximas PRs): glifo/paleta/chips/autoridade (EC-2), ponte
agente→humano + ledger (EC-3), regras de lint + perfis 1.3.0 (EC-4),
`throwEscalation`/dissolve/limitations (EC-5).
