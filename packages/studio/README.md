# @bpmn-react/studio

BuildToValue Studio — the application layer for the three no-screen personas
(Handoff 6, S-4/S-5): shell + the generic Biblioteca screen + the Revisão do
Aprovador + the Ledger Explorer (Auditoria).

> Workspace-only until the npm-scope decision (pendencias.md §1). The final
> published name will be `<scope>/studio`.

## Shell

`<StudioShell user library review footer?>` — header with the three-screen
nav (Biblioteca | Revisão | Auditoria), hash-based navigation (state + URL
hash, **no external router** — §11) and the user identity. The Studio is
read-only + governance decisions; editing belongs to the Designer.

## Revisão do Aprovador (§5)

`<ReviewScreen candidates engine ledger actor registry? converter? baselineOf?
onDecided? onOpenInDesigner?>` — queue (296px) + review area (max 820px):

- **Queue** derived, never stored: candidate versions the user has not yet
  approved; progress ("1/2 aprovações") comes from the engine's approvals
  gate — the rule is NEVER re-implemented in the UI (`pendingPromotions`).
  Keyboard-navigable (arrows; §10.8).
- **Review blocks in order**: request header → change summary (solicitante's
  words) → diff vs baseline (the same `DiffView`, with "abrir no canvas →")
  → **verificações automáticas** 2×2 — every card a REAL call
  (`analyzeSoundness`, `certifyXml`, `verifyLedger`,
  `resolveCallActivities`; §10.4) → decision.
- **Decision**: approve records an `ApprovalRecord` via `engine.approve` AND
  an `APPROVAL_RECORDED` ledger entry; reject demands a 10+ char
  justification and writes `PROMOTION_REJECTED`. Both immutable — no undo;
  corrigir = novo ciclo. **Approving never activates**: a separação
  solicitante/aprovador é intencional (§11) — a solicitante executa a
  promoção final.

The headless halves (`pendingPromotions`, `runReviewChecks`,
`approvePromotion`, `rejectPromotion`) are exported and 100% testable
without DOM.

## Ledger Explorer (§6)

`<LedgerExplorer ledger registry? onAction? onDownload? initialFilter?>` —
filter bar + vertical trail (max 720px) + detail column (340px):

- **categorization is a pure studio function** (`categorizeEntry` /
  `filterEntries`): Promoções / Aprovações / Comandos / Verificações, chips
  with live counts, removable artifact context chip;
- **"Verificar cadeia"** runs `verifyLedger()`: green banner with n/n, head
  hash, algorithm and `VerificationReport.json` download; broken → red
  banner pointing at the exact `firstBreak` index, with that entry and every
  later one marked untrusted;
- **detail**: seq/hash/prev (visible chaining), author, payload, and a gold
  **ATTESTATION** block on activation entries (xmlHash, ledgerHeadHash,
  approvers, effectiveFrom + `attestation.json` download);
- **"Exportar XES"** feeds the SAME filtered entries to `toXES` — the export
  always matches what the trail shows (§10.5);
- actions ("Ver diff desta mudança", "Abrir versão no Designer (leitura)")
  are descriptors the host resolves; keyboard-navigable trail (§10.8).

## Styles

```ts
import '@bpmn-react/react/styles.css';
import '@bpmn-react/library-react/styles.css';
import '@bpmn-react/studio/styles.css';
```

Seal colors come exclusively from the canonical `--bpmnr-status-*` tokens
(§10.6); brand colors from `--btv-*`.
