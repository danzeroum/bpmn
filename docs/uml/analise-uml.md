# Análise UML Completa — `bpmn-react` (monorepo `@buildtovalue/*`)

> Documento gerado por análise estática de **todo** o código-fonte do repositório
> (`packages/*/src`), dos arquivos de configuração de pacote (`package.json`,
> `tsconfig`, `pnpm-workspace.yaml`) e da documentação de arquitetura existente
> (`docs/architecture.md`, `docs/plugins.md`, `README.md`).
>
> Objetivo: mapear **como cada módulo/pacote se conecta ao todo** — dependências,
> fluxos de dados e responsabilidades — para permitir estudo aprofundado de
> arquitetura e refatoramentos futuros.
>
> Todos os diagramas usam **Mermaid** (renderiza nativamente no GitHub). A escolha
> é deliberada: prioriza utilidade imediata no próprio repositório sobre a notação
> UML estrita do PlantUML. Onde a notação Mermaid diverge do UML canônico, a
> legenda de cada seção explica o mapeamento.

---

## 0. Nota crítica sobre o escopo "multi-linguagem"

O prompt de origem pressupõe um repositório **Python + Rust + TypeScript**. A
inspeção recursiva revela que **isso não se aplica a este repositório**:

| Extensão | Arquivos | Observação |
|---|---|---|
| `.ts` | 357 | Lógica de domínio, engines, persistência, CLIs, testes |
| `.tsx` | 118 | Componentes React (canvas, shapes, chrome, painéis) |
| `.py` | 0 | **Ausente** |
| `.rs` | 0 | **Ausente** |
| `.d.ts` | 0 dedicados | Tipos são co-localizados no `.ts` de origem |

Total: **475 arquivos-fonte TypeScript**, `Node >= 20`, gerenciados por **pnpm
workspaces** (`packageManager: pnpm@10.33.0`), em **24 pacotes** publicáveis sob o
escopo `@buildtovalue/*`.

**Consequência para a análise.** As seções específicas de Python (decoradores,
ABCs, metaclasses) e Rust (traits, ownership, `Arc/Mutex`, macros) do prompt
**não têm correspondência** e são justificadamente omitidas (ver §10). Em
compensação, a "fronteira multi-linguagem" real deste sistema é substituída por
três fronteiras internas igualmente relevantes, que este documento trata com o
mesmo rigor:

1. **Fronteira domínio ↔ apresentação** — `@buildtovalue/core` é TypeScript puro,
   *zero dependência de runtime e zero React* (roda em browser, Node e Web
   Workers); `@buildtovalue/react` é a única camada que conhece o DOM/React.
2. **Fronteira de interoperabilidade por formato** — **BPMN 2.0 XML** e **DMN 1.3
   XML** são o "contrato entre linguagens" com ferramentas externas (Camunda
   Modeler, bpmn.io). São o equivalente aos "DTOs compartilhados via geração de
   código" mencionados no prompt.
3. **Fronteira ports & adapters (hexagonal)** — transportes de confiança
   (`Signer`, `AnchorAdapter`, `AIProvider`, `RegistrySink`, `AuditSink`,
   `DecisionEvaluator`) são **injetados pelo host** e nunca implementados dentro
   das bibliotecas. É aqui que o sistema toca rede, criptografia de chave privada
   e LLMs — sempre do lado de fora.

---

## 1. Mapeamento estrutural (top-down)

### 1.1 Mapa de pacotes e responsabilidades

Todos os pacotes são **ESM + CJS dual-build**, `sideEffects:false`. Os pacotes
"shipped" têm **zero dependências de runtime** (garantido em CI por
`scripts/check-no-runtime-deps.mjs`).

| Camada | Pacote | Responsabilidade (1 linha) | Depende de (`@buildtovalue/*`) |
|---|---|---|---|
| **Domínio** | `core` | Engine de domínio: modelo, comandos, eventos, lifecycle, regras, validação, diff, ledger, geometria, XML | — (zero) |
| **Apresentação** | `react` | Canvas SVG, shapes, gestos, chrome do editor, store visual externo, plugins | agentflow, copilot, core, identity, replay, simulation |
| | `example` | App-demo Vite exercitando todos os modos | (quase todos) |
| **Governança** | `registry` | Registro consultável de versões: validade temporal (`activeAt`), canais/ambientes, linhagem, pinagem de execução | core |
| | `audit` | `verifyLedger`, `attestVersion`, `toXES`, assinaturas, caso de garantia SACM | core, identity, registry |
| **Confiança** | `identity` | Assinatura/verificação Ed25519 offline, RBAC, **contrato `AnchorAdapter`** | core |
| | `anchor-git` | Ancora o head do ledger num commit/ref Git | identity |
| | `anchor-rfc3161` | Ancora num token TSA RFC 3161 | identity |
| | `anchor-s3` | Ancora num objeto S3 WORM (object-lock) | identity |
| **Análise** | `soundness` | Análise estrutural (deadlock/livelock/dead-branch) O(V+E) | core |
| | `simulation` | Engine de tokens (XOR/AND/event/boundary), cobertura, cenários | core |
| | `replay` | Token-replay/conformance sobre log de eventos (grafo injetado) | — (zero) |
| | `conformance` | Corpus de interoperabilidade + matriz OMG + `certifyXml` | core |
| **Família BPMN** | `dmn` | Tipos/shapes DRD + conversor DMN 1.3 XML + avaliador de decisão | core, react, sfeel |
| | `sfeel` | Parser/avaliador do subconjunto S-FEEL ("contrato de honestidade") | — (zero) |
| | `healthcare` | Plugin de vocabulário clínico (305°) | core, react |
| | `domain-example` | Plugin-template de domínio (squads/personas/gates) | core, react |
| **IA governada** | `copilot` | Copiloto: `AIProvider` injetado, proposta→comandos whitelisted, prévia de soundness | core, soundness |
| | `agentflow` | Modelo JSON de sub-workflow de agente (llm/tool/decision + autonomia 0–5) | — (zero) |
| **Catálogo** | `library` | Contrato `ArtifactAdapter` + busca/filtro/ordenação headless | — (zero) |
| | `library-react` | Galeria React dirigida pelo contrato | library, react |
| | `adapters-bpmn` | `ArtifactAdapter`s concretos sobre o registry + thumbnails SVG | agentflow, copilot, core, library, registry, replay, simulation |
| **Aplicação** | `studio` | Shell BuildToValue Studio: navegação por hash + fila de revisão do aprovador | audit, conformance, copilot, core, identity, library, library-react, react, registry, soundness |
| | `cli` | CLI headless: `validate`, `certify`, `export`, `diff`, governança | audit, conformance, core, registry, soundness |

### 1.2 Fronteiras de sistema e mecanismos de comunicação

```mermaid
flowchart LR
  subgraph Externo["Mundo externo"]
    Camunda["Camunda Modeler / bpmn.io"]
    Git[("Git remoto")]
    TSA[("Autoridade TSA<br/>RFC 3161")]
    S3[("Bucket S3 WORM")]
    LLM["Provedor LLM<br/>(host)"]
    LG["LangGraph / A2A"]
  end

  subgraph Runtime["Runtime do host (browser / Node / worker)"]
    React["@buildtovalue/react<br/>(DOM, React 18)"]
    Core["@buildtovalue/core<br/>(TS puro, headless)"]
    Gov["Governança + Confiança<br/>(registry, audit, identity, anchors)"]
    CLI["@buildtovalue/cli<br/>(Node)"]
  end

  Camunda <-->|"BPMN 2.0 / DMN 1.3 XML<br/>(round-trip)"| Core
  React -->|"Command / RuleVerdict"| Core
  CLI -->|"loadDiagram / promote / certify"| Core
  Gov -->|"AnchorAdapter.anchor()"| Git
  Gov -->|"timestamp()"| TSA
  Gov -->|"put() WORM"| S3
  React -.->|"AIProvider.complete()"| LLM
  Core -.->|"importLangGraph / exportLangGraph"| LG
```

**Notação:** setas cheias = chamada síncrona/contrato compilado; setas tracejadas
= transporte **injetado pelo host** (a biblioteca define a *porta*, o host provê o
*adaptador*). O XML é o único canal bidirecional de dados entre "linguagens"
(ferramentas externas).

Não há **REST/gRPC/WebSocket** entre os pacotes: tudo é **in-process** (chamadas de
função sobre estruturas imutáveis). A única concorrência real é (a) o **Web Worker
executor** (`packages/react/src/workers/`) para trabalho off-main-thread e (b) a
**fila de Promises** interna do `AuditLedger`/`VersionRegistry` que serializa
escritas. Ver §8.

### 1.3 Dependências externas (por gerenciamento de pacote)

- **Runtime (shipped):** **nenhuma** em `core`, `registry`, `audit`, `identity`,
  `anchors`, `replay`, `library`, `agentflow`, `sfeel`, `soundness`,
  `simulation`, `conformance`, `copilot`. `react`/`library-react`/`dmn`/
  `healthcare`/`domain-example` têm apenas `react`/`react-dom` como **peerDependencies**.
- **Dev/toolchain (raiz):** `typescript ^5.7`, `vitest ^3.2`, `@vitest/coverage-v8`,
  `eslint ^9` + `typescript-eslint`, `prettier`, `typedoc` + `typedoc-plugin-markdown`,
  `jsdom`, `@testing-library/react`, `axe-core`, `react ^18.3`.
- **Guardas de CI** (`scripts/`): `check-no-runtime-deps`, `check-no-key-generation`,
  `check-no-hardcoded-strings`, `check-docs-fresh`; mais `pnpm audit --audit-level=high`.

---

## 2. Padrões arquiteturais detectados

| Padrão | Onde | Evidência |
|---|---|---|
| **Command** (reversível, puro) | `core/commands` | `Command { execute, undo, toAuditEvent? }`; fábricas `addNodeCommand`, `moveNodeCommand`, … |
| **Command Stack + cursor git-like** | `CommandStack` | executar após `undo` descarta o "futuro"; `limit=200` |
| **Composite** | `compositeCommand(...)` | agrupa operações de gesto em um passo de undo |
| **Interceptor / Chain of Responsibility** | `RuleEngine implements CommandInterceptor` | veto `command.pre` antes de mutar |
| **Observer com prioridade + veto + transform** | `EventBus` | handler retorna `false` cancela, valor≠undefined transforma payload |
| **Registry** | `NodeTypeRegistry` | autoridade de tipos; plugins registram tipos custom |
| **Plugin declarativo** | `BpmnPlugin` (react) | objeto puro: `nodeTypes`, `shapes`, `paletteItems`, `validationRules`, `registerRules`, `edgeRouter`, `lifecycleConfig`, hooks |
| **Factory functions** | `factory.ts`, `commands.ts`, `create*Adapter` | tudo criado por função, sem `new` no consumidor |
| **Repository + imutabilidade temporal** | modelo + registry | elementos nunca deletados fora de `draft`: `removedInVersion`, `supersedesEdgeId` |
| **State machine governada** | `LifecycleEngine` | `DEFAULT_TRANSITIONS`; ausência deliberada de `deprecated→active` |
| **Ledger com hash-chain** | `AuditLedger` | SHA-256 encadeado; `verify()` detecta adulteração |
| **Ports & Adapters (hexagonal)** | transportes injetados | `Signer`, `AnchorAdapter`, `AIProvider`, `RegistrySink`, `AuditSink`, `DecisionEvaluator`, `XmlParserAdapter`, `Serializer` |
| **Strategy** | roteadores de aresta | `bezier` / `orthogonal` / `straight` / `astar` / função custom |
| **Facade** | `BpmnXmlConverter`, `DmnXmlConverter` | orquestram serializer/deserializer/DI/extension internos |
| **External store / seletor granular** | `createStore` + `useCanvasState` | `useSyncExternalStore` com `shallowEqual` |
| **CQRS-ish (read model)** | `registry` vs `core` | `VersionRegistry` é modelo de leitura consultável sobre versões imutáveis |
| **Dependency Inversion (seams)** | `agentTask`, `copilot`, `simulation` | `PromotionRule`, `DecisionEvaluator`, `AIProvider` evitam imports concretos |

**Camadas identificadas** (de baixo para cima, cf. `docs/architecture.md`):
domínio (`core`) → governança/confiança/análise → família BPMN & IA →
apresentação (`react`) → catálogo → aplicação (`studio`, `cli`). Entidades de
**domínio** (`BpmnNode`, `BpmnEdge`, `BpmnVersion`) são estritamente separadas de
**infraestrutura** (XML, hash, anchors) e **aplicação** (studio/cli/example).

---

## 3. Diagrama de Casos de Uso

**Objetivo:** identificar atores e as funcionalidades principais do sistema.
**Escopo:** todo o toolkit, do desenho ao selo de auditoria.

```mermaid
flowchart TB
  Modelador(["👤 Modelador<br/>(Process Designer)"])
  Aprovador(["👤 Aprovador / Revisor"])
  Auditor(["👤 Auditor"])
  Integrador(["👤 Integrador / Dev do host"])
  Copiloto(["🤖 Copiloto de IA"])
  ExtBPMN(["⬛ Camunda / bpmn.io"])
  ExtTrust(["⬛ Git / TSA / S3"])

  subgraph SUT["Sistema — bpmn-react"]
    UC1(["Modelar diagrama BPMN/DMN"])
    UC2(["Editar com undo/redo"])
    UC3(["Validar estrutura"])
    UC4(["Analisar soundness"])
    UC5(["Importar/Exportar BPMN 2.0 XML"])
    UC6(["Certificar conformidade OMG"])
    UC7(["Promover versão (lifecycle)"])
    UC8(["Aprovar + assinar (Ed25519)"])
    UC9(["Ancorar cadeia (trust anchor)"])
    UC10(["Auditar ledger / exportar XES"])
    UC11(["Simular tokens / cobertura"])
    UC12(["Replay de log de execução"])
    UC13(["Editar tabela de decisão DMN"])
    UC14(["Modelar workflow de agente"])
    UC15(["Propor edição via copiloto"])
    UC16(["Navegar catálogo de artefatos"])
  end

  Modelador --- UC1 & UC2 & UC5 & UC11 & UC13 & UC14
  Aprovador --- UC7 & UC8 & UC16
  Auditor --- UC10 & UC6 & UC16
  Integrador --- UC5 & UC12 & UC16
  Copiloto --- UC15
  ExtBPMN --- UC5
  ExtTrust --- UC9

  UC1 -.->|"«include»"| UC3
  UC7 -.->|"«include»"| UC3
  UC7 -.->|"«include»"| UC4
  UC7 -.->|"«extend»"| UC8
  UC8 -.->|"«extend»"| UC9
  UC7 -.->|"«include»"| UC10
  UC15 -.->|"«include»"| UC2
  UC15 -.->|"«include»"| UC4
  UC6 -.->|"«include»"| UC5
  UC11 -.->|"«extend»"| UC13
```

**Notas de design:**
- **Modelador** dispara a maioria dos casos de escrita; toda edição passa por
  `Command` (auditável, reversível). A validação (`UC3`) é `«include»` da modelagem
  e da promoção — um único ponto de verdade (`ValidationEngine`).
- A **promoção** (`UC7`) é o coração da governança: inclui validação e soundness,
  e *estende-se* com assinatura (`UC8`) e ancoragem (`UC9`) quando o host injeta
  `Signer`/`AnchorAdapter`. Aprovar **nunca ativa** — regra de negócio explícita
  do `studio/review/decide.ts`.
- **Copiloto de IA** é ator de sistema, restrito ao caminho de proposta→comando
  *whitelisted* (`UC15`): jamais promove, aprova ou assina (imposto por CI —
  `copilot` não tem caminho de import para `identity`).

---

## 4. Diagrama de Pacotes

**Objetivo:** organização lógica e dependências entre pacotes.
**Escopo:** os 24 pacotes do workspace. Setas = "depende de" (runtime, salvo nota).

```mermaid
flowchart BT
  classDef domain fill:#1f6feb22,stroke:#1f6feb;
  classDef trust fill:#d2992222,stroke:#d29922;
  classDef analysis fill:#3fb95022,stroke:#3fb950;
  classDef pres fill:#a371f722,stroke:#a371f7;
  classDef app fill:#f8514922,stroke:#f85149;

  core["core"]:::domain
  registry["registry"]:::trust
  identity["identity"]:::trust
  audit["audit"]:::trust
  anchorGit["anchor-git"]:::trust
  anchorRfc["anchor-rfc3161"]:::trust
  anchorS3["anchor-s3"]:::trust
  soundness["soundness"]:::analysis
  simulation["simulation"]:::analysis
  replay["replay"]:::analysis
  conformance["conformance"]:::analysis
  sfeel["sfeel"]:::analysis
  dmn["dmn"]:::analysis
  healthcare["healthcare"]:::analysis
  domainEx["domain-example"]:::analysis
  agentflow["agentflow"]:::app
  copilot["copilot"]:::app
  library["library"]:::app
  react["react"]:::pres
  libReact["library-react"]:::pres
  adapters["adapters-bpmn"]:::app
  studio["studio"]:::app
  cli["cli"]:::app

  registry --> core
  identity --> core
  audit --> core & identity & registry
  anchorGit --> identity
  anchorRfc --> identity
  anchorS3 --> identity
  soundness --> core
  simulation --> core
  conformance --> core
  sfeel -.->|zero deps| core
  dmn --> core & react & sfeel
  healthcare --> core & react
  domainEx --> core & react
  copilot --> core & soundness
  react --> core & identity & copilot & agentflow & replay & simulation
  libReact --> library & react
  adapters --> core & registry & library & agentflow & copilot & simulation & replay
  studio --> core & registry & soundness & conformance & audit & identity & copilot & react & library & libReact
  cli --> core & audit & conformance & registry & soundness
```

**Notas de design:**
- **`core` é a raiz de tudo** (in-degree máxima, out-degree zero) — o *stable
  dependencies principle* está respeitado: quanto mais dependido, mais estável e
  abstrato.
- **Três pacotes têm zero dependências** propositalmente: `sfeel`, `agentflow` e
  `replay` (e `library`). São ilhas reutilizáveis — `replay` raciocina sobre um
  grafo *injetado* (`ReplayGraph`), não sobre `BpmnDiagram`, e por isso nem
  importa `core`.
- **Acoplamento aferente perigoso?** `react` depende de 6 pacotes (incl.
  `copilot`, `agentflow`, `simulation`, `replay`) — é o maior fan-out da camada de
  apresentação. Ver §11 (oportunidade de extrair sub-pacotes `react/*`).
- **`adapters-bpmn` é dependência de runtime de ninguém** neste conjunto (só
  devDep de `library-react` e `studio`): os adaptadores concretos são
  *injetados pelo host* em `LibraryView.adapters` / `StudioShell.library`.
- `simulation → dmn → sfeel` **não é** dependência de compilação: é uma cadeia de
  *injeção em runtime* (o host passa `createSfeelDecisionSupport(diagram)` como
  `SimulationOptions.decisions`). `simulation` define a porta `DecisionEvaluator`;
  `dmn` a satisfia estruturalmente sem importar `simulation`.

---

## 5. Diagrama de Componentes

**Objetivo:** componentes de software em runtime e suas interfaces de comunicação.
**Escopo:** um host típico (editor + governança) mais o CLI e serviços externos.

```mermaid
flowchart TB
  subgraph Host["Aplicação host (browser)"]
    direction TB
    Editor["«component» React Editor<br/>BpmnDesigner / BpmnEditor / BpmnViewer"]
    Store["«store» Canvas Store<br/>(estado visual, useSyncExternalStore)"]
    DiagCtx["«context» DiagramContext<br/>(CommandStack)"]
    Config["«config» EditorConfig<br/>(resolveEditorConfig ← plugins)"]
    Worker["«worker» executor<br/>(off-main-thread jobs)"]
  end

  subgraph CoreEngine["«component» core (headless)"]
    CS["CommandStack"]
    RE["RuleEngine"]
    Bus["EventBus"]
    LE["LifecycleEngine"]
    VE["ValidationEngine"]
    AL["AuditLedger"]
    XML["BpmnXmlConverter"]
  end

  subgraph Gov["«subsystem» Governança & Confiança"]
    Reg["VersionRegistry"]
    Aud["audit: verifyLedger / attest / toXES"]
    Id["identity: signApproval / verify"]
    Anchor["AnchorAdapter (git/rfc3161/s3)"]
  end

  subgraph Analysis["«subsystem» Análise"]
    Snd["soundness"]
    Sim["simulation"]
    Rep["replay"]
    Conf["conformance"]
  end

  StudioApp["«component» Studio shell<br/>(Biblioteca / Revisão / Auditoria)"]
  CLIApp["«component» CLI bpmn-react"]
  Cat["«component» Library catalog<br/>(ArtifactAdapter*)"]

  ExtTools["⬛ Camunda / bpmn.io"]
  ExtTrust["⬛ Git / TSA / S3"]
  ExtLLM["⬛ Provedor LLM"]

  Editor -->|"execute(Command)"| DiagCtx --> CS
  CS -->|"intercept"| RE
  CS -->|"fire()"| Bus
  Bus -->|"priority -100"| AL
  Editor --> Store
  Editor --> Config
  Config -.->|resolve| VE & RE & LE
  Editor -.->|"postMessage"| Worker
  XML <-->|"BPMN 2.0 XML"| ExtTools

  StudioApp -->|"pendingPromotions"| LE
  StudioApp -->|"runReviewChecks"| Snd & Conf & Aud & Reg
  StudioApp -->|"signApproval"| Id
  StudioApp -->|"anchor()"| Anchor --> ExtTrust
  StudioApp --> Cat
  Editor -.->|"AIProvider.complete()"| ExtLLM

  CLIApp --> XML & LE & VE & Reg & Aud & Conf & Snd
  Reg --> XML
  Aud --> Id & Reg
```

**Interfaces de comunicação (portas):**

| Porta (interface) | Definida em | Implementada por | Protocolo |
|---|---|---|---|
| `Command` / `CommandInterceptor` | `core/commands` | `RuleEngine`, fábricas de comando | in-process |
| `EventHandler` (bus) | `core/events` | `AuditLedger`, listeners de plugin | in-process, síncrono |
| `XmlParserAdapter` | `core/xml/adapter` | `MiniXmlAdapter`, `DomXmlAdapter` | in-process |
| `Serializer<T>` | `core/persistence` | `JsonSerializer` | in-process |
| `AnchorAdapter` | `identity` | `anchor-git/rfc3161/s3` (transporte injetado) | Git / TSA / S3 |
| `Signer` | `identity` | host (chave privada nunca cruza) | Web Crypto |
| `AIProvider` | `copilot` | host | LLM (fora da lib) |
| `RegistrySink` / `AuditSink` | `registry` / `core` | host (DB/API/arquivo) | persistência |
| `DecisionEvaluator` | `simulation` | `dmn` (via `sfeelSupport`) | injeção runtime |
| `ArtifactAdapter` | `library` | `adapters-bpmn` | in-process |

**Notas de design:** o `EventBus` é o único hub de eventos e é **interno ao
`core`** — a camada React **não** o consome; a observabilidade do editor usa o
canal separado `onEditorEvent` (catálogo `EDITOR_EVENTS`, contrato semver). O
`AuditLedger` conecta-se ao `CommandStack` como *listener de baixa prioridade
(−100)*, garantindo que observa o payload final após transformações.

---

## 6. Diagramas de Classe (por camada)

Quebrados em subdiagramas para legibilidade (critério de "clareza" do prompt).
**Legenda Mermaid → UML:** `..|>` realização (implements) · `--|>` herança ·
`*--` composição · `o--` agregação · `-->` associação · `..>` dependência ·
`<<interface>>` estereótipo.

### 6.1 Camada de Domínio — modelo `«entity»` / `«value-object»`

**Objetivo:** as estruturas de dados imutáveis e serializáveis que todo o sistema
compartilha. **Origem:** `packages/core/src/model/types.ts`.

```mermaid
classDiagram
  class BpmnDiagram {
    <<entity>>
    +string id
    +string name
    +string description
    +BpmnVersion version
    +Record~string~ nodes
    +Record~string~ edges
    +Record metadata
  }
  class BpmnVersion {
    <<entity>>
    +string id
    +string semanticVersion
    +VersionStatus status
    +ApprovalRecord[] approvedBy
    +string changeSummary
    +string snapshotHash
    +string parentVersionId
    +effectiveFrom / effectiveUntil
  }
  class BpmnNode {
    <<entity>>
    +string id
    +string type
    +string label
    +number x, y, width, height
    +Record properties
    +string createdInVersion
    +string removedInVersion
    +AuditTrail audit
  }
  class BpmnEdge {
    <<entity>>
    +string id
    +string type
    +string sourceId
    +string targetId
    +string supersedesEdgeId
    +Point[] waypoints
    +AuditTrail audit
  }
  class ApprovalRecord {
    <<value-object>>
    +string userId
    +string role
    +string approvedAt
    +string reason
  }
  class AuditTrail {
    <<value-object>>
    +string createdAt
    +string createdBy
    +AuditEventRecord[] history
  }
  class UserContext {
    <<value-object>>
    +string id
    +string role
    +string name
  }
  class Rect {
    <<value-object>>
  }
  Point <|-- Rect
  Size <|-- Rect
  BpmnDiagram *-- BpmnVersion
  BpmnDiagram *-- "0..*" BpmnNode
  BpmnDiagram *-- "0..*" BpmnEdge
  BpmnVersion *-- "0..*" ApprovalRecord
  BpmnNode *-- AuditTrail
  BpmnEdge *-- AuditTrail
  BpmnEdge ..> BpmnEdge : supersedes
```

**Notas:** `nodes`/`edges` são **dicionários** (`Record<id,…>`) — O(1) em pointer
handling de 60fps e ids duplicados impossíveis por construção. Datas são strings
ISO-8601 → todo o modelo é JSON-serializável e determinístico para hash/diff. A
**imutabilidade temporal** aparece como as associações opcionais
`removedInVersion` e `supersedesEdgeId` (arestas formam cadeia de substituição,
navegável por `getEdgeChain`).

### 6.2 Núcleo de controle — Command / Event / Rule / Lifecycle

**Objetivo:** o motor de mutação, undo/redo, veto e promoção.

```mermaid
classDiagram
  class Command {
    <<interface>>
    +string id
    +string description
    +execute(BpmnDiagram) BpmnDiagram
    +undo(BpmnDiagram) BpmnDiagram
    +toAuditEvent() object
  }
  class CommandInterceptor {
    <<interface>>
    +evaluateCommand(Command, BpmnDiagram) RuleVerdict
  }
  class CommandStack {
    -Command[] stack
    -number cursor
    -BpmnDiagram diagram
    +EventBus bus
    +execute(Command) RuleVerdict
    +undo() bool
    +redo() bool
    +subscribe(fn) fn
  }
  class EventBus {
    -Map listeners
    +on(event, handler, priority) fn
    +fire(event, payload) FireResult
  }
  class RuleEngine {
    -Map rules
    +register(event, rule) fn
    +evaluate(event, payload, diagram) RuleVerdict
    +evaluateCommand(cmd, diagram) RuleVerdict
  }
  class LifecycleEngine {
    -transitions
    -minApprovalRoles
    +canTransition(from,to) bool
    +approve(diagram, actor, reason) BpmnDiagram
    +evaluateGates(input) PromotionGate[]
    +promote(input) BpmnDiagram
    +createDraftFrom(diagram, actor) BpmnDiagram
  }
  class ValidationEngine {
    -ValidationRule[] rules
    +addRule(rule)
    +validate(diagram) ValidationResult
  }
  class NodeTypeRegistry {
    -Map definitions
    +register(def)
    +get(type) NodeTypeDefinition
    +typeForXmlTag(tag, preferred) NodeTypeDefinition
  }

  class PromotionRule {
    <<type>>
  }
  RuleEngine ..|> CommandInterceptor
  CommandStack *-- EventBus
  CommandStack o-- CommandInterceptor
  CommandStack --> Command
  RuleEngine ..> Command
  LifecycleEngine ..> PromotionRule
  ValidationEngine ..> NodeTypeRegistry
  Command ..> BpmnDiagram
```

**Notas:** `Command` e `CommandInterceptor` são **interfaces na camada `commands`**
que a camada `engine` (`RuleEngine`) *implementa* — inversão de dependência
deliberada: `commands` nunca depende de `engine`. `LifecycleEngine.promote`
avalia *gates* (transição, aprovações, changelog, diff, `promotionRules`
injetadas) e lança o `detail` do primeiro gate insatisfeito — fonte única de
verdade que a UI renderiza como checklist.

### 6.3 Persistência & pipeline XML (`«service»` internos)

**Objetivo:** o round-trip BPMN 2.0 XML — a fronteira de interoperabilidade.

```mermaid
classDiagram
  class BpmnXmlConverter {
    <<facade>>
    +toXml(diagram) string
    +fromXml(text) ImportResult
  }
  class XmlParserAdapter {
    <<interface>>
    +parse(xml) XmlElement
  }
  class MiniXmlParser {
    +parse(xml) XmlElement
  }
  class XmlBuilder {
    +open(tag, attrs)
    +element(tag, attrs, text)
    +close()
    +toString() string
  }
  class ElementSerializer {
    +writeNode(...)
    +writeEdge(...)
    +groupDataAssociations(diagram)
  }
  class ElementDeserializer {
    +readFlowElements(...)
    +readNode(el) BpmnNode
    +readEdge(el) BpmnEdge
    +readVersion(meta) BpmnVersion
  }
  class DIHandler {
    +writeDi(xml, diagram, plane)
    +applyDi(root, diagram, warnings)
  }
  class ExtensionHandler {
    +writeExtensionElements(...)
    +readExtensionElements(el)
  }
  class MiniXmlAdapter
  class DomXmlAdapter
  class JsonSerializer
  class Serializer {
    <<interface>>
    +serialize(diagram) T
    +deserialize(data) BpmnDiagram
  }

  MiniXmlAdapter ..|> XmlParserAdapter
  DomXmlAdapter ..|> XmlParserAdapter
  MiniXmlAdapter *-- MiniXmlParser
  JsonSerializer ..|> Serializer
  BpmnXmlConverter *-- ElementSerializer
  BpmnXmlConverter *-- ElementDeserializer
  BpmnXmlConverter *-- DIHandler
  BpmnXmlConverter *-- ExtensionHandler
  BpmnXmlConverter o-- XmlParserAdapter
  BpmnXmlConverter --> NodeTypeRegistry
  ElementSerializer *-- ExtensionHandler
  ElementDeserializer *-- ExtensionHandler
  ElementSerializer --> NodeTypeRegistry
  ElementDeserializer --> NodeTypeRegistry
  class Geometry {
    <<module>>
    +routeOrthogonal()
    +boundaryAnchorOf()
  }
  DIHandler ..> Geometry
```

**Notas:** `BpmnXmlConverter` é um **Facade** fino sobre quatro colaboradores
internos (não reexportados no `index.ts` — detalhes de implementação). A
segurança está aqui: `MiniXmlParser` rejeita `<!DOCTYPE>`/DTD (imune a XXE), e
`XmlBuilder` escapa atributos e texto. Propriedades de domínio viajam em
`extensionElements` (`bpmnr:meta` / `bpmnr:property`), preservando identidade
enquanto o tag exportado permanece BPMN padrão → interoperável.

### 6.4 Governança & Confiança

**Objetivo:** registro de versões, verificação de ledger, assinatura e ancoragem.

```mermaid
classDiagram
  class VersionRegistry {
    -Map entries
    +register(diagram, opts) RegistryEntry
    +activeAt(at, target) RegistryEntry
    +publish(versionId, opts) Publication
    +lineageOf(versionId) RegistryEntry[]
    +diffBetween(from, to) BpmnDiff
    +export() ExportedRegistry
  }
  class AuditLedger {
    -AuditEntry[] entries
    -Promise queue
    +append(input) AuditEntry
    +verify() LedgerVerification
    +connectCommandStack(stack, user) fn
    +export()
  }
  class AnchorAdapter {
    <<interface>>
    +string id
    +anchor(head) AnchorReceipt
    +verify(receipt, head) status
  }
  class Signer {
    <<interface>>
    +SignerIdentity identity
    +sign(payload) Uint8Array
  }
  class RegistrySink {
    <<interface>>
    +write(entry)
  }
  class AuditSink {
    <<interface>>
    +write(entry)
  }
  class RegistryError

  RegistryError --|> BpmnError
  VersionRegistry o-- RegistrySink
  VersionRegistry --> BpmnDiagram
  AuditLedger o-- AuditSink
  AuditLedger --> CommandStack
  audit_verifyLedger ..> AuditLedger : verifica
  audit_attestVersion ..> VersionRegistry
  audit_signatures ..> Signer
  createGitAnchor ..|> AnchorAdapter
  createRfc3161Anchor ..|> AnchorAdapter
  createS3Anchor ..|> AnchorAdapter
  audit_anchorEntry ..> AnchorAdapter : registra recibo
```

**Notas:** `identity` **nunca gerencia chaves** (o host implementa `Signer`; a
chave privada jamais cruza a fronteira — imposto por `check-no-key-generation`).
Os três pacotes `anchor-*` implementam o **mesmo contrato `AnchorAdapter`** via
transporte injetado (nenhuma rede dentro da lib). O recibo de `anchor()` vira uma
entrada de ledger (`anchorRecordedEntry`), fechando o loop entre confiança e
auditoria.

### 6.5 Apresentação React — store, contextos, plugin

**Objetivo:** a separação de estado visual vs. domínio e o ponto de extensão.

```mermaid
classDiagram
  class BpmnPlugin {
    <<interface>>
    +string id
    +NodeTypeDefinition[] nodeTypes
    +Record shapes
    +PaletteItem[] paletteItems
    +ValidationRule[] validationRules
    +registerRules(engine)
    +LifecycleConfig lifecycleConfig
    +edgeRouter
    +onEditorEvent(event)
    +contextMenuItems(target)
  }
  class EditorConfig {
    +NodeTypeRegistry registry
    +Record shapes
    +RuleEngine ruleEngine
    +ValidationEngine validationEngine
    +LifecycleEngine lifecycleEngine
    +emitEditorEvent(event)
  }
  class DiagramContextValue {
    +BpmnDiagram diagram
    +CommandStack stack
    +execute(Command) RuleVerdict
    +undo() / redo()
    +replaceDiagram(diagram)
  }
  class CanvasState {
    +Viewport viewport
    +string[] selectedIds
    +DragState dragState
    +ConnectState connectState
    +ResizeState resizeState
  }
  class Store~T~ {
    <<interface>>
    +getState() T
    +setState(patch)
    +subscribe(fn) fn
  }
  class useInteractions {
    <<hook>>
    +onNodePointerDown / onPointerMove / onPointerUp
    +onPortPointerDown (connect)
    +onResizePointerDown
  }

  class canvasStore {
    <<store>>
  }
  EditorConfig ..> BpmnPlugin : resolveEditorConfig
  EditorConfig *-- NodeTypeRegistry
  EditorConfig *-- RuleEngine
  EditorConfig *-- ValidationEngine
  DiagramContextValue *-- CommandStack
  canvasStore ..|> Store
  useInteractions ..> canvasStore : setState (rAF)
  useInteractions ..> DiagramContextValue : execute(Command)
  BpmnPlugin ..> NodeTypeDefinition
  BpmnPlugin ..> ValidationRule
```

**Notas:** **dois estados, dois contêineres.** O estado de **domínio** (o diagrama)
vive no `CommandStack` (baixa frequência, undo-able, exposto por `DiagramContext`);
o estado **visual** (viewport, seleção, gestos em voo) vive num *store externo
minúsculo* consumido por `useCanvasState(selector)` — componentes re-renderizam só
quando a fatia selecionada muda (arrastar um nó não re-renderiza a árvore toda). O
`BpmnPlugin` é um **objeto declarativo puro** — sem DI, sem classes de ciclo de
vida; `resolveEditorConfig(plugins)` funde tudo num `EditorConfig`.

### 6.6 Catálogo de artefatos & IA (contrato `ArtifactAdapter`, agentflow, copilot)

**Objetivo:** o contrato genérico de catálogo e o modelo de agente/copiloto.

```mermaid
classDiagram
  class ArtifactAdapter {
    <<interface>>
    +string id
    +string typeLabel
    +list(query) ArtifactSummary[]
    +get(id) ArtifactDetail
    +subscribe(cb) fn
  }
  class LibraryCatalog {
    +list(query) LibraryResult
    +get(ref) ArtifactDetail
    +subscribe(cb) fn
  }
  class RegistryArtifactAdapter {
    +notifyChanged()
  }
  class AgentWorkflow {
    <<entity>>
    +string id
    +string version
    +AutonomyLevel autonomyLevel
    +AgentNode[] nodes
    +AgentEdge[] edges
  }
  class AIProvider {
    <<interface>>
    +string id
    +complete(req) string
  }
  class CopilotProposal {
    +ProposedCommand[] commands
    +string rationale
    +PromptTemplateRef promptTemplateRef
  }
  class CopilotPlan {
    +Command command
    +BpmnDiagram projected
    +SoundnessPreview soundnessPreview
  }

  RegistryArtifactAdapter ..|> ArtifactAdapter
  RecipeAdapter ..|> ArtifactAdapter
  RoteiroAdapter ..|> ArtifactAdapter
  AgentArtifactAdapter ..|> ArtifactAdapter
  LibraryCatalog o-- "1..*" ArtifactAdapter
  RegistryArtifactAdapter ..> VersionRegistry
  buildPlan ..> AIProvider : (host)
  buildPlan ..> CopilotProposal
  buildPlan --> CopilotPlan
  CopilotPlan --> Command
  agentPromotionGate ..> AgentWorkflow : validateGraph
```

**Notas:** o `ArtifactAdapter` é a **espinha de vocabulário** do Studio — `library`
não conhece BPMN; `adapters-bpmn` fornece 10+ adaptadores concretos (flow,
persona, prompt, connector, policy, DMN decision, agente, roteiro, copilot-prompt,
recipe). O `copilot` transforma texto do `AIProvider` em **um** `compositeCommand`
undo-able, com prévia de soundness calculada localmente — a IA nunca escreve no
diagrama diretamente nem acessa comandos de governança (whitelist de 7 comandos de
edição de rascunho).

---

## 7. Diagramas de Sequência

### 7.1 Editar um nó (gesto → comando → veto → auditoria → re-render)

**Objetivo:** o loop de escrita completo, síncrono, com veto e auditoria.

```mermaid
sequenceDiagram
  autonumber
  actor U as Modelador
  participant GI as useInteractions
  participant ST as canvasStore
  participant DC as DiagramContext.execute
  participant CS as CommandStack
  participant RE as RuleEngine
  participant EB as EventBus
  participant AL as AuditLedger
  participant DP as DiagramProvider (useSyncExternalStore)

  U->>GI: pointerdown / move / up
  loop cada rAF (arrasto)
    GI->>ST: setState(dragState) — estado visual
    ST-->>GI: re-render só dos nós afetados
  end
  U->>GI: pointerup (commit)
  GI->>DC: execute(moveNodeCommand(...))
  DC->>CS: execute(command)
  CS->>RE: evaluateCommand(command, diagram)
  alt verdict.allowed == false (diagrama travado)
    RE-->>CS: {allowed:false, reason}
    CS-->>DC: RuleVerdict (veto)
    DC-->>U: banner de veto
  else permitido
    CS->>EB: fire("command.pre") (cancelável)
    CS->>CS: diagram = command.execute(diagram)
    CS->>EB: fire("command.post")
    EB->>AL: (prioridade -100) toAuditEvent() → append (SHA-256)
    CS->>DP: notifyChanged() / stack.subscribe
    DP-->>U: novo BpmnDiagram → canvas re-renderiza
  end
```

**Notas:** o estado **visual** muda a cada `requestAnimationFrame` sem tocar o
domínio; só no `pointerup` um `Command` é confirmado. O `AuditLedger` observa em
prioridade −100 (após transformadores), garantindo payload final. Chamadas são
**síncronas** exceto o `append` do ledger (serializado por fila de Promise).

### 7.2 Importar BPMN 2.0 XML

**Objetivo:** o caminho de leitura da fronteira de interoperabilidade.

```mermaid
sequenceDiagram
  autonumber
  actor Host
  participant CV as BpmnXmlConverter.fromXml
  participant AD as XmlParserAdapter
  participant DE as ElementDeserializer
  participant EX as ExtensionHandler
  participant DI as DIHandler
  participant GEO as geometry.boundary

  Host->>CV: fromXml(xmlText)
  CV->>AD: parse(xml) — MiniXmlParser (rejeita DOCTYPE → XXE-safe)
  AD-->>CV: XmlElement tree
  CV->>DE: readFlowElements(process, ...)
  DE->>EX: readExtensionElements(el) — bpmnr:meta / property
  EX-->>DE: {properties, meta, elements}
  DE-->>CV: nodes + edges + version
  CV->>DI: applyDi(root, diagram, warnings)
  alt sem DI
    DI->>DI: layout em grade (warning)
  end
  CV->>GEO: boundaryAnchorOf(...) (re-derivar âncoras)
  CV-->>Host: ImportResult { diagram, warnings }
```

**Notas:** elementos desconhecidos são **ignorados com warning** (não rejeitados) —
interoperabilidade tolerante. `readNode` resolve o tipo via metadados
(`bpmnr:meta`) ou `registry.typeForXmlTag` com `preferredTypes` dos plugins.

### 7.3 Promover versão (avaliação de gates)

**Objetivo:** a decisão de governança central.

```mermaid
sequenceDiagram
  autonumber
  actor Aprovador
  participant SR as studio: pendingPromotions
  participant LE as LifecycleEngine
  participant VE as ValidationEngine
  participant SND as soundness.analyzeSoundness
  participant PR as promotionRules (injetadas)

  Aprovador->>SR: abrir fila de revisão
  SR->>LE: evaluateGates({diagram, target:'active', actor})
  LE->>LE: gate transição (DEFAULT_TRANSITIONS)
  LE->>LE: gate aprovações (>= minApprovalRoles papéis distintos)
  LE->>LE: gate change-summary (>= minChangeSummaryLength)
  LE->>PR: agentAutonomyGateRule / soundnessPromotionRule / signaturePromotionRule
  PR->>SND: analyzeSoundness(diagram)
  SND-->>PR: ValidationIssue[]
  PR-->>LE: RuleVerdict
  LE-->>SR: PromotionGate[] (checklist)
  Aprovador->>LE: promote(input)
  alt algum gate insatisfeito
    LE-->>Aprovador: throw BpmnLifecycleError(gate.detail)
  else todos satisfeitos
    LE->>LE: nova BpmnVersion imutável (parentVersionId, snapshotHash)
    LE-->>Aprovador: BpmnDiagram promovido
  end
```

**Notas:** a UI **nunca duplica** as regras — renderiza os `PromotionGate[]` que a
engine devolve. Cada promoção cria uma **nova versão imutável** encadeada; a
versão anterior nunca é mutada.

### 7.4 Aprovar + assinar + ancorar (Studio Review)

**Objetivo:** confiança criptográfica ponta-a-ponta (assíncrona).

```mermaid
sequenceDiagram
  autonumber
  actor Aprovador
  participant RS as ReviewScreen
  participant ID as identity.signApproval
  participant SG as host Signer
  participant AL as AuditLedger
  participant AN as AnchorAdapter
  participant EXT as Git / TSA / S3

  Aprovador->>RS: aprovar (com papel)
  RS->>ID: buildApprovalPayload + signApproval(signer, payload)
  ID->>SG: sign(payload) — chave privada fica no host
  SG-->>ID: assinatura Ed25519
  ID-->>RS: SignedApproval
  RS->>AL: append(APPROVAL_RECORDED) — imutável, aprovar NÃO ativa
  RS->>AN: anchor(head)
  AN->>EXT: commit / timestamp / put(WORM)
  EXT-->>AN: AnchorReceipt
  AN-->>RS: recibo
  RS->>AL: append(anchorRecordedEntry(receipt))
  Note over RS,AL: verify() posterior recomputa a cadeia SHA-256
```

**Notas:** três chamadas `await` reais (assinar, ancorar, persistir). O
`verify()` do ledger e o `AnchorAdapter.verify()` são independentes: um banner de
âncora (N-4) mostra `anchored | pending | mismatch | none` sem bloquear a UI.

### 7.5 Simular tokens & proposta do copiloto (resumidas)

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant SE as SimulationEngine
  participant DE as DecisionEvaluator (dmn/sfeel, injetado)
  U->>SE: advance()
  alt nó é gateway/decisão com tabela
    SE->>DE: evaluate(nodeId, context)
    DE-->>SE: DecisionOutcome (ruleIndex | noMatch | nonSimulable)
  end
  SE-->>U: StepResult { moved, transitions }
```

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant CP as copilot.buildPlan
  participant AI as AIProvider (host)
  U->>CP: pedido em linguagem natural
  CP->>AI: complete({system, messages, schema})
  AI-->>CP: JSON bruto
  CP->>CP: parseProposal + validateProposal (whitelist)
  alt proposta inválida
    CP-->>U: ProposalError (rejeição integral)
  else válida
    CP->>CP: buildPlan → compositeCommand + analyzeSoundness
    CP-->>U: CopilotPlan { command, projected, soundnessPreview }
  end
```

**Notas:** o `DecisionEvaluator` é a *porta* que desacopla `simulation` de
`dmn`/`sfeel`. No copiloto, **uma** proposta inválida em qualquer índice rejeita o
lote inteiro ("rejeição integral") — e o plano final é sempre **um** comando
composto reversível.

---

## 8. Diagramas de Atividade / Estado

### 8.1 Máquina de estados do ciclo de vida da versão

**Objetivo:** o workflow governado de promoção (state machine configurável).

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> test
  test --> candidate
  test --> draft
  candidate --> active
  candidate --> test
  active --> deprecated
  deprecated --> retired
  retired --> [*]

  note right of active
    Ausência DELIBERADA de deprecated→active:
    reativação direta é proibida (integridade
    de auditoria). Restaure clonando em novo draft.
  end note
  deprecated --> draft : createDraftFrom (clone + bump semver)
  active --> draft : createDraftFrom
  retired --> draft : createDraftFrom
```

### 8.2 Atividade — avaliação de gates de promoção (múltiplos caminhos)

```mermaid
flowchart TD
  A([promote solicitado]) --> B{transição<br/>legal?}
  B -- não --> X[/throw: transição inválida/]
  B -- sim --> C{papéis de aprovação<br/>>= mínimo?}
  C -- não --> X2[/throw: faltam aprovações/]
  C -- sim --> D{changeSummary<br/>>= tamanho mín?}
  D -- não --> X3[/throw: changelog curto/]
  D -- sim --> E{requireDiff?}
  E -- sim, sem diff --> X4[/throw: diff ausente/]
  E -->|ok| F[avaliar promotionRules injetadas]
  F --> G{soundness OK?}
  G -- erros --> X5[/throw: soundness/]
  G -- ok --> H{autonomia do<br/>agente coerente?}
  H -- viola --> X6[/throw: gate de agente/]
  H -- ok --> I{assinaturas<br/>válidas?}
  I -- não --> X7[/throw: assinatura/]
  I -- sim --> J[[nova BpmnVersion imutável<br/>snapshotHash + parentVersionId]]
  J --> K([diagrama promovido])
```

### 8.3 Nota sobre concorrência (por que não há diagrama de atividade concorrente complexo)

O sistema é **single-threaded JavaScript**. Não há `Arc/Mutex`, threads ou
paralelismo real de domínio. As duas únicas formas de concorrência são:

1. **Fila de Promises** em `AuditLedger` e `VersionRegistry` — serializa escritas
   assíncronas (`private queue: Promise<unknown>`), garantindo append atômico do
   hash-chain. É uma *sincronização*, não paralelismo.
2. **Web Worker** (`packages/react/src/workers/executor.ts` + `jobs.ts`) — descarrega
   jobs pesados (ex.: roteamento A*) da main thread via `postMessage`.

Como o prompt permite justificar a ausência: **não há workflow concorrente com
sincronização/exceções paralelas a modelar** além do fluxo linear de gates (§8.2)
e do gerenciamento de fila acima. O diagrama de atividade complexo seria
artificial.

---

## 9. Diagrama de Implantação / Distribuição

**Objetivo:** topologia de distribuição e runtime. **Aplicabilidade:** o
repositório **não** contém Docker/Kubernetes/IaC — é uma **biblioteca npm** (+ app
demo Vite + CLI + pipeline CI). O diagrama abaixo mostra a topologia de
*distribuição e execução* em vez de servidores.

```mermaid
flowchart TB
  subgraph Dev["Nó: Desenvolvimento / CI (GitHub Actions, ubuntu-latest, Node 22)"]
    CIB["job build-test<br/>pnpm install → audit → lint → build → typecheck → test:coverage"]
    CIE["job e2e<br/>Playwright + Chromium"]
    NPM[("npm registry<br/>@buildtovalue/*")]
    CIB -->|"release.yml (lockstep semver)"| NPM
  end

  subgraph Browser["Nó: Browser do usuário final"]
    App["«artifact» App host (bundle Vite/webpack)"]
    ReactRT["@buildtovalue/react + core (ESM)"]
    WK["«execution env» Web Worker<br/>executor.ts"]
    App --> ReactRT --> WK
  end

  subgraph NodeRT["Nó: Runtime Node (servidor/CI do consumidor)"]
    CLIbin["«artifact» bpmn-react CLI"]
    CoreN["core + registry + audit + conformance + soundness"]
    CLIbin --> CoreN
  end

  subgraph ExtSvc["Serviços externos (via transporte injetado)"]
    G[("Git")]
    T[("TSA RFC3161")]
    S[("S3 WORM")]
    L["Provedor LLM"]
  end

  NPM -.->|"pnpm add @buildtovalue/core react"| App
  NPM -.-> CLIbin
  CoreN -.->|"AnchorAdapter"| G & T & S
  ReactRT -.->|"AIProvider"| L
```

**Notas de design:** distribuição em **lockstep semver** a partir de `1.0.0`; a
superfície pública é congelada por *contract tests* (`apiSurface.test.ts`) e a
freshness dos docs por CI (`check-docs-fresh`). Como todos os pacotes shipped são
zero-runtime-dep, o "deploy" do consumidor é simplesmente o bundle — não há
processo servidor próprio. Serviços externos só são tocados por adaptadores que o
**host** injeta.

---

## 10. Observações por linguagem

| Linguagem | Situação neste repositório |
|---|---|
| **Python** | **Ausente.** Nenhum `.py`. Itens do prompt (decoradores, ABCs, metaclasses, duck typing) não se aplicam. |
| **Rust** | **Ausente.** Nenhum `.rs`. Itens do prompt (traits, ownership/borrowing, `Arc/Rc`, `Mutex/RwLock`, enums algébricos, macros) não se aplicam. |
| **TypeScript** | **100% do código.** Pontos de atenção efetivamente presentes ↓ |

**TypeScript — pontos de atenção realmente exercitados:**
- **Tipos/interfaces compartilhados como contrato** (o análogo TS aos "DTOs
  cross-language"): `BpmnDiagram`/`BpmnNode`/`BpmnEdge` fluem por *todos* os
  pacotes; `ArtifactAdapter`, `AnchorAdapter`, `Command`, `BpmnPlugin` são
  contratos estruturais que múltiplos pacotes implementam **sem** herança nominal
  (duck typing estrutural do TS — ex.: `dmn` satisfaz `DecisionEvaluator` sem
  importar `simulation`; `agentflow` espelha `simTypes` da `simulation`).
- **Uniões discriminadas / ADT-like** (o análogo TS aos enums de Rust): `NodeDiffOp`,
  `EdgeDiffOp`, `Decision`, `ThumbnailSpec`, `ProposalValidation`,
  `LedgerQueryResult` — todos unions com `kind`/`type` como discriminante.
- **Genéricos**: `Store<T>`, `Serializer<T>`, `EventHandler<T>`, `Rule<T>`.
- **`const` tuples + `typeof[number]`** para enums fechados e seguros
  (`VERSION_STATUS`, `EVENT_DEFINITION_KINDS`, `EDITOR_EVENTS`,
  `LIFECYCLE_STATUSES`).
- **Decorators**: **não usados** (o projeto evita metaprogramação; plugins são
  objetos declarativos, não classes decoradas — diferente de NestJS).
- **ESM `.js` specifiers** em imports internos (compat NodeNext).

---

## 11. Análise crítica: coesão, acoplamento e refatoração

### 11.1 Pontos fortes (alta coesão, baixo acoplamento)

- **`core` como núcleo estável zero-dep** com out-degree zero: exemplar do
  *Stable Abstractions Principle*. Roda headless em browser/Node/worker.
- **Inversão de dependência consistente via seams**: `CommandInterceptor`,
  `PromotionRule`, `DecisionEvaluator`, `AIProvider`, `AnchorAdapter`, `Signer`,
  `XmlParserAdapter`, `Serializer` — cada acoplamento potencialmente pesado é
  mediado por uma interface pequena. `simulation` não conhece `dmn`; `copilot`
  não conhece `identity`; `replay` não conhece `core`.
- **Imutabilidade + comandos puros** tornam undo/redo, diff e hash triviais e
  determinísticos; a auditoria é um *observer*, não um acoplamento intrusivo.
- **Fronteira visual/domínio limpa** na camada React (store externo vs.
  `CommandStack`), com re-render granular — decisão de performance que também é
  decisão de arquitetura.
- **Segurança como propriedade estrutural**: XXE-safe por construção, chave
  privada fora da lib, ledger encadeado, tudo verificado em CI.

### 11.2 Pontos de atenção / oportunidades de refatoramento

1. **`packages/react` é grande (143 arquivos) e com fan-out alto** (depende de
   `copilot`, `agentflow`, `simulation`, `replay`, `identity`). Reexporta
   simulação, replay, copiloto e agente pelo mesmo `index.ts`. *Sugestão:* extrair
   subpacotes tree-shakeable (`@buildtovalue/react-simulation`,
   `-replay`, `-copilot`) ou entry points secundários (já há precedente:
   `@buildtovalue/react/viewer`). Reduz o custo de bundle de quem só quer o editor.
2. **Classificação de fluxo duplicada** entre `soundness/graph.ts` e
   `simulation/graph.ts` (`isFlowNode`, `flowScopeOf`, `gatewayKindOf`),
   deliberadamente mantida para preservar o dep `core`-only e "pinada igual" por
   teste. *Sugestão:* promover essas funções para `core` (ex.:
   `core/graph`) e eliminar a duplicação sem quebrar o zero-dep — ambos já
   dependem de `core`.
3. **`agentflow` reimplementa tipos de simulação** (`simTypes.ts` espelha
   `simulation/types.ts`). Estruturalmente compatível, porém frágil a drift.
   *Sugestão:* um micropacote `@buildtovalue/sim-contracts` com só os tipos.
4. **`example` depende de quase tudo** (16 pacotes) — aceitável para um demo, mas
   convém marcá-lo `private:true` (já é) e mantê-lo fora de qualquer grafo de
   release.
5. **`studio` tem in-degree de contexto alto** (10 deps): concentra governança +
   UI + verificação. É o ponto mais acoplado da camada de aplicação; monitorar
   para que não vire *god package*. A separação atual em `review/` e `ledger/`
   ajuda; manter cada tela sobre suas próprias funções puras (`queue`, `checks`,
   `decide`, `categorize`).
6. **Contrato `EDITOR_EVENTS` com aliases deprecados** (`DEPRECATED_EVENT_ALIASES`)
   — bem gerido por semver, mas exige disciplina de remoção no próximo major para
   não acumular dívida de compatibilidade.
7. **`BpmnPlugin` está na camada `react`**, não em `core`, embora carregue campos
   headless (`validationRules`, `registerRules`, `lifecycleConfig`, `edgeRouter`).
   Isso força pacotes headless-conceituais (`dmn`) a depender de `react` só pelo
   tipo do plugin. *Sugestão:* separar um `HeadlessPlugin` (regras, tipos,
   lifecycle) em `core`, do qual `BpmnPlugin` (shapes, palette, inspector) estende
   em `react`. Removeria o dep `react` de `dmn` no caminho headless.

### 11.3 Métricas qualitativas de acoplamento (aferente/eferente)

| Pacote | Ca (dependido por) | Ce (depende de) | Instabilidade I=Ce/(Ca+Ce) | Leitura |
|---|---|---|---|---|
| `core` | ~15 | 0 | **0.0** | máxima estabilidade (correto) |
| `identity` | 4 | 1 | 0.2 | estável (base de confiança) |
| `registry` | 4 | 1 | 0.2 | estável |
| `soundness` | 4 | 1 | 0.2 | estável |
| `react` | 5 | 6 | 0.55 | zona equilibrada, mas volumosa |
| `studio` | 0 | 10 | **1.0** | instável (topo de aplicação — esperado) |
| `cli` | 0 | 5 | **1.0** | instável (topo — esperado) |

O grafo respeita a *Stable Dependencies Principle*: dependências apontam na
direção da estabilidade crescente (aplicação → domínio). Nenhum ciclo de
dependência entre pacotes foi detectado.

---

## 12. Rastreabilidade (entidade → arquivo-fonte)

Índice abreviado das entidades mais relevantes (case-sensitive, como no código):

| Entidade | Arquivo |
|---|---|
| `BpmnDiagram`, `BpmnNode`, `BpmnEdge`, `BpmnVersion` | `packages/core/src/model/types.ts` |
| `NodeTypeRegistry`, `BUILT_IN_NODE_TYPES` | `packages/core/src/model/registry.ts` |
| `CommandStack` | `packages/core/src/commands/CommandStack.ts` |
| `Command`, `CommandInterceptor` | `packages/core/src/commands/types.ts` |
| `EventBus` | `packages/core/src/events/EventBus.ts` |
| `RuleEngine` | `packages/core/src/engine/rules.ts` |
| `LifecycleEngine`, `DEFAULT_TRANSITIONS` | `packages/core/src/engine/lifecycle.ts` |
| `ValidationEngine`, `BUILT_IN_VALIDATION_RULES` | `packages/core/src/engine/validation.ts` |
| `AuditLedger`, `computeEntryHash` | `packages/core/src/audit/ledger.ts` |
| `BpmnXmlConverter` | `packages/core/src/persistence/BpmnXmlConverter.ts` |
| `MiniXmlParser`, `XmlBuilder`, `XmlParserAdapter` | `packages/core/src/xml/` |
| `computeDiff`, `normalizeForDiff` | `packages/core/src/diff/index.ts` |
| `routeAStar`, `routeOrthogonal`, `boundaryAnchorOf` | `packages/core/src/geometry/` |
| `VersionRegistry`, `bindRun` | `packages/registry/src/VersionRegistry.ts`, `runBinding.ts` |
| `verifyLedger`, `attestVersion`, `toXES`, `buildAssuranceCase` | `packages/audit/src/` |
| `AnchorAdapter`, `Signer`, `signApproval` | `packages/identity/src/` |
| `createGitAnchor` / `createRfc3161Anchor` / `createS3Anchor` | `packages/anchor-*/src/` |
| `analyzeSoundness`, `soundnessPromotionRule` | `packages/soundness/src/` |
| `SimulationEngine`, `DecisionEvaluator` | `packages/simulation/src/` |
| `aggregate`, `summarizeReplay` | `packages/replay/src/` |
| `certifyXml`, `CONFORMANCE_MATRIX` | `packages/conformance/src/` |
| `DmnXmlConverter`, `dmnPlugin`, `createSfeelDecisionSupport` | `packages/dmn/src/` |
| `parseUnaryTests`, `evaluate` (S-FEEL) | `packages/sfeel/src/` |
| `BpmnPlugin`, `EDITOR_EVENTS` | `packages/react/src/plugins/types.ts` |
| `BpmnDesigner` / `BpmnEditor` / `BpmnViewer` | `packages/react/src/` |
| `useInteractions`, `canvasStore`, `useCanvasState` | `packages/react/src/canvas/`, `state/`, `contexts/` |
| `ArtifactAdapter`, `createLibraryCatalog` | `packages/library/src/` |
| `LibraryView`, `useLibrary` | `packages/library-react/src/` |
| `createRegistryAdapter`, `dmnDecisionAdapter`, thumbnails | `packages/adapters-bpmn/src/` |
| `AIProvider`, `buildPlan`, `COPILOT_PROMPTS` | `packages/copilot/src/` |
| `AgentWorkflow`, `validateGraph`, `AUTONOMY_SCALE` | `packages/agentflow/src/` |
| `StudioShell`, `pendingPromotions`, `runReviewChecks`, `LedgerExplorer` | `packages/studio/src/` |
| `validateCommand`, `certifyCommand`, `promoteCommand` | `packages/cli/src/` |

---

## 13. Checklist do agente

- [x] Mapeou todos os arquivos `.ts`/`.tsx` (475 fontes; `.py`/`.rs` inexistentes, ver §0)
- [x] Extraiu dependências dos arquivos de config (`package.json`, `pnpm-workspace.yaml`, `tsconfig`)
- [x] Identificou fronteiras entre camadas e mecanismos de comunicação (§1.2, §5) — sem REST/gRPC; XML como contrato de interop; portas injetadas
- [x] Gerou os diagramas UML: Casos de Uso (§3), Pacotes (§4), Componentes (§5), Classes ×6 por camada (§6), Sequência ×5 (§7), Atividade/Estado ×2 (§8), Implantação/Distribuição (§9)
- [x] Usou Mermaid em todos os diagramas (renderização nativa no GitHub)
- [x] Incluiu notas de design e pontos de atenção para refatoramento (§2, §11)
- [x] Quebrou diagramas complexos (classes divididas em 6 subdiagramas por camada)
- [x] Manteve nomes e estruturas fiéis ao código-fonte (case-sensitive; §12 rastreabilidade)
- [x] Justificou ausências (Python/Rust §0/§10; deployment IaC §9; atividade concorrente §8.3)
