# Handoff 11: Biblioteca como produto npm — dívidas, superfícies e DX

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–10 (programa executado)
**Pré-requisito:** nenhum novo — main verde pós-Handoff 9. Alimenta diretamente a I-6 (publish) e o futuro handoff de adoção.
**Data:** julho 2026 · Origem: triagem de 3 análises externas × estado real da main

---

## 0. Tese

O programa 1–10 construiu um produto completo. Este handoff o transforma em **dependência npm que terceiros adotam sem ler o código-fonte**: fecha as dívidas registradas em `pendencias.md`, entrega as superfícies pendentes e adiciona a camada de DX que toda biblioteca consumível precisa (eventos públicos, i18n, viewer leve, a11y, docs).

**Triagem (vinculante — não reimplementar o que existe):** as análises externas sugeriram itens JÁ entregues: subProcess aninhado (F7), `dmn:decisionTable` canônico (#63), OR-join exato (#65), API de copiloto com provider injetado (H9), fix de soundness (C5), explicar (C3), virtualização, XES+fitness (7B), assinatura de versões (H8), SACM print-ready, CLI de CI/CD, paleta/custom nodes (plugin system), theming. Se alguma sugestão parecer nova, confira a main antes. **Rejeitados por decisão:** WebSockets/CRDT (quebra client-side), merge de diagramas (pesquisa), marketplace (prematuro), engine de execução e CMMN (fora de propósito declarado), streaming XML e hit policies A/P/R/O/C (sob demanda — registrados).

Leis inalteradas: zero runtime deps; headless/react separados; injeção + degradação; uma PR por vez, run do Actions confirmada verde antes e depois do merge; `apiSurface` test para toda API pública nova.

## 1. Escopo — 11 itens em 8 PRs

| PR | Item(ns) | Pacotes |
|---|---|---|
| N-1 | Boundary drag-to-attach + reflow por t | core + react |
| N-2 | Corpus real ≥20 + XSD opcional (`certify --xsd`) | conformance + cli |
| N-3 | Event bus público documentado | core + react |
| N-4 | Banner "CADEIA ≠ ÂNCORA" no Ledger Explorer | react/studio + audit |
| N-5 | ContextMenu como surface plugável (aresta primeiro) | react |
| N-6 | i18n via prop | react + studio |
| N-7 | Modo viewer (`<BpmnViewer>`) | react (entry point novo) |
| N-8 | Passe de a11y + Web Workers opcionais + TypeDoc | react + core + docs |

Protótipo (`design-refs/Biblioteca NPM BTV.dc.html`, 3 abas) cobre as superfícies com UI nova: N-4 (os 3 resultados de verificação, incluindo trilha com entradas não-confiáveis), N-5 (menu com built-ins condicionais + seção de plugin) e N-7 (viewer com o que tem/não tem). Os demais itens não têm UI nova.

## 2. Specs por PR

### N-1 · Boundary events: drag-to-attach + reflow (pendências §6)
- Arrastar um evento sobre a borda de uma activity: highlight da borda (stroke selected 2, 120ms) quando dentro da zona de snap (12px); soltar cria `attachedToRef` + posição paramétrica (lado + t ∈ [0,1]) — **um** comando undoável. Arrastar para fora desanexa (vira intermediate) com confirmação implícita pelo próprio gesto (undo reverte).
- Resize do host: boundary mantém `t` (reflow proporcional) — já é o modelo de dados; implementar o reflow visual no resize.
- e2e: anexar por drag, mover host (boundary acompanha — já coberto), resize (t preservado), desanexar, undo de cada um.

### N-2 · Corpus real + XSD (pendências §8.1 + §7)
- ≥20 arquivos reais: `bpmn-io/bpmn-js-examples` (MIT) e quick-starts Camunda (Apache-2.0) — cada arquivo com header de origem/licença; suíte de round-trip + snapshot de warnings como no corpus atual. Meta: proporção real/gerado registrada no `CONFORMANCE.md` gerado.
- `certify --xsd`: validação contra os XSDs oficiais em CLI/Node (browser continua estrutural — decisão do H4 mantida). Se implementar validador XSD completo custar demais, o manifesto estrutural atual **derivado do XSD em build-time** é aceitável — mas o flag deve então chamar-se `--strict` e documentar a diferença (nunca chamar de XSD o que não é).
- Aceite: 20+ reais round-trip verdes; `certify` classifica os 3 fixtures inválidos com exit codes corretos.

### N-3 · Event bus público (generalização do `onEditorEvent`)
- Catálogo estável e documentado: `diagram.loaded`, `element.added|changed|removed`, `edge.connected`, `selection.changed`, `command.executed|undone`, `validation.changed`, `promotion.completed`, `import.warning`, `render.slow`. Payloads tipados, exportados.
- Mesmo canal existente (`onEditorEvent`), agora com o catálogo completo + `apiSurface` test do enum de eventos e dos tipos de payload. Sem emitter global — continua callback injetado (zero deps).
- Documentar contrato de estabilidade: adicionar evento = minor; mudar payload = major.
- Aceite: teste que exercita cada evento do catálogo; doc gerada lista todos.

### N-4 · Banner "CADEIA ≠ ÂNCORA" (pendências §10 — detecção pronta, falta superfície)
Spec no protótipo, aba 1. Os **3 resultados** da verificação no Ledger Explorer:
1. **Íntegra e ancorada** — banner verde: n/n, head local = âncora (com fonte e timestamp), link VerificationReport.
2. **Íntegra · ancoragem pendente** — banner âmbar (estado do H8 §1.3): garantia vigente declarada + botão retentar.
3. **CADEIA ≠ ÂNCORA** — banner `--btv-error` borda 1.5: heads exibidos (local ≠ ancorado), **índice de divergência**, e a trilha marca a entrada divergente e todas as posteriores com fundo `#F7E6E0` + "não-confiável". `ANCHOR_RECORDED` como entrada própria no ledger (audit).
- Aceite: fixture com âncora divergente → banner 3 + entradas marcadas (e2e); os 3 estados cobertos.

### N-5 · ContextMenu plugável (pendências §11.3 + DX)
Spec no protótipo, aba 2.
- Novo ponto no contrato de plugin: `contextMenuItems?: (target: MenuTarget) => MenuItem[]` — `MenuTarget` = aresta/nó/canvas com contexto (tipo, estado, seleção). Built-ins da aresta: "Voltar ao automático" (só se manual), "Adicionar waypoint aqui", "Editar rótulo". Itens de plugin em seção separada com kicker do plugin.
- Menu: teclado navegável (setas + Enter + Esc), entra na pilha de dismissal do Esc (H5 §11.1), posicionamento com flip nas bordas, hit-targets 44px em touch. Ações disparam **comandos** — o menu nunca muta estado.
- Escopo desta PR: aresta completa + infraestrutura; nó/canvas ficam com built-ins mínimos (registrar extensões futuras em pendencias).
- Aceite: e2e voltar-ao-automático via menu; teste de plugin registrando item custom; a11y do menu (foco/Esc).

### N-6 · i18n via prop
- `EditorConfig.locale?: LocaleDict` — dicionário plano de chaves estáveis (`palette.task`, `promotion.approve`, `soundness.SND_DEADLOCK_JOIN.message`…). PT-BR e EN embarcados como dicts exportados; default EN.
- As mensagens de soundness/validação já são PT/EN — unificar nesse mecanismo. Chave ausente → fallback EN + warning único no console (nunca chave crua na UI).
- `apiSurface` do formato do dict; teste de completude: todo texto de UI passa pelo lookup (grep de literais PT/EN hardcoded no CI — mesma técnica dos guardrails).
- Aceite: trocar locale em runtime re-renderiza; dict custom parcial funciona com fallback.

### N-7 · Modo viewer (`<BpmnViewer>`)
Spec no protótipo, aba 3.
- Entry point separado (`@buildtovalue/react/viewer`) tree-shakeable: **tem** pan/zoom/fit, seleção read-only com tooltip, selo de vigência opcional, export PNG/SVG, overlays injetáveis (heatmap do replay funciona nele); **não carrega** paleta, inspector, command bus de edição, undo, drag.
- Mede-se: bundle do viewer ≤ 50% do editor completo (teste de tamanho no CI com limiar registrado).
- Aceite: demo de dashboard com 3 viewers; teste de que nenhum módulo de edição entra no grafo do entry point (mesma técnica do teste de deps).

### N-8 · a11y + Workers + docs
- **A11y (passe sistemático):** navegação por teclado completa no canvas (Tab entre elementos, setas movem seleção, Enter abre inspector), `aria-label` derivado de tipo+nome em todo elemento, foco visível (outline `--bpmnr-selected` 2px offset 2), live region para toasts/validação. Auditar com axe no e2e (violações críticas = 0 como gate).
- **Web Workers opcionais:** `EditorConfig.offloadHeavyOps?: boolean` — soundness, diff e verifyLedger rodam em worker via wrapper injetável (`createWorkerRunner` exportado; host decide). Degradável: sem worker, síncrono como hoje. Zero deps: worker gerado de blob do próprio bundle.
- **TypeDoc:** docs de API geradas por pacote no CI (artefato), publicáveis no futuro site de adoção; frescor verificado como o CONFORMANCE.
- Aceite: axe zero-crítico; soundness de 350 nós não bloqueia a UI com workers on (teste de responsividade); docs geradas sem warnings de tipos não exportados.

## 3. Critérios de aceite globais

1. Cada API pública nova coberta por `apiSurface` test; contratos de payload/dict/menu são estáveis.
2. Tudo degradável: sem locale → EN; sem workers → síncrono; sem plugin de menu → built-ins; viewer sem props extras → só diagrama.
3. Zero runtime deps preservado em todos os itens (incluindo XSD e workers).
4. Pisos de cobertura não regridem; e2e novos por superfície (N-1, N-4, N-5, N-7, a11y).
5. `pendencias.md` atualizado: §6, §7, §8.1, §10, §11.3 fechados; novos diferimentos registrados.

## 4. O que NÃO fazer

- Não reimplementar itens da lista "já entregue" (§0) — confira a main na dúvida.
- Não criar emitter global nem dependência de rede/SDK em nenhum item.
- Não chamar de "XSD" validação que não valide contra o XSD (N-2).
- Não deixar o menu de contexto mutar estado fora de comandos.
- Não publicar no npm — I-6 continua aguardando `NPM_TOKEN`/OIDC do dono (este handoff a deixa mais valiosa, não a substitui).
