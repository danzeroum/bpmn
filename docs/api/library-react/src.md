# library-react/src

## Interfaces

### ArtifactCardProps

#### Properties

##### item

```ts
item: ArtifactSummary;
```

##### selected

```ts
selected: boolean;
```

##### onSelect

```ts
onSelect: () => void;
```

###### Returns

`void`

##### messages?

```ts
optional messages?: Messages;
```

i18n dictionary (#151) — prop wins, then ancestor provider, then English.

***

### ArtifactDrawerProps

#### Properties

##### detail

```ts
detail: ArtifactDetail;
```

##### onAction

```ts
onAction: (ref, action) => void;
```

###### Parameters

###### ref

`ArtifactRef`

###### action

`ArtifactAction`

###### Returns

`void`

##### onClose

```ts
onClose: () => void;
```

###### Returns

`void`

##### messages?

```ts
optional messages?: Messages;
```

i18n dictionary (#151) — prop wins, then ancestor provider, then English.

***

### LibraryViewProps

#### Properties

##### adapters

```ts
adapters: ArtifactAdapter[];
```

The only source of artifacts — no prop knows concrete types (§4).

##### onAction

```ts
onAction: (ref, action) => void;
```

The host resolves action descriptors (open in Designer, diff…) (§3.2).

###### Parameters

###### ref

`ArtifactRef`

###### action

`ArtifactAction`

###### Returns

`void`

##### initialQuery?

```ts
optional initialQuery?: LibraryQuery;
```

##### onQueryChange?

```ts
optional onQueryChange?: (query) => void;
```

Fired on every query change so the host can sync URL state (§10.7).

###### Parameters

###### query

`LibraryQuery`

###### Returns

`void`

##### initialSelection?

```ts
optional initialSelection?: ArtifactRef;
```

Restores a selection (deep link / back navigation — §10.7).

##### onSelectionChange?

```ts
optional onSelectionChange?: (ref) => void;
```

Fired on every selection change so the host can sync URL state (§10.7).

###### Parameters

###### ref

`ArtifactRef` \| `undefined`

###### Returns

`void`

##### onWarning?

```ts
optional onWarning?: (warning) => void;
```

###### Parameters

###### warning

`AdapterWarning`

###### Returns

`void`

##### messages?

```ts
optional messages?: Messages;
```

i18n dictionary (#151) — same contract as the other surfaces: this prop
wins, then an ancestor `<I18nProvider>`, then the per-key English
fallback. Omitted with no provider → English, unchanged default.

***

### UseLibraryOptions

#### Properties

##### adapters

```ts
adapters: ArtifactAdapter[];
```

##### initialQuery?

```ts
optional initialQuery?: LibraryQuery;
```

##### onQueryChange?

```ts
optional onQueryChange?: (query) => void;
```

###### Parameters

###### query

`LibraryQuery`

###### Returns

`void`

##### initialSelection?

```ts
optional initialSelection?: ArtifactRef;
```

Restores a selection (deep link / back navigation — §10.7).

##### onSelectionChange?

```ts
optional onSelectionChange?: (ref) => void;
```

Fired on every selection change so the host can sync URL state (§10.7).

###### Parameters

###### ref

`ArtifactRef` \| `undefined`

###### Returns

`void`

##### onWarning?

```ts
optional onWarning?: (warning) => void;
```

###### Parameters

###### warning

`AdapterWarning`

###### Returns

`void`

***

### UseLibraryState

#### Properties

##### query

```ts
query: LibraryQuery;
```

##### setQuery

```ts
setQuery: (next) => void;
```

###### Parameters

###### next

`LibraryQuery`

###### Returns

`void`

##### result

```ts
result: LibraryResult | undefined;
```

##### selected

```ts
selected: ArtifactRef | undefined;
```

##### select

```ts
select: (ref) => void;
```

###### Parameters

###### ref

`ArtifactRef` \| `undefined`

###### Returns

`void`

##### detail

```ts
detail: ArtifactDetail | undefined;
```

##### adapters

```ts
adapters: readonly ArtifactAdapter[];
```

## Functions

### ArtifactCard()

```ts
function ArtifactCard(__namedParameters): Element;
```

Gallery card (Handoff 3 §5): 108px thumb with dot-grid + type chip, name,
seal row (the SAME StatusBadge as everywhere — §10.6) + channel + pinned
runs, free meta line. A button, so the grid is keyboard-navigable as-is.

#### Parameters

##### \_\_namedParameters

[`ArtifactCardProps`](#artifactcardprops)

#### Returns

`Element`

***

### ArtifactDrawer()

```ts
function ArtifactDrawer(__namedParameters): Element;
```

Detail drawer (Handoff 3 §5 / Handoff 6 §4): kicker, name, seal, then
ONLY the sections the adapter provided — optional fields → optional UI,
never "N/A". Actions are descriptors the host resolves (§3.2); the drawer
renders buttons and mutates nothing.

#### Parameters

##### \_\_namedParameters

[`ArtifactDrawerProps`](#artifactdrawerprops)

#### Returns

`Element`

***

### LibraryView()

```ts
function LibraryView(__namedParameters): Element;
```

TELA 1 — Biblioteca (Handoff 6 §4, visual spec Handoff 3 §5): status chips
(fixed vocabulary), type chips (one per registered adapter — dynamic),
search, sortable card grid and the detail drawer. Read-only by
construction: the only outbound calls are `onAction` descriptors.

#### Parameters

##### \_\_namedParameters

[`LibraryViewProps`](#libraryviewprops)

#### Returns

`Element`

***

### Thumbnail()

```ts
function Thumbnail(__namedParameters): Element;
```

Places the thumbnail the adapter provided (§3.1): SVG string, named icon,
or nothing. The library never draws domain shapes itself — the SVG comes
ready from the adapter (trusted host-registered code, not user input).

#### Parameters

##### \_\_namedParameters

###### spec?

`ThumbnailSpec`

#### Returns

`Element`

***

### useLibrary()

```ts
function useLibrary(options): UseLibraryState;
```

The headless-to-React seam of the Biblioteca: query state, catalog results,
selection + drawer detail, and adapter invalidation (subscribe → reload).
All catalog logic lives in @buildtovalue/library; this hook only wires state.

#### Parameters

##### options

[`UseLibraryOptions`](#uselibraryoptions)

#### Returns

[`UseLibraryState`](#uselibrarystate)
