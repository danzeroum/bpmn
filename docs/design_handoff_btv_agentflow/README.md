# Handoff 12: Agent Lane — modelagem governada de agentes de IA

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–11 (programa executado)
**Pré-requisitos:** todos merged — Biblioteca/ArtifactAdapter (H6), simulação (H7), identity/assinatura (H8), copiloto (H9), event bus N-3, i18n N-6.
**Data:** julho 2026 · Origem: 5 pareceres externos triados + 3 validações do plano (blockers resolvidos)

---

## 0. Tese e triagem vinculante

O produto já **é** uma ferramenta de governança de agentes (btv:squad/persona/prompt/gate, autoria ia.copilot no ledger, promoção assinada). Este handoff não inventa agentes — **expõe o micro-comportamento** deles: um nó `agentTask` no BPMN macro que abre o **Agent Studio**, editor de dataflow do sub-workflow do agente, com simulação mock e governança nativa.

**Triagem (vinculante — não reimplemente o que já existe nem o que foi cortado):**

| Já existe (não tocar) | Cortado em definitivo | Aceito |
|---|---|---|
| Trustworthiness/HumanReflection → é o btv:gate + promoção assinada | CrewAI YAML, GraphML | 3 nós + decoradores (ReAct) |
| PROV-AGENT → ledger já grava promptTemplateRef/autor/conversationId | OWL/SPARQL/RDF (violaria zero-deps; sem consumidor) | Critério de parada sobre output estruturado |
| agencyType assinado → identity ed25519 | JSON-LD com @context (URI que não resolve = desonestidade) | Naming AgentO em JSON puro |
| Guardrail de autonomia → o produto inteiro | Memória/Planner como nós (são decoradores) | autonomyLevel 0–5 normativo |
| | BDI labels; colaboração voting/debate (sem runtime mainstream) | Aresta delegate ≠ toolCall (semântica, sem protocolo) |
| | Multi-agente A2A completo; Live Mode (v2 via AIProvider) | Simulação mock client-side; LangGraph ≥0.2 |

## 1. Cercas vinculantes

1. **Fonte de verdade: a Biblioteca (blocker 1 resolvido).** O sub-workflow é artefato versionado com lifecycle no registry, referenciado por `agentWorkflowRef="agnt-rsch@2.1.0"` (ref COM versão, padrão bindRun). O export BPMN PODE embutir snapshot como extensionElement — **só leitura degradada** quando o registry não resolve (aviso "snapshot — registry indisponível"), nunca fonte de verdade. A escrita é sempre no registry.
2. **Motor de simulação próprio (blocker 2 resolvido).** `agentflow` tem motor headless próprio (mensagens/data-mapping/retries ≠ tokens/sequenceFlow). Expõe o MESMO shape de resultado do `simulation` do H7 (trilha de passos + estado + paradas declaradas) para o react renderizar com os mesmos componentes. Proibido adaptar o motor BPMN para dataflow.
3. **3 nós, nunca mais.** `llm` / `tool` / `decision`. Memory, Planner, ErrorBoundary, Validation são **decoradores** (propriedades). Um PR que adicione um 4º tipo de nó precisa de aprovação explícita do dono.
4. **Critério de parada honesto.** Decision avalia **output estruturado** (`output.is_complete === true`), nunca métrica implícita (`confidence` não existe nas APIs). Decision com rota de retry SEM `maxRetries` = erro de validação do grafo. LLM apontado por um decision estruturado força JSON mode (validação, não convenção).
5. **autonomyLevel é regra, não convenção.** Escala normativa (§4). `≤ 3` exige btv:gate a jusante no processo — regra de validação registrada no core, erro **com remediação** ("adicione um btv:gate após este nó ou eleve o nível"). Bloqueia promoção como qualquer erro.
6. **JSON puro com naming AgentO.** Nomes de propriedade alinhados ao vocabulário AgentO/AIAO (`LLMCall`, `ToolCall`, `usesTool`…) SEM `@context`/`@type` JSON-LD — não fazemos claim semântico que não resolvemos. Documentar o alinhamento no README do pacote.
7. **Desacoplamento total.** `agentflow` com ZERO imports do ecossistema (grafo abstrato; teste de acidez padrão sfeel/replay). Integrações (registry, ledger, library, react) por injeção; tudo degradável: sem registry → Studio edita um JSON local; sem ledger → sem trilha; em editor BPMN externo → task com extensão desconhecida (round-trip lossless comprovado por corpus).
8. **IA sem cor própria na notação.** O nó agentTask usa a geometria/tokens existentes + glifo 🤖 e rodapé mono `agnt-rsch@2.1.0` (mesmo padrão do callActivity resolvido). Autoria/autonomia vivem em selos, inspector e ledger.

## 2. Arquivos deste pacote

- `design-refs/AgentStudio BTV.dc.html` — protótipo interativo: modal sobre o Designer (Esc na pilha de dismissal), paleta com 3 nós + decoradores + 3 templates, canvas dataflow (aresta toolCall sólida vs delegate ⤳ tracejada violeta, loop retry com maxRetries), inspector com decoradores e aviso do boundary proposto, simulação mock com token + trilha, validação do grafo, export/import LangGraph, pill de autonomia "2 · Bounded Loop ⚑ exige gate".
- `screenshots/` — estados (§9).

## 3. Arquitetura

```
packages/agentflow    @buildtovalue/agentflow    headless: schema JSON (3 nós + decoradores +
                                                 error boundary), validação de grafo, motor de
                                                 simulação mock próprio (cerca §1.2), import/
                                                 export LangGraph. ZERO imports do ecossistema.
packages/core (ext)   agentTask como node type via extensionElements btv: —
                      agentWorkflowRef + autonomyLevel + input/outputMapping;
                      regra de validação autonomia→gate; snapshot fallback no converter.
packages/react (ext)  AgentStudio (modal), shapes dos 3 nós + 2 tipos de aresta,
                      shape do agentTask no BPMN. Reusa canvas/comandos/undo/i18n/
                      context menu/pilha de Esc/UI de trilha da simulação.
packages/adapters-bpmn (ext)  agentWorkflowAdapter: tipo "AGENTE" na Biblioteca
                      (galeria, selos, lifecycle, promoção assinada).
```

### Schema (JSON puro, naming AgentO)

```json
{
  "kind": "AgentWorkflow",
  "id": "agnt-rsch", "version": "2.1.0", "name": "Research Agent",
  "autonomyLevel": 2,
  "inputSchema":  { "query": "string" },
  "outputSchema": { "answer": "string", "sources": "string[]", "is_complete": "boolean" },
  "nodes": [
    { "id": "llm-1", "type": "llm",
      "config": { "model": "gpt-4o", "promptRef": "prm:research@2", "structuredOutput": true },
      "decorators": [
        { "type": "memory", "scope": "short", "expiry": "6h" },
        { "type": "errorBoundary", "maxRetries": 3, "backoff": "exponential" }
      ] },
    { "id": "tool-2", "type": "tool",
      "config": { "usesTool": "browser_search", "params": { "query": "{{llm-1.output.query}}" }, "timeoutMs": 30000 } },
    { "id": "dec-3", "type": "decision",
      "config": { "condition": "output.is_complete === true",
                  "onTrue": { "next": "end" },
                  "onFalse": { "next": "llm-1", "maxRetries": 3 } } }
  ],
  "edges": [
    { "from": "llm-1", "to": "tool-2", "edgeType": "toolCall" },
    { "from": "tool-2", "to": "dec-3", "edgeType": "data" },
    { "from": "dec-3", "to": "llm-1", "edgeType": "data", "when": "retry" },
    { "from": "llm-1", "to": "agnt-verify@1.0", "edgeType": "delegate" }
  ]
}
```

`promptRef` aponta para um btv:prompt da Biblioteca (dogfooding H9). `edgeType: "delegate"` referencia outro AgentWorkflow por ref versionada — semântica a2a:1.0, **sem protocolo** na v1. `interop` no package.json: `{ "langgraph": ">=0.2", "a2a": "1.0" }`.

### Validações do grafo (headless, no save e na promoção)

1. Todo decision com rota de retry tem `maxRetries`.
2. Nenhum ciclo sem decision com critério de parada no caminho.
3. LLM consumido por decision estruturado tem `structuredOutput: true`.
4. `delegate` aponta ref versionada válida (resolução injetada; sem resolver → warning, não erro).
5. input/outputSchema não vazios; mapeamentos do agentTask referenciam chaves existentes.

## 4. autonomyLevel — escala normativa

| Nível | Nome | Definição objetiva | Gate a jusante |
|---|---|---|---|
| 0 | Manual | agente só sugere; humano executa cada ação | obrigatório |
| 1 | Loop-free | sem retry, sem delegação | obrigatório |
| 2 | Bounded Loop | retry limitado; sem delegação | obrigatório |
| 3 | Decision Tree | múltiplos caminhos; sem delegação | obrigatório |
| 4 | Multi-Agent | possui aresta delegate | opcional (warning) |
| 5 | Self-Modifying | reescreve o próprio plano | sem gate — warning permanente no inspector |

Regra no core: nível ≤ 3 sem btv:gate alcançável a jusante = **erro** (bloqueia promoção); nível 4 sem gate = warning; nível declarado menor que o grafo permite (ex.: nível 1 com retry) = erro de coerência. O grafo é quem manda: o Studio **sugere** o nível mínimo coerente.

## 5. agentTask no BPMN (core + react)

```xml
<bpmn:task id="Activity_1" name="Pesquisar fontes">
  <bpmn:extensionElements>
    <btv:agentTask agentWorkflowRef="agnt-rsch@2.1.0" autonomyLevel="2"
      inputMapping='{"query":"processVariable.customerRequest"}'
      outputMapping='{"answer":"processVariable.researchResult"}'/>
    <!-- opcional, gerado só no export com snapshot: -->
    <btv:agentWorkflowSnapshot version="2.1.0">…json…</btv:agentWorkflowSnapshot>
  </bpmn:extensionElements>
</bpmn:task>
```

- Shape: card de activity padrão + glifo 🤖 (canto sup. esq., traço 1.2) + rodapé mono `agnt-rsch@2.1.0` quando resolvido; ref não resolvida → mesmo padrão do `CALL_REF_MISSING` (badge "!", código mono).
- Duplo-clique (ou "Abrir Agent Studio" no context menu N-5) abre o modal. Esc entra na pilha de dismissal (fecha o Studio antes de qualquer coisa do Designer).
- **ErrorBoundary → boundary event**: ao salvar com errorBoundary ativo, o Studio **propõe** (comando undoável, nunca silencioso) criar boundary event de erro no agentTask — usa a ancoragem paramétrica da N-1.
- **Vigência**: promover processo que referencia agente `candidata`/`obsoleta` → mesmo warning do callActivity (reusar a regra, não recriar).

## 6. Agent Studio (react) — spec de UX

Conforme protótipo: modal 1340px sobre o Designer esmaecido; header com nome + ref, selo de lifecycle, pill de autonomia com "⚑ exige gate", botões Simular (azul `#33567E`)/Salvar/✕; paleta esquerda (3 nós com ícone+resumo, decoradores como pills tracejadas — "nunca nós próprios" escrito na paleta, 3 templates); canvas central (mesma malha/tokens do Designer; decision losango dourado; delegate tracejada violeta `#7A4F9A` com ⤳; decoradores como pills tracejadas DENTRO do card do nó); inspector direita (config + checkboxes de decoradores + aviso do boundary proposto); simulação substitui o inspector (trilha mono, token azul 400ms/passo, contagem de retry, reduced-motion → 0ms); footer com validação do grafo sempre visível.

**Eventos**: o Studio emite no catálogo N-3 (`element.added` etc.) — o modal não é um buraco silencioso no event bus. **i18n**: todas as strings via N-6 (grep pega). **Templates** (3): `Approval Gate Agent` ★ default (llm → decision autonomia → gate — governança como primeira experiência), `Research Agent` (o do protótipo), `Document Review Agent` (llm extrair → decision validar → llm classificar).

## 7. Simulação mock (v1: só mock)

- Fixtures por nó (llm: saída configurável; tool: JSON), configuráveis no inspector.
- Executa client-side: data-mapping real, retries reais, paradas declaradas (retry esgotado → parada honesta com nó+razão, padrão BlockedDecision).
- Trilha = shape de resultado compartilhado com H7 (mesma UI). Sessão registrável no ledger como entrada própria (tipo novo, aditivo) — evidence de "comportamento validado" como no H7.
- Shadow/Live Mode: **fora da v1** — entrada futura via `AIProvider` (H9), registrado em pendencias.

## 8. Ordem das PRs

1. **A-1** `feat(agentflow): @buildtovalue/agentflow — schema + validação de grafo` (headless, acidez, vetores por regra §3, fixtures dos 3 templates)
2. **A-2** `feat(agentflow): motor de simulação mock` (shape de resultado compartilhado; determinístico; retries/paradas; benchmark leve)
3. **A-3** `feat(core): agentTask + regra autonomia→gate + snapshot fallback` (node type, converter com round-trip + degradação, regra com remediação, apiSurface, corpus)
4. **A-4** `feat(react): shape do agentTask + AgentStudio shell` (modal, pilha de Esc, paleta, canvas 3 nós + 2 arestas, inspector, i18n, eventos N-3)
5. **A-5** `feat(react): simulação no Studio + boundary proposto + templates` (trilha compartilhada, comando proposto undoável, 3 templates)
6. **A-6** `feat(adapters+registry): agente como artefato da Biblioteca + resolução versionada + ledger` (adapter "AGENTE", selos, warning de vigência reusado, entradas de sessão)
7. **A-7** `feat(agentflow): import/export LangGraph JSON ≥0.2` (subconjunto documentado: nodes/edges/inputs/outputs; `interrupts`/`checkpoints` ignorados e DECLARADOS no aviso de import; round-trip do subconjunto)

## 9. Critérios de aceite

1. **Acidez:** `agentflow` roda com grafo fake sem nenhum import do ecossistema; teste de grafo de deps.
2. **Validação:** vetores para as 5 regras §3 + escala §4 (nível baixo com retry = erro de coerência; ≤3 sem gate = erro com remediação exata; 4 sem gate = warning); erro bloqueia promoção via evaluateGates.
3. **Round-trip:** agentTask exporta/importa byte-estável; snapshot só é lido quando resolução falha (teste com registry fake presente vs ausente); editor externo degrada (fixture no corpus `degraded-elements`).
4. **Simulação:** determinística (fixture 10× = trilha idêntica); retry esgotado → parada honesta nomeando nó+razão; reduced-motion 0ms; sessão no ledger com tipo próprio.
5. **Studio:** Esc fecha o modal antes de qualquer dismissal do Designer (e2e); eventos do catálogo emitidos de dentro do modal (spy); zero strings hardcoded (grep).
6. **Boundary proposto:** salvar com errorBoundary → proposta aplicável e undoável; recusar → nada muda (e2e).
7. **Biblioteca:** agente aparece com selos/lifecycle; promover processo com agente candidata → warning (e2e); promptRef abre o prompt na Biblioteca.
8. **LangGraph:** export→import do subconjunto = grafo equivalente; campos ignorados declarados no aviso.
9. **Globais:** zero deps, pisos de cobertura, apiSurface para toda API nova, contagens de node types atualizadas.

## 10. O que NÃO fazer

- Não criar 4º tipo de nó nem transformar decorador em nó (cerca §1.3).
- Não usar JSON-LD/@context (§1.6); não implementar A2A/MCP como protocolo; não Live Mode na v1.
- Não embutir o sub-workflow como fonte de verdade no XML (§1.1) — snapshot é fallback de leitura.
- Não adaptar o motor de simulação BPMN para dataflow (§1.2) — motor próprio.
- Não inventar cor de nó para IA (§1.8).
- Não critério de parada sobre métrica implícita — `confidence` sem output estruturado é proibido (§1.4).
- Não OWL/SPARQL/RDF/CrewAI/GraphML — cortados em definitivo; demanda → pendencias.md.
