# Handoff 4: Trust Layer — conformidade, auditoria, soundness e resiliência

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–3 (`docs/design_handoff_btv_bpmn/`, `docs/design_handoff_btv_craft_governance/`, `docs/design_handoff_btv_prototypes/`)
**Pré-requisito:** PRs 4–6 (craft pack, selo de vigência, fluxo de promoção) merged
**Data:** julho 2026

---

## 0. Tese

O repositório já tem confiabilidade de *engenharia* (324+ testes, ledger hash-chained, temporal immutability, CI gated). Este handoff constrói confiabilidade **demonstrável para terceiros**: prova de conformidade (A), prova de integridade (B), prova de correção dos modelos (C) e resiliência de runtime (D). Três bibliotecas proprietárias novas + um pacote de hardening no react.

Leis do repo inalteradas: **zero runtime deps** em todos os pacotes novos; headless core + camada react separada; PRs estratégicas com run do GitHub Actions **verde confirmada** → merge; decisões de escopo → `pendencias.md`.

## 1. Priorização e sequência

| Ordem | Item | Pacote | PR(s) |
|---|---|---|---|
| 1 | D · Resiliência do editor | `packages/react` | PR-D1 |
| 2 | A · Conformidade (F8 completa) | `packages/conformance` + `packages/cli` | PR-A1, PR-A2 |
| 3 | F7 restante (subProcess aninhado, callActivity, dataStore) | core + react | (sessão dedicada, conforme pendencias.md §7) |
| 4 | C · Soundness | `packages/soundness` | PR-C1, PR-C2 |
| 5 | B · Auditoria + XES | `packages/audit` | PR-B1, PR-B2 |

Racional: D é barato e protege usuários imediatamente. A destrava a declaração Analytic e o npm publish com selo. C fica mais valioso **depois** do subProcess aninhado (análise atravessa hierarquia). B fecha o ciclo de governança.

**Duas pendências de produto que este handoff resolve (registradas em `pendencias.md`):**
- O Handoff 2 será subido a `docs/design_handoff_btv_craft_governance/` para reconciliação (§8 das pendências).
- Escopo npm: decisão em aberto (§1 das pendências) — **não publique** até o dono confirmar o escopo; mas a PR-A2 deixa o `certify` pronto para o release note do primeiro publish.

---

## PARTE D — Resiliência do editor (`packages/react`, sem pacote novo)

### D1. Error boundary por shape
- Novo `ShapeErrorBoundary` envolvendo cada shape render no `NodeRenderer`. Shape que lança → placeholder de erro no lugar do nó: retângulo do bounds do nó, fill `--btv-gate-pending`-like neutro (`#FAF9F6`), borda tracejada `--btv-error` 1.5, ícone "!" e o nome do tipo em mono 9px. Canvas, demais nós e toolbar **sobrevivem**.
- O erro é reportado via `onEditorEvent({ type: 'shape.render.error', meta: { nodeId, nodeType, message } })` (callback especificado no Handoff 2 §2 — se ainda não existir no `EditorConfig`, esta PR o introduz).
- Reset do boundary quando o nó ou suas properties mudam (retry automático após edição).

### D2. Autosave + recovery
- Autosave do diagrama em edição para `localStorage` (chave namespaced `bpmnr:autosave:<diagramId>`), debounce 2s após comando, serializando via o export existente. Guardar também `savedAt`.
- No mount, se existir autosave **mais novo** que o documento carregado: banner de recovery no topo do canvas — "Rascunho não salvo de 14:32 encontrado · [Restaurar] [Descartar]". Banner segue o padrão visual do aviso âmbar (`#FDF6E8` / borda `#E8D9AE` / texto `#7A611E`).
- Restaurar = importar o autosave via command bus (undoável). Descartar = apagar a chave. Autosave limpo em save/export explícito.
- Opt-out: `EditorConfig.autosave?: false`.

### D3. Guarda de saída
- `beforeunload` quando houver comandos não salvos desde o último export/save (dirty flag no command bus). Opt-out junto com autosave.

### Aceite D
1. Teste: shape que lança (fixture com shape sabotado via plugin) renderiza placeholder e não derruba os irmãos; evento `shape.render.error` emitido.
2. e2e: editar → reload → banner aparece → Restaurar recupera o estado; Descartar limpa.
3. e2e: sair com mudanças pendentes dispara o prompt do navegador (verificável via Playwright `dialog`).

---

## PARTE A — `@buildtovalue/conformance` (F8 como produto)

Novo pacote `packages/conformance`. Headless, zero deps, consome só `@buildtovalue/core`.

### A1. Corpus de interoperabilidade (PR-A1)
- `packages/conformance/corpus/` com **≥ 50 arquivos BPMN externos reais**: Camunda (modeler exports), bpmn.io demos, exemplos da spec OMG, Signavio quando disponível. Cada arquivo com header-comment de origem/licença. Sem arquivo proprietário sem permissão — quando não puder incluir, gere equivalente estrutural e documente.
- Suíte `corpus.test.ts`: para cada arquivo — import sem erro fatal, warnings registrados, re-export, **re-import do re-export idêntico** (`normalizeForDiff`). Snapshot da contagem de warnings por arquivo (regressão de fidelidade detectável).
- Matriz `CONFORMANCE.md` **gerada por script** (`scripts/gen-conformance.ts`): tabela elemento a elemento (as ~40 linhas da matriz do roadmap em `docs/`), status derivado de anotações nos testes (`@conformance bpmn:boundaryEvent supported`), classes Descriptive/Analytic calculadas. Gerado no CI; diff não commitado = falha (mesmo padrão do apiSurface).

### A2. XSD + certify (PR-A2)
- Validação XSD **opcional, só CLI/Node** (browser mantém validação estrutural XXE-safe — decisão do Handoff 2 §3). Zero deps: incluir os XSDs oficiais da OMG em `packages/conformance/schemas/` (BPMN20.xsd + dependências, são redistribuíveis) e um validador estrutural próprio dirigido pelo XSD **OU**, se implementar XSD completo custar demais, validar contra um manifesto JSON gerado do XSD em build-time (documentar a escolha em `pendencias.md`).
- `bpmn-react certify <arquivo.bpmn>` no CLI:
  ```
  ✔ XML bem-formado · XXE-safe
  ✔ Perfil: Descriptive 100% · Analytic 92% (faltam: transaction, compensation)
  ✔ Round-trip lossless
  ⚠ 2 warnings: complexGateway degradado (linha 74), DI ausente em 1 elemento
  Classe declarável: DESCRIPTIVE ✅ · relatório: certify-report.json
  ```
  Saída humana + `--json` para CI de terceiros. Exit code ≠ 0 se a classe pedida via `--require descriptive|analytic` não for atingida.
- README do repo passa a declarar a classe suportada com link para `CONFORMANCE.md`.

### Aceite A
1. Corpus ≥ 50 arquivos, todos round-trip verde; snapshot de warnings estável.
2. `CONFORMANCE.md` gerado, coberto por teste de frescor no CI.
3. `certify` funciona nos 50 arquivos do corpus + nos 3 fixtures inválidos (retornos corretos de exit code).

---

## PARTE C — `@buildtovalue/soundness` (análise semântica de processos)

Novo pacote `packages/soundness`. Headless, zero deps. Exporta regras no formato `validationRules` do plugin system — o react e o CLI as consomem sem código novo de integração.

### C1. Regras estruturais de grafo (PR-C1)
Cada regra: código estável, severidade, mensagem PT/EN, elementos envolvidos.

| Código | Severidade | Detecta |
|---|---|---|
| `SND_DEADLOCK_JOIN` | error | AND-join cujos caminhos de entrada se originam de um XOR-split (nunca sincroniza) |
| `SND_UNMATCHED_SPLIT` | warning | gateway split sem join correspondente do mesmo tipo no fluxo (heurística de pareamento por dominância) |
| `SND_NO_PATH_TO_END` | error | nó do qual não existe caminho até nenhum end event |
| `SND_INFINITE_LOOP` | warning | ciclo sem nenhuma aresta de saída do ciclo (livelock estrutural) |
| `SND_DEAD_BRANCH` | warning | aresta de gateway cujo alvo é inalcançável a partir do start (ramo morto) |
| `SND_BOUNDARY_NO_OUTFLOW` | error | boundary event sem sequence flow de saída (handler vazio) |
| `SND_EVENT_GW_TARGETS` | error | eventBasedGateway cujo alvo não é catch event/receiveTask (regra da spec) |
| `SND_LANE_NO_ACTOR` | info | lane sem nenhum nó (raia vazia — ruído de modelo) |
| `SND_IMPLICIT_MERGE` | info | nó com 2+ entradas sem gateway (merge implícito — legal na spec, hostil à leitura) |

- Implementação: construir grafo dirigido uma vez por validação (adjacência por `sourceRef/targetRef`), análises por DFS/BFS/SCC (Tarjan para ciclos). Sem pesquisa exaustiva de estados (nada de state space explosion — só análise estrutural, O(V+E) por regra).
- Deve atravessar hierarquia de subProcess quando F7 estiver merged (cada subProcess analisado como subgrafo + regra de fronteira: start/end dentro do subprocesso).

### C2. Integração com o gate de promoção (PR-C2)
- Regras `error` de soundness **bloqueiam promoção para active** via a rules engine existente (mesmo mecanismo do multi-role). O PromotionPanel (PR6) mostra a seção "Soundness" no checklist: verde "9 regras · 0 erros" ou vermelho com os códigos e link "ver no canvas".
- No canvas: os erros usam o overlay de erro de validação já especificado (badge `!` no nó — pendência §5 dos estados de shape; se ainda não implementado, esta PR entrega o overlay junto).
- Config: `soundnessRules({ severityOverrides?, disabled?: string[] })` — empresas ajustam sem fork.

### Aceite C
1. Fixture por regra (mínimo 2 por regra: dispara / não dispara), incluindo um processo "clássico armadilha" (XOR-split → AND-join) e um processo são complexo que passa limpo.
2. Performance: análise completa < 50ms para 350 nós (benchmark no teste).
3. e2e: diagrama com deadlock → promoção bloqueada com código `SND_DEADLOCK_JOIN` visível no modal.

---

## PARTE B — `@buildtovalue/audit` (integridade demonstrável + XES)

Novo pacote `packages/audit`. Headless, zero deps, consome `@buildtovalue/core` + `@buildtovalue/registry`.

### B1. Verificação e atestado (PR-B1)
- `verifyLedger(ledger): VerificationReport` — reverifica a cadeia completa de hashes e retorna `{ intact: boolean, entries: n, firstBreak?: { index, expected, actual }, verifiedAt }`. Hoje a integridade é assumida; isto a torna demonstrável sob demanda.
- `attestVersion(registry, diagramId, version): Attestation` — snapshot assinável do momento da promoção: `{ xmlHash, ledgerHeadHash, version, status, effectiveFrom, approvers, attestedAt }`, serializável em JSON canônico (reusar `canonicalJson`). O PromotionPanel passa a gravar o attestation no ledger ao ativar (1 linha na PR6 ou follow-up).
- CLI: `bpmn-react audit <ledger.json>` → relatório humano + `--json`; exit ≠ 0 se quebrado.
- UI (react, mínima): o "ledger íntegro ✓" da status bar dos protótipos deixa de ser decorativo — clicar roda `verifyLedger` e mostra o relatório num popover.

### B2. Export XES (PR-B2)
- `toXES(ledger, opts): string` — converte o ledger + eventos do registry em XES 2.0 (XML padrão IEEE para process mining): cada versão = trace; comandos/promoções/execuções = events com `concept:name`, `time:timestamp`, `org:resource` (autor), lifecycle.
- Habilita minerar o "processo real de design" vs. o documentado em qualquer ferramenta de mining (ProM, Celonis, Disco) — diferencial registrado em `pendencias.md` §5.
- CLI: `bpmn-react export-xes <ledger.json> -o log.xes`. Round-trip test: XES gerado valida contra o schema XES (mesma abordagem de validação da parte A).

### Aceite B
1. `verifyLedger` detecta adulteração em fixture corrompida (1 byte mudado) apontando o índice exato.
2. Attestation determinístico (mesmo input → mesmo JSON canônico → mesmo hash).
3. XES de um ledger de exemplo abre sem erro em validador XES (fixture de referência no teste).

---

## 2. Impacto nos pacotes existentes (resumo)

- `packages/cli`: 3 subcomandos novos (`certify`, `audit`, `export-xes`) — o CLI vira a interface de confiança para CI de terceiros.
- `packages/react`: PR-D1 (boundary/autosave/guarda) + popover do ledger (B1) + seção soundness no PromotionPanel (C2) + overlay de erro nos nós (C2, resolve pendência §5 estados de shape).
- `packages/registry`: nenhum breaking change; `attestVersion` só lê.
- CI: os testes dos pacotes novos entram no pipeline padrão; `CONFORMANCE.md` com verificação de frescor.

## 3. O que NÃO fazer

- Não adicionar dependência de runtime (nem para XSD, nem para XES) — a lei do repo vale para os pacotes novos.
- Não implementar verificação criptográfica assimétrica (assinatura digital com chaves) — attestation é hash-based; PKI é decisão de produto futura, registrar em `pendencias.md` se houver demanda.
- Não fazer análise de state space no soundness (explosão combinatória) — só análise estrutural de grafo.
- Não publicar no npm sem a decisão de escopo do dono (`pendencias.md` §1).
- Não bloquear promoção por warnings/info de soundness — só por `error`.

## 4. Definição de pronto global

Cada PR: pipeline completo local + run do GitHub Actions verde **confirmada** antes do merge (regime corrigido após PRs #11/#12). Piso de cobertura não regride. Códigos de regra e formatos de relatório (`certify-report.json`, `VerificationReport`, attestation) são contratos públicos — cobertos por apiSurface tests como os demais.

Ao concluir: atualizar `pendencias.md` (§§ resolvidos: XES, estados de shape §5.3) e o README com os selos: classe de conformidade + "ledger verificável" + contagem do corpus.
