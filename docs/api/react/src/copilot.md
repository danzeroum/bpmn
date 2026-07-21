# react/src/copilot

## Interfaces

### CopilotPanelProps

Copilot panel (Handoff 9 CP-2, §6 UX): 372px chat surface where the AI
DRAFTS and humans stay in charge. Header shows the provider, the versioned
prompt-template and the `SÓ RASCUNHA` pill; every AI response carries a
mono footer with authorship, the applied command id (ledger-traceable) and
the LOCALLY computed soundness preview. "Desfazer tudo" reverts the whole
plan in one undo. Without a provider the panel renders nothing and the
editor is unchanged (§8.5).

#150 (N-3) — aplicar ≠ aprovar made VISIBLE: a valid proposal arrives as a
card in state PROPOSTA (nothing touches the diagram); `[Aplicar no
rascunho]` executes the ONE composite through the normal CommandStack
(RuleEngine/lint validate it like any edit) and the card — which never
disappears — turns APLICADA · NÃO APROVADA (amber pill + banner).
APROVADA (green) is only ever painted from the HOST's lifecycle signal
(`suggestionStatus`), never by the act of applying.

#### Properties

##### provider?

```ts
optional provider?: AIProvider;
```

HOST-injected transport (§1.4). Absent → the panel does not render.

##### resolveLedgerHash?

```ts
optional resolveLedgerHash?: () => Promise<string | undefined>;
```

Resolves the ledger hash to show in the response footer after a proposal
is applied (the host owns the ledger). Optional — footer omits the line.

###### Returns

`Promise`\<`string` \| `undefined`\>

##### author?

```ts
optional author?: string;
```

Human co-author shown in the mixed-authorship seal (e.g. "ana.ruiz").

##### promptStatus?

```ts
optional promptStatus?: (template) => string | undefined;
```

CP-5 (cerca §1.5): lifecycle status of a template as the host's Biblioteca
knows it — e.g. "ativa" when the shipped version is the active one. Shown
after the version in the header ("prompt: copilot-draft v1.0.0 ativa").
Omitted → header unchanged.

###### Parameters

###### template

`PromptTemplateRef`

###### Returns

`string` \| `undefined`

##### onSubmitForApproval?

```ts
optional onSubmitForApproval?: (info) => void;
```

#150: host hook behind `[Enviar p/ aprovação]` on an APPLIED card — the
panel only ROUTES the intent (the lifecycle/registry/RBAC live in the
host). Omitted → the button is not rendered.

###### Parameters

###### info

###### commandId

`string`

###### Returns

`void`

##### suggestionStatus?

```ts
optional suggestionStatus?: (commandId) => "approved" | undefined;
```

#150: the HOST's lifecycle verdict for an applied suggestion, by the
applied command id — the ONLY source that ever paints the green
APROVADA pill. Applying never changes lifecycle status; omitting this
prop means no suggestion is ever shown as approved.

###### Parameters

###### commandId

`string`

###### Returns

`"approved"` \| `undefined`

## Functions

### CopilotPanel()

```ts
function CopilotPanel(__namedParameters): Element | null;
```

#### Parameters

##### \_\_namedParameters

[`CopilotPanelProps`](#copilotpanelprops)

#### Returns

`Element` \| `null`
