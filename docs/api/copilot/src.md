# copilot/src

## Interfaces

### CopilotAttribution

Who/what produced the accepted proposal (cerca §1.2 — immutable AI authorship).

#### Properties

##### providerId

```ts
providerId: string;
```

The injected provider's id, e.g. "claude-4" → author "ia.copilot@claude-4".

##### conversationId

```ts
conversationId: string;
```

Conversation id recorded with every applied proposal.

***

### CopilotPlan

#### Properties

##### command

```ts
command: Command;
```

ONE undoable composite — "Desfazer tudo" is a single undo (§8.3).

##### projected

```ts
projected: BpmnDiagram;
```

The diagram as it would look after applying the plan.

##### soundnessPreview

```ts
soundnessPreview: SoundnessPreview;
```

Computed locally from `projected` — never taken from the AI (§3).

***

### SoundnessErrorRef

A SND_* error surfaced to the fix flow (C5): enough to name the offender.

#### Properties

##### code

```ts
code: string;
```

##### message

```ts
message: string;
```

##### nodeId?

```ts
optional nodeId?: string;
```

##### edgeId?

```ts
optional edgeId?: string;
```

***

### CopilotPromptTemplate

The versioned prompt templates (cerca §1.5 — dogfooding): each is an
artifact with an id + version shown in the panel header and recorded in
ledger authorship. The Biblioteca adapter (CP-5) lists them from
COPILOT_PROMPTS below — the single canonical source the panel, the tests
and the adapter share.

#### Extends

- [`PromptTemplateRef`](#prompttemplateref)

#### Properties

##### system

```ts
system: string;
```

System prompt sent to the provider.

##### id

```ts
id: string;
```

###### Inherited from

[`PromptTemplateRef`](#prompttemplateref).[`id`](#id-2)

##### version

```ts
version: string;
```

###### Inherited from

[`PromptTemplateRef`](#prompttemplateref).[`version`](#version-1)

***

### Msg

One chat message exchanged with the provider.

#### Properties

##### role

```ts
role: "user" | "assistant";
```

##### content

```ts
content: string;
```

***

### AIProvider

The HOST-implemented AI transport (§1.4, the same injection pattern the
identity and anchor layers use). `complete` returns the raw model text; the
copilot layer parses and validates it — the model never touches state
directly.

#### Properties

##### id

```ts
id: string;
```

Provider/model identity recorded in ledger authorship, e.g. "claude-4".

#### Methods

##### complete()

```ts
complete(req): Promise<string>;
```

###### Parameters

###### req

###### system

`string`

###### messages

[`Msg`](#msg)[]

###### schema?

`object`

###### Returns

`Promise`\<`string`\>

***

### ProposedCommand

One proposed edit — `type` must be on the command whitelist (§1.3).

#### Properties

##### type

```ts
type: string;
```

##### params

```ts
params: Record<string, unknown>;
```

***

### PromptTemplateRef

Reference to the versioned prompt-template artifact used (§1.5).

#### Extended by

- [`CopilotPromptTemplate`](#copilotprompttemplate)

#### Properties

##### id

```ts
id: string;
```

##### version

```ts
version: string;
```

***

### SoundnessPreview

Locally computed soundness counts — NEVER supplied by the AI (§3).

#### Properties

##### errors

```ts
errors: number;
```

##### warnings

```ts
warnings: number;
```

***

### CopilotProposal

A parsed, not-yet-validated proposal from the provider (§3).

#### Properties

##### commands

```ts
commands: ProposedCommand[];
```

##### rationale

```ts
rationale: string;
```

Shown verbatim in the chat response.

##### promptTemplateRef

```ts
promptTemplateRef: PromptTemplateRef;
```

##### soundnessPreview?

```ts
optional soundnessPreview?: SoundnessPreview;
```

Filled in by [buildPlan](#buildplan) — a provider-supplied value is ignored.

***

### ProposalError

One validation failure — always names the offending command.

#### Properties

##### index

```ts
index: number;
```

Index into `proposal.commands`, or -1 for proposal-level problems.

##### message

```ts
message: string;
```

## Type Aliases

### LedgerQueryResult

```ts
type LedgerQueryResult = 
  | {
  ok: true;
  answer: string;
  citations: string[];
}
  | {
  ok: false;
  reason: string;
};
```

C6 — consulta ao ledger (Handoff 9 §4): the citability golden rule,
enforced LOCALLY. A provider answer is only surfaced when EVERY citation
resolves to a real entry hash the host supplied:

- no citations at all → there is no evidence, the UI must say
  "não encontrei registro" instead of the answer;
- ONE invented hash poisons the whole answer (the same integral-rejection
  posture as §1.3) — a fabricated citation IS invention.

Read-only like C3: these are pure functions over strings — nothing here can
append to (or even see) a ledger object.

***

### ProposalValidation

```ts
type ProposalValidation = 
  | {
  ok: true;
}
  | {
  ok: false;
  errors: ProposalError[];
};
```

Integral verdict (§1.3): a proposal is applied whole or not at all.

## Variables

### COPILOT\_DRAFT\_PROMPT

```ts
const COPILOT_DRAFT_PROMPT: CopilotPromptTemplate;
```

C1 — texto → rascunho.

***

### COPILOT\_ADJUST\_PROMPT

```ts
const COPILOT_ADJUST_PROMPT: CopilotPromptTemplate;
```

C2 — ajuste conversacional sobre o rascunho existente.

***

### COPILOT\_EXPLAIN\_PROMPT

```ts
const COPILOT_EXPLAIN_PROMPT: CopilotPromptTemplate;
```

C3 — explicar (read-only ABSOLUTO: sem comandos, sem ledger — a única
capacidade sem trilha, por design). Resposta em texto puro.

***

### COPILOT\_SUMMARY\_PROMPT

```ts
const COPILOT_SUMMARY_PROMPT: CopilotPromptTemplate;
```

C4 — change_summary proposto a partir do diff REAL; o humano edita e
assina — a IA nunca submete. Resposta em texto puro.

***

### COPILOT\_FIX\_PROMPT

```ts
const COPILOT_FIX_PROMPT: CopilotPromptTemplate;
```

C5 — fix de soundness: erro SND_* selecionado → correção como comandos.
A aplicação passa pelo MESMO pipeline da C2 (whitelist + rejeição íntegra +
soundness preview local) — um fix que não corrige fica visível porque a
lista de erros é recomputada localmente sobre o diagrama real.

***

### COPILOT\_QUERY\_PROMPT

```ts
const COPILOT_QUERY_PROMPT: CopilotPromptTemplate;
```

C6 — consulta ao ledger com citações. Regra de ouro (§10): toda afirmação
sustentada por hashes de entradas REAIS fornecidas no contexto; sem entrada
aplicável → "citations": [] (a UI dirá "não encontrei registro" — nunca
inventar). A validação local rejeita hashes que não existem no ledger.

***

### COPILOT\_PROMPTS

```ts
const COPILOT_PROMPTS: readonly CopilotPromptTemplate[];
```

The canonical registry of every versioned copilot template (cerca §1.5 —
dogfooding): one entry per capability, in the C1..C6 order of §4. This is
the single source the panel, the tests and the Biblioteca adapter (CP-5)
share — a new capability template MUST be added here, and the shipped
version of each entry is, by definition, the ACTIVE one.

***

### COMMAND\_WHITELIST

```ts
const COMMAND_WHITELIST: Record<string, CommandSpec>;
```

***

### WHITELISTED\_COMMANDS

```ts
const WHITELISTED_COMMANDS: string[];
```

The whitelisted command names — exported for the anti-drift test.

## Functions

### parseLedgerAnswer()

```ts
function parseLedgerAnswer(raw, knownHashes): LedgerQueryResult;
```

Parses the provider's raw completion for a ledger query and applies the
citability rule against `knownHashes` (the hashes of the REAL entries the
host passed as context). Malformed responses and un-citable answers come
back as structured `ok: false` — never an exception, never a bare answer.

#### Parameters

##### raw

`string`

##### knownHashes

`Iterable`\<`string`\>

#### Returns

[`LedgerQueryResult`](#ledgerqueryresult)

***

### parseProposal()

```ts
function parseProposal(raw): 
  | {
  proposal: CopilotProposal;
}
  | {
  error: string;
};
```

Parses the provider's raw completion into a [CopilotProposal](#copilotproposal).
Tolerates a ```json fence; anything else malformed is a structured error —
never an exception, never a partially-parsed proposal.

#### Parameters

##### raw

`string`

#### Returns

  \| \{
  `proposal`: [`CopilotProposal`](#copilotproposal);
\}
  \| \{
  `error`: `string`;
\}

***

### validateProposal()

```ts
function validateProposal(diagram, proposal): ProposalValidation;
```

Integral validation (cerca §1.3): EVERY command must be whitelisted and
well-formed against the current diagram, or the whole proposal is rejected
with readable errors naming each offending command. There is no partial
acceptance path.

#### Parameters

##### diagram

`BpmnDiagram`

##### proposal

[`CopilotProposal`](#copilotproposal)

#### Returns

[`ProposalValidation`](#proposalvalidation)

***

### buildPlan()

```ts
function buildPlan(
   diagram, 
   proposal, 
   attribution?): CopilotPlan;
```

Builds the executable plan for a VALIDATED proposal: materializes the
whitelisted commands, wraps them in one composite, projects the result on a
scratch stack (the live stack is untouched) and runs the REAL soundness
analysis over the projection. Call [validateProposal](#validateproposal) first; this
throws on an invalid proposal rather than applying it partially.

#### Parameters

##### diagram

`BpmnDiagram`

##### proposal

[`CopilotProposal`](#copilotproposal)

##### attribution?

[`CopilotAttribution`](#copilotattribution)

#### Returns

[`CopilotPlan`](#copilotplan)

***

### soundnessErrors()

```ts
function soundnessErrors(diagram): SoundnessErrorRef[];
```

The SND_* ERRORS of the current diagram, from the same LOCAL analyzer the
preview uses (C5, Handoff 9 §4). The fix flow lists (and re-lists) errors
based on THIS — so a "fix" that does not actually fix stays visibly listed:
honesty comes from re-analysis of the real diagram, never from the AI's
claim that it fixed something.

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

[`SoundnessErrorRef`](#soundnesserrorref)[]
