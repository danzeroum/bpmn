# domain-example/src

## Variables

### DOMAIN\_EDGE\_TYPES

```ts
const DOMAIN_EDGE_TYPES: readonly ["handoff", "approval", "feedback", "escalation"];
```

Domain edge types layered on top of the generic model.

***

### DOMAIN\_EDGE\_STYLES

```ts
const DOMAIN_EDGE_STYLES: Record<string, EdgeStyle>;
```

Visual language for the domain edge types (§5.4). Colors are `var(--btv-*)`
so dark mode and export stay correct; the EdgeRenderer composes these with
the closed/selected states. A handoff carries a purpose chip (paired with
`handoffNeedsPurposeRule`); an approval carries a check disc.

***

### DOMAIN\_NODE\_TYPES

```ts
const DOMAIN_NODE_TYPES: NodeTypeDefinition[];
```

Domain vocabulary mapped onto interoperable BPMN tags: exported files open
in any BPMN tool; the domain identity round-trips via extensionElements.

***

### gateSinglePredecessorRule

```ts
const gateSinglePredecessorRule: ValidationRule;
```

Approval gates accept a single predecessor (single-funnel approvals).

***

### squadNeedsPersonaRule

```ts
const squadNeedsPersonaRule: ValidationRule;
```

Every squad must have at least one persona connected.

***

### handoffNeedsPurposeRule

```ts
const handoffNeedsPurposeRule: ValidationRule;
```

Handoffs are contracts: they must declare a purpose.

***

### domainExamplePlugin

```ts
const domainExamplePlugin: BpmnPlugin;
```

The example domain plugin. Use it as-is or as a template for your own
vocabulary:

```tsx
<BpmnEditor diagram={diagram} plugins={[domainExamplePlugin]} />
```

***

### BTV\_PALETTE\_ICONS

```ts
const BTV_PALETTE_ICONS: Record<string, ReactNode>;
```

Ícones de linha da paleta (§5.5, folha 07) — substituem os emojis.
Grade 20px, traço 1.5, stroke na cor do próprio tipo via var(--btv-*)
com fallback. `PaletteItem.icon` é `ReactNode`, então entram como SVG.
Chaveados por nodeType para o plugin em index.ts consumir sem JSX.

## Functions

### SquadShape()

```ts
function SquadShape(__namedParameters): Element;
```

Squad: card índigo com glifo de time.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### PersonaShape()

```ts
function PersonaShape(__namedParameters): Element;
```

Persona: pílula âmbar com avatar e papel (role).

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### GateShape()

```ts
function GateShape(__namedParameters): Element;
```

Gate: hexágono; pendente (pausa dourada) ou aprovado (check verde).

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### PromptShape()

```ts
function PromptShape(__namedParameters): Element;
```

Prompt: nota ameixa com dobra de papel (a dobra É o chanfro do tipo).

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### ConnectorShape()

```ts
function ConnectorShape(__namedParameters): Element;
```

Connector: card azul de borda tracejada (fronteira externa) com plugue.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### DeliverableShape()

```ts
function DeliverableShape(__namedParameters): Element;
```

Deliverable: flâmula verde com filete interno (valor embalado).

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

## References

### default

Renames and re-exports [domainExamplePlugin](#domainexampleplugin)
