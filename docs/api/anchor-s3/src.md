# anchor-s3/src

## Interfaces

### S3Transport

S3 client the HOST injects — the library never does network. `put` writes the
anchor object (ideally to an object-lock/WORM bucket so it is write-once);
`get` reads it back, returning `undefined` when the object is unreachable.

#### Methods

##### put()

```ts
put(key, body): Promise<{
  versionId?: string;
}>;
```

###### Parameters

###### key

`string`

###### body

`string`

###### Returns

`Promise`\<\{
  `versionId?`: `string`;
\}\>

##### get()

```ts
get(key): Promise<string | undefined>;
```

###### Parameters

###### key

`string`

###### Returns

`Promise`\<`string` \| `undefined`\>

***

### S3AnchorOptions

#### Properties

##### prefix?

```ts
optional prefix?: string;
```

Key prefix for anchor objects (default "anchors/").

##### now?

```ts
optional now?: () => string;
```

Clock injection for a deterministic `anchoredAt` (defaults to Date).

###### Returns

`string`

## Functions

### createS3Anchor()

```ts
function createS3Anchor(transport, options?): AnchorAdapter;
```

An S3 object-lock AnchorAdapter (Handoff 8 §3): anchors the chain head
to a write-once object keyed by seq+hash.

- unreachable object → `unavailable` (drives the `pending` third state);
- stored head === the passed current head → `anchored`;
- otherwise → `mismatch` (the chain was regenerated after anchoring).

#### Parameters

##### transport

[`S3Transport`](#s3transport)

##### options?

[`S3AnchorOptions`](#s3anchoroptions) = `{}`

#### Returns

`AnchorAdapter`
