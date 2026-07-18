---
'@buildtovalue/lint': minor
'@buildtovalue/core': patch
---

feat(lint): escalação nas regras vivas + perfis 1.3.0 (Handoff 18 EC-4, §5d)

Escalação entra nas regras de lint pela MESMA fonte única (zero fork):

- **`EVT_REF_MISSING` ganha o kind**: `NAMED_REF_KINDS` ganha `escalation`; o
  quick-fix cria `bpmn:escalation` no bucket `escalations` (molde do «+», nunca
  genérica).
- **`EVT_ESCALATION_START_TOPLEVEL`** (erro): molde EXATO do de erro, consumindo
  o mesmo `isEventSubprocess` — concordância com a matriz E-4 testada nos dois
  lados (escalação não carrega I/O de engine, então a matriz a trata como null,
  DECLARADO; o predicado compartilhado é `isEventSubprocess`).
- **`ESC_NO_CATCH`** (WARNING, não erro): throw de escalação sem catch elegível.
  A razão de ser warning está no código — escalação sem destino DISSOLVE (legal
  na OMG, diferente de erro, que é parada). Destino via a fonte única do core
  `eligibleEscalationCatches` (boundaries + esub-starts; ref ou catch-all).
- **`EVT_ESCALATION_CATCH_ILLEGAL`** (reforço 8): um `intermediateCatchEvent` de
  escalação é ilegal (só boundary/esub-start capturam) — nunca silêncio sobre um
  catch que nenhum matching alcança. (Regra geral erro+escalação = follow-up em
  `pendencias.md`.)
- **`EVT_SUBPROC_START` ganha escalation** em `SUBPROC_TRIGGER_KINDS` — fecha o
  transitório EC-2→EC-4; os testes ES-4 que rejeitavam escalation migraram para
  positivos. `EVT_START_THROW`/`EVT_END_CATCH` revisadas (escalação legal em
  end-throw e esub-start).
- **Perfis 1.2.0 → 1.3.0** pela MESMA fonte — header do dock + `lintProfileAdapter`
  da Biblioteca refletem por construção (teste dedicado).

core (patch): `eligibleEscalationCatches(diagram, throwRef?)` — enumeração
headless diagram-wide (sem escopo/tiers) com retorno estruturado
`{node, catchKind, matchType}`; a EC-5 constrói a RESOLUÇÃO (escopo+tiers) por
cima sem re-derivar — o lint e a simulação nunca forkam a topologia de catch.
