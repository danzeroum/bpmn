---
'@buildtovalue/simulation': minor
'@buildtovalue/react': minor
---

Simulação do event subprocess (Handoff 17 ES-5, painel 4e): candidatos de
`throwError`/`throwSignal`/`throwMessage` passam a incluir os starts tipados
dos event subprocesses do escopo do token (elegibilidade via os helpers
fonte-única `isEventSubprocess`/`startIsInterrupting`); precedência do erro em
ordem TOTAL declarada (esub-exato > boundary-exato > esub-catch-all >
boundary-catch-all; >1 no tier vencedor = `BlockedDecision` nomeando
candidatos); token no CONTÊINER com descida declarada não-simulada;
interrupção nomeada na trilha (contagem de tokens cancelados + escopo, uma
vez por throw — os tokens recém-colocados pelo mesmo throw sobrevivem);
timer/conditional NUNCA auto-dispara — card manual novo
(`eventSubprocessOptions`/`fireEventSubprocess`, decisão `eventSubprocess`
ancorada em `atStep` para replay bit a bit); compat E-6: cenários sem event
subprocess replayam com trilha byte-idêntica. React: card manual no
`SimulationPanel` com o modo declarado (glifo+texto) e i18n EN/PT-BR;
limitations.md atualizado no mesmo PR.
