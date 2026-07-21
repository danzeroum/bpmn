# Handoff 22: Squad Lane — frontend de especificação de agentes e squads de IA

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–21 (Agent Lane H12 e Escalation H18 entregues e vigentes)
**Pré-requisitos (todos merged):** agentflow A-1..A-7, agentTask no core/react (A-3/A-4/A-5), adapter AGENTE (A-6), ponte de escalação (H18 EC-3/EC-5), copilot H9 (AIProvider/whitelist), Biblioteca H6, simulação H7, i18n N-6, eventos N-3, worker harness (melhorias F7).
**Data:** julho 2026 · **Origem:** análise de lacunas (SQ-1..13) → plano frontend (FE-1..FE-9) → 2 rodadas de pareceres externos triados (ajustes D1–D8 e E1–E9). Documentos e protótipos hi-fi em `design-refs/`.

---

## 0. Tese e recorte

O produto já governa agentes (artefato versionado, autonomia 0–5, autonomia→gate, paradas honestas, escalação assinada). O que falta **não é infraestrutura — é vocabulário e contrato**: o desenho ainda não carrega informação suficiente para virar um agente/squad real. Este handoff fecha essa lacuna **só no frontend**: o Studio passa a produzir uma **especificação operacional verificável** (contratos, evidências, estados derivados), com TODA execução real atrás de interfaces injetáveis. "IA rascunha, humanos assinam" vale também como princípio visual.

**Recorte vinculante:** nenhuma chamada de rede, credencial, SDK ou runtime nesta entrega. Live Mode, deploy de engine, telemetria real e protocolos A2A/MCP ficam para o backend futuro — aqui viram interface + estado visual.

## 1. Triagem vinculante (não reimplemente o que existe nem o que foi cortado)

| Já existe (não tocar/estender) | Cortado em definitivo | Aceito (este handoff) |
|---|---|---|
| Canvas 3 nós + decoradores + templates + validação + simulação mock (A-1..A-5) | Trocar a fundação por bpmn-js / stack externa (Monaco, Ant, Zustand, Dexie, Yjs) — viola zero-deps | Tool como contrato versionado + matriz capacidade/permissão/efeito |
| agentTask no BPMN (bpmnr:meta, snapshot read-only, regra autonomia→gate) | 4º tipo de nó; memória/planner como nós; Goal Event/Plan Fragment; gateways de IA | LlmConfig completo + budget governado |
| Ponte de escalação, gate, Revisão do Aprovador (HITL) | Namespace `ai:` novo (decisão A-3: reusar `bpmnr:`) | Subconjunto honesto de JSON Schema + delegate com contrato |
| Copilot whitelisted (nunca promove/aprova/assina) | "Semantic router" por LLM (métrica implícita, §1.4 do H12) | Inspector por abas + Painel de Problemas em linguagem de negócio |
| Registry/ledger/identity/XES; Scenario+hash+Session do H7 | JSON-LD/@context; OWL/RDF; CrewAI/GraphML | Validador de cobertura de prompt + EvalSet como evidência |
| Worker harness (F7), i18n N-6, eventos N-3, pilha de dismissal | Live Mode; editor de workflow por linguagem natural fora do copilot; colaboração em tempo real; telemetria de runtime real; editor rico de JSON Schema; editor visual de políticas genéricas | SquadManifest + ctx-contract + toggle de perspectiva + 6 arestas |
| | Pacote `agentflow-react` paralelo (estender `packages/react` subpath `./agent`) | Simulação multi-agente + trilha de fatos + Evidence Bundle |
| | Drag-into-node no MVP (novo tipo de gesto — vira polimento registrado) | readinessState + interfaces injetáveis ToolProvider/AgentRunner/ExecutionStore |

## 2. Cercas vinculantes

1. **3 nós, nunca mais** (`llm`/`tool`/`decision`). Toda capacidade nova é decorador, propriedade ou artefato.
2. **Tudo por referência versionada** `id@major.minor.patch` (padrão bindRun). O BPMN guarda ref + configuração local; snapshot é SÓ leitura degradada.
3. **Headless primeiro, acidez preservada.** Schemas/validações/simulação/`readinessState()`/`promptCoverage()` nascem em `agentflow` com ZERO imports do ecossistema (teste de independência). Integrações por injeção, todas degradáveis.
4. **Sem métrica implícita.** Decision avalia output estruturado; roteamento de squad é decision ou topologia declarada no manifesto. `confidence` continua proibido.
5. **Trilha de fatos, não "pensamento".** A trilha registra: intenção declarada → ação/ferramenta → I/O mascarado → decisão/regra aplicada → evidência. Nunca "raciocínio" livre. Cada fato rotula a origem: `fixture` | `evidencia-declarada` (| `evidencia-verificada`, reservado ao backend).
6. **Simulação determinística fixture-driven.** Mesmo bundle 2× = trilha byte-idêntica. Estouro de budget/retry = parada honesta (`BlockedDecision` nomeando nó+razão+contagem), nunca continuação inventada.
7. **Zero credencial/SDK/rede.** O gate de CI no-key-generation cobre também este handoff. Provider é sempre injetado pelo host; telemetria é mockada com fixtures.
8. **Risco classifica, permissão decide, efeito explica.** A tool declara efeito (`read`/`propose`/`notify`/`write-reversible`/`write-irreversible`/`external-commitment`); a autorização (`automatica`/`gate`/`proibida`) é campo de governança próprio e alimenta a regra de gate.
9. **Gate é controle verificável, não selo.** `EFFECT_NEEDS_GATE` só passa quando o gate está no caminho ANTES do efeito externo, sem rota de bypass (fallback/retry/delegate), com escopo de aprovação declarado. Construir sobre `reachableGateFrom` do core.
10. **Mapeamentos só do catálogo de transformações** (direta/seleção/projeção/renomeação/default). Conversão de tipo é proibida por padrão — exige adaptador versionado, nunca expressão solta no inspector.
11. **Estados derivados por código.** `readinessState()` pura é a ÚNICA fonte de: rascunho → validado → simulado-com-evidência → **apto-para-integração** (→ executando/erro-de-integração: reservados a host com provider). Proibido pintar estado na UI.
12. **Reusar, nunca recriar.** Squad Studio = diagrama BPMN padrão (subProcess expandido + lanes + `edgeStyles`; o toggle troca só o renderer de aresta). Estender AgentStudio/CopilotPanel/SimulationPanel/PropertiesPanel existentes. Bundle usa `canonicalJson`/hash do core como AuditEntry (montado em adapters/audit — nunca dentro do agentflow). Sem Monaco: textarea + overlay de spans. Virtualização própria da trilha (sem react-window).
13. **UI dentro dos padrões da casa:** toda string via i18n N-6 (EN + PT_BR; grep pega), eventos do catálogo N-3 emitidos das superfícies novas, Esc na pilha de dismissal, comandos undoáveis via CommandStack, `apiSurface.test.ts` atualizado a cada export novo.

## 3. Arquivos deste pacote

- `design-refs/Analise Agentes e Squads IA.dc.html` — diagnóstico completo (matriz de 14 capacidades, gaps G1–G5, squads S1–S6, roadmap SQ-1..13).
- `design-refs/Plano Frontend Agentes e Squads.dc.html` — **fonte da verdade do escopo**: triagem das análises, plano FE-1..FE-9, ajustes D1–D8 (§05) e E1–E9 (§06), decisões anti-retrabalho (§07).
- `design-refs/Prototipos Frontend FE.dc.html` — 9 telas hi-fi (spec visual; abrir com o `support.js` da pasta). Tweak `telaVisivel` isola cada tela.
- `screenshots/` — capturas das 9 telas (01 catálogo de tools · 02 budget · 03 contrato do delegate · 04 inspector+problemas · 05 validador de cobertura · 06 Squad Studio · 07 simulação+bundle · 08 ponte BPMN · 09 prontidão+contratos).
- Reconciliação: criar `RECONCILIACAO.md` neste diretório ao final (padrão dos handoffs 14/17/18), item a item contra §9.

## 4. Arquitetura (pacotes tocados)

```
packages/agentflow (ext)      ToolContract, budget, SchemaNode (subset JSON Schema),
                              resolveDelegate → workflow, SquadManifest + ctx-contract,
                              EvalSet, simulateSquad, promptCoverage, readinessState,
                              catálogo de transformações. ZERO imports do ecossistema.
packages/core (ext)           regra GATE_NOT_COVERING (sobre reachableGateFrom),
                              mapeamento tipado do agentTask (transformações),
                              deep-link ?load=<versionId> no contrato do host.
packages/react (ext ./agent)  inspector com abas por plugin, Painel de Problemas,
                              catálogo TOOL + binding por seletor, Squad Studio
                              (diagrama padrão + toggle + 6 edgeStyles), SimulationTrail
                              virtualizada + step mode, badges de prontidão.
packages/adapters-bpmn (ext)  adapters TOOL / SQUAD / EVAL / CTX-CONTRACT,
                              EvidenceBundle como AuditEntry (com core/audit).
packages/copilot (ext)        comando whitelisted scaffoldSquad (4 templates).
```

**Interfaces injetáveis (nascem DENTRO de cada PR, com teste de degradabilidade):**

```ts
interface ToolProvider  { resolve(ref: AgentRef): ToolContract | undefined }        // FE-1
interface AgentRunner   { simulate(wf, opts): SimulationState /* run? = backend */ } // FE-7
interface ExecutionStore{ saveEvidence(bundle): Promise<string> /* hash */ }         // FE-5/7
```

Sem provider → a superfície degrada com aviso tipado (nunca silêncio), padrão AIProvider/H9.

## 5. Schemas novos (JSON puro, naming AgentO onde couber)

```json
// ToolContract — artefato TOOL da Biblioteca (tool:browser-search@1.2.0)
{ "kind": "ToolContract", "id": "tool:browser-search", "version": "1.2.0",
  "name": "browser_search", "capability": "buscar na web",
  "inputSchema":  { "query": { "type": "string", "required": true } },
  "outputSchema": { "results": { "type": "array", "items": { "type": "string" } } },
  "effect": "read",
  "dataScope": "publico-sem-pii",
  "authorization": "automatica",
  "evidenceRequired": "nenhuma",
  "simulation": "fixture-obrigatoria",
  "errors": ["timeout", "validation", "rate-limit"],
  "defaultFixture": { "results": ["fonte A", "fonte B"] } }
```

```json
// LlmConfig estendido + budget (propriedades do nó llm / do AgentWorkflow)
{ "model": "gpt-4o", "provider": "host-injetado", "fallbackModel": "claude-sonnet",
  "temperature": 0.2, "maxOutputTokens": 4096, "structuredOutput": true,
  "promptRef": "prm:research@2.0.0" }
// AgentWorkflow.budget (autonomia ≥ 2 sem budget = warning BUDGET_MISSING)
{ "maxTokens": 120000, "maxCostBRL": 4.0, "maxWallTimeMs": 300000, "maxSteps": 12 }
```

```json
// SchemaShape evolui para SchemaNode — subconjunto HONESTO de JSON Schema
// (type, required, enum, items, properties; TUDO fora disso é declarado em warnings)
{ "answer": { "type": "string", "required": true },
  "sources": { "type": "array", "items": { "type": "object",
      "properties": { "url": { "type": "string" }, "quote": { "type": "string" } } } },
  "is_complete": { "type": "boolean", "required": true } }
```

```json
// SquadManifest — artefato SQUAD (sqd-doc-review@1.0.0)
{ "kind": "SquadManifest", "id": "sqd-doc-review", "version": "1.0.0",
  "dynamic": "hierarquico",              // hierarquico | sequencial | paralelo | blackboard
  "orchestratorRef": "agnt-orch@1.0.0",
  "members": [ { "agentRef": "agnt-rsch@2.1.0",   "personaRef": "prs:analista-senior@1.0.0", "role": "pesquisador" },
               { "agentRef": "agnt-extract@1.3.0","personaRef": "prs:extrator@1.0.0",       "role": "extrator" },
               { "agentRef": "agnt-qa@0.9.0",     "personaRef": "prs:revisor@1.0.0",        "role": "revisor" } ],
  "edges": [ { "from": "orch", "to": "pesquisador", "kind": "delegar" },
             { "from": "pesquisador", "to": "extrator", "kind": "enviar-contexto" },
             { "from": "extrator", "to": "revisor", "kind": "solicitar-revisao" },
             { "from": "revisor", "to": "humano", "kind": "escalar" },
             { "from": "*", "to": "orch", "kind": "consolidar" },
             { "from": "pesquisador", "to": "orch", "kind": "fallback" } ],
  "contextContractRef": "ctx-contract:doc-review@1.0.0",
  "gates": [ { "gateId": "gate-final", "scope": "por-execucao" } ] }
```

```json
// ctx-contract — artefato próprio, reutilizável entre squads
{ "kind": "ContextContract", "id": "ctx-contract:doc-review", "version": "1.0.0",
  "keys": [
    { "key": "doc.fontes",   "owner": "pesquisador", "readers": ["*"], "writers": ["pesquisador"],
      "purpose": "grounding", "merge": "acrescentar", "ttl": "24h", "sensitivity": "interna" },
    { "key": "doc.extraido", "owner": "extrator", "readers": ["revisor"], "writers": ["extrator"],
      "purpose": "decision", "merge": "substituir", "ttl": "caso" },
    { "key": "veredito",     "owner": "revisor", "readers": ["orch"], "writers": ["revisor"],
      "purpose": "operational-action", "merge": "exigir-decisao", "immutableAfterGate": true },
    { "key": "cliente.pii",  "forbidden": true } ] }
```

```json
// EvalSet — artefato EVAL; threshold vira gate de promoção via evaluateGates
{ "kind": "EvalSet", "id": "eval:rsch-base", "version": "1.0.0",
  "targetRef": "agnt-rsch@2.1.0", "promotionThreshold": 1.0,
  "cases": [ { "name": "pergunta simples responde com 2+ fontes",
               "input": { "query": "garantia estendida" },
               "fixtures": { "tool-2": { "outputs": [{ "results": ["a","b"] }] } },
               "assertions": [ { "kind": "contains", "path": "answer", "value": "fonte" },
                               { "kind": "schema" },
                               { "kind": "regex", "path": "answer", "pattern": "^(?!.*@).*$" } ] } ] }
// assertions: SÓ regex | contains | schema — nunca código.
```

```json
// EvidenceBundle — payload canônico; adapters/audit o registram como AuditEntry
{ "kind": "SimulationEvidence", "targetRef": "sqd-doc-review@1.0.0",
  "resolvedRefs": { "agents": ["agnt-orch@1.0.0","agnt-rsch@2.1.0","agnt-extract@1.3.0","agnt-qa@0.9.0"],
                    "tools": ["tool:browser-search@1.2.0"], "prompts": ["prm:research@2.0.0"] },
  "input": {}, "fixtures": {}, "simulatorVersion": "agentflow-sim@x.y.z",
  "trail": [], "decisions": [], "assertions": { "passed": 5, "total": 5 },
  "projectedCost": { "tokens": 11400, "brl": 0.52, "ms": 41000 },
  "policyRefs": [], "decisionRuleRefs": [], "maskingPolicyRef": "mask:default@1.0.0",
  "hash": "<canonicalJson+sha256>" }
```

```json
// Catálogo de transformações de mapeamento (agentTask ↔ processo, agente ↔ agente)
[ { "op": "direta",     "ex": "pedido.locale -> locale" },
  { "op": "selecao",    "ex": "sources[0] -> fontePrincipal" },
  { "op": "projecao",   "ex": "sources[].url -> urls" },
  { "op": "renomeacao", "ex": "customer.name -> clientName" },
  { "op": "default",    "ex": "locale ?? 'pt-BR'" } ]
// Conversão de tipo: PROIBIDA por padrão → exige adapterRef versionado.
```

## 6. Validações novas (códigos estáveis; erro bloqueia promoção, warning nunca)

| Código | Sev. | Regra |
|---|---|---|
| `TOOL_REF_INVALID` / `TOOL_UNRESOLVED` | erro / warning | `usesTool` deve ser ref `tool:*@semver`; resolução injetada e degradável (molde DELEGATE_*) |
| `TOOL_PARAMS_MISMATCH` | erro | params do nó não batem com o inputSchema do ToolContract |
| `EFFECT_NEEDS_GATE` | erro | effect `external-commitment`/`write-irreversible` sem gate que cubra a ação |
| `GATE_NOT_COVERING` | erro | gate existe mas há rota (fallback/retry/delegate) que alcança o efeito sem passar por ele; ou contexto mutável entre gate e ferramenta |
| `BUDGET_MISSING` | warning | autonomia ≥ 2 sem bloco budget |
| `BUDGET_EXCEEDED` | parada honesta (sim) | estouro projetado de tokens/custo/tempo/passos — nomeia nó, razão, contagem |
| `DELEGATE_CONTRACT_MISMATCH` | erro | outputSchema do delegante não cobre inputSchema required do delegado |
| `DELEGATE_CYCLE` | erro | ciclo A→B→A sem progresso na cadeia de delegates |
| `AUTONOMY_CHAIN` | erro | autonomia declarada menor que a efetiva da cadeia (máx dos delegados) |
| `SQUAD_MEMBER_STALE` | warning | membro candidata/obsoleta — promoção coordenada reaproveita a regra de vigência |
| `CTX_WRITE_FORBIDDEN` / `CTX_PURPOSE_VIOLATION` | erro | escrita fora do ctx-contract / uso fora da finalidade declarada |
| `MAPPING_TRANSFORM_ILLEGAL` | erro | mapeamento fora do catálogo ou conversão sem adapterRef |
| `PROMPT_VAR_UNUSED` | warning | variável do inputSchema não usada no prompt (promptCoverage) |
| `EVAL_BELOW_THRESHOLD` | erro (promoção) | eval set do alvo abaixo do threshold ao promover para ativa |

Todo erro carrega `remediation` exata (padrão do repo). Mensagens em EN no headless; a UI apresenta em linguagem de negócio via i18n.

## 7. readinessState (máquina de estados honesta — E1)

```ts
readinessState(wf, ctx: { validation, hasEvidence, evalPassRate, threshold,
                          gateCovered, signedActive, providerAvailable? })
  → 'rascunho' | 'validado' | 'simulado-com-evidencia' | 'apto-para-integracao'
// 'executando' e 'erro-de-integracao' são estados do HOST (provider injetado) —
// a biblioteca só os exibe quando informados; nunca os deriva sozinha.
```

Função pura em `agentflow`, testada sem DOM. Card, badge, tooltip e futuro backend consomem a MESMA função.

## 8. UX (specs = protótipos 01–09; pontos não óbvios)

- **01 Catálogo/binding:** MVP por seletor/autocomplete + botão "vincular" no card (E7); chips de efeito com cor por gravidade; card mostra mini contrato I/O + fixture.
- **02 Budget:** barra de budget no card do nó; painel Inteligência com provider "host-injetado" (nunca campo de chave); custo projetado rotulado como valor de modelagem.
- **03 Delegate:** incompatibilidades destacadas NOS DOIS lados; pill de autonomia efetiva da cadeia.
- **04 Inspector/Problemas:** abas com sobrescrito da onda (O1/O2/O3); refatorar PropertiesPanel para abas registradas por plugin ANTES da Onda 1 (padrão inspectorSections); quick-fix só quando seguro/undoável — mudança de contrato de I/O nunca tem quick-fix.
- **05 Validador de cobertura:** variáveis destacadas no prompt (textarea + overlay de spans); barra de cobertura; card do gate de promoção com placar do eval.
- **06 Squad Studio:** toggle Estrutura ↔ Colaboração no toolbar (`viewMode` no CanvasContext → troca `edgeStyles`); 6 arestas com traço+ícone+rótulo (E9 — nunca só cor); manifesto e ctx-contract no painel direito; aviso de promoção coordenada.
- **07 Simulação:** botões Play/Passo; filtros por agente/tipo/só-erros; trilha virtualizada; linha de delegação com moldura própria; card do Evidence Bundle com hash + botão exportar JSON canônico; reduced-motion → 0ms (padrão A-5).
- **08 Ponte BPMN:** duplo-clique → Agent Studio via `?load=<versionId>` (fecha pendência §1.2); "voltar" restaura estado; simulação integrada token→trilha do agente→token; scaffolder do copilot com estados PROPOSTA/APLICADA (padrão issue #150).
- **09 Prontidão:** badge sempre acompanhado da derivação ("por que este estado"); cards escuros dos contratos injetáveis com o teste de degradabilidade nomeado.

## 9. Ordem das PRs

1. **SL-1** `feat(agentflow): ToolContract + refs tool:* + validação params↔schema + effects` (headless; vetores por código §6; acidez)
2. **SL-2** `feat(adapters+library+react): adapter TOOL + catálogo + binding por seletor no inspector` (ToolProvider nasce aqui, degradável)
3. **SL-3** `feat(agentflow): LlmConfig estendido + budget + parada honesta BUDGET_EXCEEDED na simulação`
4. **SL-4** `feat(agentflow): SchemaNode subset + resolveDelegate→workflow + contrato/ciclo/autonomia de cadeia`
5. **SL-5** `feat(react): PropertiesPanel com abas por plugin + Onda 1 (Identidade/Inteligência) + promptCoverage headless`
6. **SL-6** `feat(react): Painel de Problemas (linguagem de negócio + quick-fix seguro) + Onda 2 (Contratos/Ferramentas)`
7. **SL-7** `feat(agentflow+adapters): EvalSet + validador de cobertura + EVAL_BELOW_THRESHOLD em evaluateGates`
8. **SL-8** `feat(agentflow): SquadManifest + ctx-contract + validações de squad + readinessState`
9. **SL-9** `feat(react): Squad Studio (diagrama padrão + toggle + 6 edgeStyles acessíveis) + Onda 3 (Memória/Governança)`
10. **SL-10** `feat(agentflow+react): simulateSquad no worker + trilha de fatos virtualizada + step mode` (AgentRunner nasce aqui)
11. **SL-11** `feat(adapters+audit): EvidenceBundle como AuditEntry canônico + renderer no LedgerExplorer` (ExecutionStore nasce aqui)
12. **SL-12** `feat(core+react): ponte BPMN — ?load deep-link, mapeamentos do catálogo, GATE_NOT_COVERING, scaffoldSquad no copilot`
13. **SL-13** `chore: revisão dos contratos injetáveis + badges de prontidão em todas as superfícies + varredura i18n/a11y`

Cada PR: changeset, `apiSurface.test.ts`, pisos de cobertura, i18n EN+PT_BR, teste de degradabilidade do provider correspondente, suite completa verde (incl. `independence.test.ts` e corpus de interop).

## 10. Critérios de aceite

1. **Acidez:** agentflow segue sem NENHUM import do ecossistema com todos os módulos novos (teste de grafo de deps).
2. **Contratos:** vetores para TODOS os códigos §6 (positivo+negativo+remediação); binding só aceita ref versionada — impossível digitar string solta.
3. **Determinismo:** simulateSquad 10× com as mesmas fixtures = trilha e hash idênticos; BUDGET_EXCEEDED e DELEGATE_* param honestamente nomeando nó+razão.
4. **Evidência:** bundle exporta JSON canônico; `verify()` do ledger valida a entrada sem código novo; policyRefs/decisionRuleRefs/maskingPolicyRef obrigatórios; fixture × evidência-declarada visíveis na trilha.
5. **Gate real:** fixture com rota de fallback que contorna o gate → `GATE_NOT_COVERING` com mensagem nomeando a rota (e2e).
6. **Squad:** toggle não perde seleção/undo (mesmo estado); promoção de squad com membro candidata → warning agregado; ctx-contract reutilizado por 2 squads (ref, não cópia).
7. **Prontidão:** `readinessState()` é a única origem dos badges (teste que quebra se algum componente derivar estado próprio); "apto para integração" nunca vira "executando" sem host.
8. **Ponte:** duplo-clique abre Studio com a versão exata via `?load`; voltar restaura viewport/seleção; simulação integrada atravessa o agentTask (e2e).
9. **A11y (E9):** as 6 arestas distinguíveis sem cor (traço+ícone+rótulo); legenda navegável por teclado; foco em aresta anuncia origem/destino/tipo/contrato (axe sem regressão).
10. **Perf:** trilha com 500 passos rola a 60fps (virtualização própria); simulação de squad no worker não bloqueia o canvas (canário FPS existente).
11. **Globais:** zero deps novas, zero strings hardcoded (guard), round-trip byte-estável do corpus intocado, RECONCILIACAO.md preenchida contra este §.

## 11. O que NÃO fazer

- Não criar 4º tipo de nó, nó de memória/planner, "Semantic Router" ou gateway de IA.
- Não exibir "pensamento/raciocínio" na trilha — só fatos verificáveis (cerca §2.5).
- Não usar "pronto para execução"/"executando" sem backend — o teto do frontend é "apto para integração".
- Não armazenar chave/credencial/endpoint em lugar nenhum (nem "só no localStorage").
- Não implementar drag-into-node agora (registrar em pendencias.md como polimento).
- Não criar canvas novo para o Squad Studio nem pacote de UI paralelo.
- Não inventar formato próprio de hash/assinatura — canonicalJson + cadeia do core.
- Não converter tipo em mapeamento sem adaptador versionado.
- Não Live Mode, A2A/MCP como protocolo, telemetria real, colaboração em tempo real — pendências, não escopo.

## 12. Pendências a registrar (pendencias.md, ao final)

- Drag-and-drop do catálogo para dentro do nó (gesto novo; spec visual já no protótipo 01).
- Live/Shadow Mode via AgentRunner.run (gated por autonomia+gate; contrato já nasce no SL-10).
- Evidência verificada (3º rótulo da trilha) — exclusivo de execução real.
- A2A agent card / binding MCP real / telemetria OTel GenAI → XES.
- Mascaramento de PII end-to-end no runtime (maskingPolicyRef já viaja no bundle).
