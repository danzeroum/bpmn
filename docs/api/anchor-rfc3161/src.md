# anchor-rfc3161/src

## Interfaces

### Rfc3161Transport

RFC 3161 TSA transport the HOST injects — the library never talks to the TSA
over the network. `timestamp` requests a token over the head digest; `verify`
asks the host (or a local validator) whether a token attests the given digest.

#### Methods

##### timestamp()

```ts
timestamp(digest): Promise<{
  token: string;
  genTime: string;
}>;
```

###### Parameters

###### digest

`string`

###### Returns

`Promise`\<\{
  `token`: `string`;
  `genTime`: `string`;
\}\>

##### verifyToken()

```ts
verifyToken(token, digest): Promise<boolean>;
```

###### Parameters

###### token

`string`

###### digest

`string`

###### Returns

`Promise`\<`boolean`\>

## Functions

### createRfc3161Anchor()

```ts
function createRfc3161Anchor(transport): AnchorAdapter;
```

An RFC 3161 timestamp AnchorAdapter (Handoff 8 §3): anchors the chain
head to a TSA timestamp token.

- request/validation error → `unavailable` (drives the `pending` third state);
- token attests the current head digest → `anchored`;
- otherwise → `mismatch` (the head changed after timestamping).

#### Parameters

##### transport

[`Rfc3161Transport`](#rfc3161transport)

#### Returns

`AnchorAdapter`
