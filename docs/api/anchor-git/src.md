# anchor-git/src

## Interfaces

### GitAnchorTransport

Git transport the HOST injects (cerca §1.1 analogue for anchors — the library
never shells out to git nor does network). `commit` writes the anchor payload
(e.g. to a signed commit on an `anchors` ref) and returns a stable ref; `read`
reads it back, returning `undefined` when the store is unreachable.

#### Methods

##### commit()

```ts
commit(payload): Promise<{
  ref: string;
}>;
```

###### Parameters

###### payload

`string`

###### Returns

`Promise`\<\{
  `ref`: `string`;
\}\>

##### read()

```ts
read(ref): Promise<string | undefined>;
```

###### Parameters

###### ref

`string`

###### Returns

`Promise`\<`string` \| `undefined`\>

***

### GitAnchorOptions

#### Properties

##### now?

```ts
optional now?: () => string;
```

Clock injection for a deterministic `anchoredAt` (defaults to Date).

###### Returns

`string`

## Functions

### createGitAnchor()

```ts
function createGitAnchor(transport, options?): AnchorAdapter;
```

A git AnchorAdapter (Handoff 8 §3): anchors the chain head to a commit
via the injected transport and verifies a receipt against a current head hash.

`verify` reads the externally-stored head back through the transport:
- unreachable store → `unavailable` (drives the `pending` third state, §1.3);
- stored head === the passed current head → `anchored`;
- otherwise → `mismatch` (the chain was regenerated after anchoring — §4.2,
  the case a local hash-chain alone never detects).

The caller passes the CURRENT hash of the entry at `receipt.head.seq`, so a
chain that merely grew still verifies, while a rewritten one mismatches.

#### Parameters

##### transport

[`GitAnchorTransport`](#gitanchortransport)

##### options?

[`GitAnchorOptions`](#gitanchoroptions) = `{}`

#### Returns

`AnchorAdapter`
