---
'@buildtovalue/react': minor
---

#150 — CopilotPanel makes aplicar ≠ aprovar VISIBLE with three card states.

- PROPOSTA: a valid proposal arrives as a neutral card (diff summary + local
  soundness preview) and touches NOTHING; actions `[Aplicar no rascunho]`
  `[Descartar]` — the apply copy never says "accept/approve".
- APLICADA · NÃO APROVADA: applying executes the ONE composite through the
  normal CommandStack (RuleEngine/lint validate it like any edit; a veto is
  declared on the card). The card never disappears: amber pill + banner
  "passou pela mesma validação de qualquer edição; aprovação é ação separada";
  actions `[Desfazer]` (single undo) `[Ver diff]` `[Enviar p/ aprovação]`.
- APROVADA: the green pill paints ONLY from the host lifecycle signal — new
  optional props `onSubmitForApproval` (routes the intent) and
  `suggestionStatus` (registry/RBAC verdict by applied command id), mirroring
  the `promptStatus` precedent. Applying never changes lifecycle status.
- New `copilot.*` i18n keys (EN + PT-BR) for the pills, banner and actions.
