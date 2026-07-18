---
'@buildtovalue/conformance': patch
---

Errata da matriz de conformidade (pré-Handoff 18): a linha `eventSubProcess`
ainda declarava `⛔ unsupported` ("Deliberately out of scope before v2.x."),
o que a main não pode afirmar depois do Handoff 17 — o event subprocess foi
entregue e está verde (ES-1..ES-5, PRs #128–#133). Corrigida via a fonte única
`packages/conformance/src/matrix.ts` para `✅ supported` / classe `analytic`,
mapeando para `subProcess (triggeredByEvent)` (contenção F7 reusada, helper
`isEventSubprocess`; starts tipados interrupting/não-interrupting round-trip
byte-estáveis; lint `EVT_SUBPROC_START`/`EVT_SUBPROC_FLOW`; precedência honesta
na simulação). `CONFORMANCE.md` regenerado pelo gerador (gate de frescor
intacto — `matrix.test.ts`). A matriz não pode mentir; fora do escopo do
Handoff 18.
