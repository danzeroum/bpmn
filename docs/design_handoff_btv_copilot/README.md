# Handoff 9: Copiloto de Processos — IA governada + S-FEEL mínimo

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–8
**Pré-requisito:** Handoff 8 (assinaturas) merged — a autoria de IA no ledger só tem força quando aprovações humanas são assinadas. Usa DMN (Handoff 5 F-B) quando presente; degrada sem ele (§4).
**Data:** julho 2026

---

## 0. Tese

O produto modela squads onde humanos e IA trabalham juntos (btv:prompt, persona "Agente SDR") — mas a ferramenta em si não usa IA. Este handoff fecha o círculo com a regra que dá nome ao handoff: **IA rascunha, humanos assinam.** A IA é mais um ator governado: toda contribuição entra como comando undoável com autoria própria no ledger, todo output é rascunho no pipeline normal (soundness → diff → promoção assinada), e a IA **nunca** promove, aprova ou assina.

Segunda entrega: **avaliação S-FEEL mínima** para o `businessRuleTask` do simulador (Handoff 7) rotear de verdade por decision tables — cercada a um subconjunto documentado, nunca um interpretador FEEL completo.

## 1. Cercas vinculantes

1. **IA nunca promove, aprova ou assina.** O `AIProvider` não tem acesso a `promote()`, `evaluateGates()`, `Signer` nem a qualquer comando de governança. Só produz propostas que viram comandos de edição (draft). Teste de CI: grep de imports proíbe `identity`/rules de promoção no pacote copilot.
2. **Autoria de IA é explícita e imutável.** Toda entrada de ledger originada de proposta aceita registra `author: "ia.copilot@<modelo>"` + o hash do prompt-template usado + o id da conversa. Nunca se apresenta contribuição de IA como humana — e o selo de autoria mista ("ia.copilot + ana.ruiz") aparece no header do rascunho.
3. **Propostas viram comandos, nunca mutação.** O output da IA é um plano de comandos (`ProposedCommand[]`) aplicado via command bus — undoável de uma vez ("Desfazer tudo"), diffável, auditável. Proibido a IA escrever XML/estado diretamente.
4. **Provider injetado, tudo degradável.** `AIProvider` é contrato do host (mesmo padrão Signer/AnchorAdapter). Sem provider → painel não aparece e TUDO funciona. Zero deps: nenhum SDK de LLM no repo; o transport é do host.
5. **Dogfooding: os prompts do copiloto são artefatos versionados.** Cada capacidade (draft, ajuste, explicar, change_summary, fix de soundness) usa um prompt-template registrado como artefato com lifecycle na Biblioteca (adapter próprio — "PROMPT DO COPILOTO"). Mudar o prompt = nova versão promovível. O header do painel mostra "prompt: copilot-draft v1.2.0 ativa".
6. **S-FEEL: lista de exclusão explícita e falha honesta.** Subconjunto suportado (§5); célula fora dele → decisão **"não-simulável"** declarada (token para com aviso) — nunca avaliação silenciosamente errada, nunca "quase FEEL".
7. **Sem telemetria de conteúdo.** Nada do que o usuário digita ou do diagrama sai do cliente exceto via o provider injetado pelo host — e isso é documentado no README do pacote ("o host decide o que trafega").

## 2. Arquivos deste pacote

- `design-refs/Copiloto BTV.dc.html` — protótipo interativo: canvas vazio → "Gerar rascunho" → diagrama de reembolso com pool/2 lanes/5 nós + businessRuleTask com tabela DMN S-FEEL, selo RASCUNHO com autoria mista no header, resposta com autoria/ledger/soundness, tabela DMN com marcador "✓ dentro do S-FEEL", pedido de ajuste (3ª regra + AND paralelo), card de honestidade S-FEEL, "Desfazer tudo".
- `screenshots/` — estados (§8).

## 3. Arquitetura

```
packages/copilot        @buildtovalue/copilot        headless: contrato AIProvider, orquestração das
                                                     capacidades, validação/parse de propostas em
                                                     ProposedCommand[], guarda-corpos (§1.1). Consome
                                                     core (tipos, command specs) e soundness (validar
                                                     ANTES de propor). Zero deps, zero network.
packages/sfeel          @buildtovalue/sfeel          headless: parser+avaliador do subconjunto S-FEEL.
                                                     ZERO imports do ecossistema (opera sobre células
                                                     string + contexto {var: valor} — teste de acidez
                                                     com tabela fake, mesmo padrão replay/library).
packages/react (ext.)   CopilotPanel + selo de autoria mista + integrações (§4)
```

- `copilot` valida toda proposta: comandos desconhecidos → rejeição da proposta inteira com erro legível (nunca aplicação parcial silenciosa); soundness roda sobre o resultado projetado ANTES de apresentar ("soundness: 0 erros ✓" na resposta).
- `sfeel` serve ao simulador (Handoff 7) e ao editor DMN (Handoff 5) — por isso não importa nenhum dos dois.

### Contratos

```ts
interface AIProvider {                    // implementado pelo HOST
  id: string;                             // "claude-4", "local-llm"…
  complete(req: { system: string; messages: Msg[]; schema?: JsonSchema }): Promise<string>;
}
interface ProposedCommand { type: string; params: object }        // whitelist = command specs do core
interface CopilotProposal {
  commands: ProposedCommand[];
  rationale: string;                      // exibido na resposta
  promptTemplateRef: { id: string; version: string };             // §1.5
  soundnessPreview: { errors: number; warnings: number };         // §computado localmente, não pela IA
}
```

## 4. Capacidades (cada uma = 1 prompt-template versionado)

| # | Capacidade | Entrada → Saída | Integração |
|---|---|---|---|
| C1 | **Texto → rascunho** | descrição em linguagem natural → `CopilotProposal` (nós, gateways, lanes, DI por layout automático existente) | decisões de alçada viram businessRuleTask + tabela DMN quando o pacote DMN existe; sem DMN → gateway XOR com condições em label (degradação declarada) |
| C2 | **Ajuste conversacional** | "acima de 5.000 passa pelos dois" → proposta incremental sobre o rascunho | mesma validação; avisos de impacto ("exige AND-join — soundness ✓") |
| C3 | **Explicar** | diagrama/versão/diff → explicação em linguagem natural | botão na Revisão do Aprovador e no Studio; read-only, sem comandos |
| C4 | **change_summary automático** | diff real → texto proposto no campo do PromotionPanel | humano edita e **assina** — a IA nunca submete |
| C5 | **Fix de soundness** | erro SND_* selecionado → proposta de correção como comandos | botão "sugerir correção" no painel de erros; aplicação = C2 |
| C6 | **Consulta ao ledger** | "quem aprovou a v2.1.0?" → resposta com **citações de entradas (hashes) como evidência** | Ledger Explorer; regra: sem entrada citável → "não encontrei registro", nunca inventar |

## 5. S-FEEL mínimo (`@buildtovalue/sfeel`)

**Suportado** (unários de entrada + literais de saída):
- Comparações: `< n`, `<= n`, `> n`, `>= n`, `= v`
- Ranges: `[a..b]`, `]a..b[` e mistos
- Listas de valores: `"a", "b"` (OR implícito)
- Negação de lista: `not("a", "b")`
- Irrelevante: `-`
- Tipos: number, string, boolean
- Hit policies: **U, F** (Unique, First) — as que o simulador precisa; A/P/R/O/C ficam no editor como metadado, avaliação registrada como pendência

**Excluído (lista explícita — cerca §1.6):** invocação de função (`date()`, `duration()`…), aritmética em células, `for`/`some`/`every`, contextos aninhados, tipos data/hora/duração, expressões de saída não-literais.

Comportamento: `evaluate(table, context)` → `{ result }` | `{ nonSimulable: { cell, reason } }`. O simulador exibe: token para no businessRuleTask com aviso "decisão não-simulável: célula 'date(...) > x' fora do subconjunto S-FEEL" + link para limitations.md. O editor DMN marca células fora do subconjunto com ícone ⚠ "não-simulável" já em edição (feedback antes da simulação).

## 6. Spec de UX

- **Painel Copiloto** (372px, à direita): header com ✦, provider e versão do prompt-template + pill `SÓ RASCUNHA` azul; chat com mensagens do usuário (âmbar, direita) e respostas (papel, esquerda) — toda resposta com bloco mono de rodapé: autoria, hash do ledger, soundness preview; botão primário azul "✦ Gerar rascunho do processo" quando canvas vazio.
- **Selo de rascunho com autoria mista** no header do Designer: `◌ RASCUNHO v0.1.0 · autoria: ia.copilot@claude-4 + ana.ruiz` (azul `#33567E` para a parte IA).
- **Tabela DMN no chat**: renderização compacta da decisão gerada com coluna de marcador ✓/⚠ por linha (dentro/fora do S-FEEL) e legenda.
- **Ações da proposta**: "Desfazer tudo" (1 clique, o plano inteiro) + "Pedir ajuste…". Aplicação é imediata-mas-undoável (não modal de confirmação — o undo É a confirmação, padrão do repo).
- **Card de honestidade S-FEEL** (âmbar) fixo no painel quando há DMN no diagrama.
- IA **não** tem cor própria de nó no canvas — contribuição de IA não muda a notação; a distinção vive no ledger e nos selos (decisão: a notação descreve o processo, não a autoria).

## 7. Ordem das PRs

1. **SF-1** `feat(sfeel): @buildtovalue/sfeel — parser + avaliador do subconjunto` (headless, acidez com tabela fake, vetores de teste por regra da §5, fuzzing leve de células malformadas → erro estruturado)
2. **SF-2** `feat(simulation+dmn): businessRuleTask roteia via sfeel no simulador` (integração por injeção; estado não-simulável no token + ⚠ no editor)
3. **CP-1** `feat(copilot): @buildtovalue/copilot — contratos + validação de propostas + guarda-corpos` (whitelist de comandos, soundness preview, teste de grafo de deps + grep anti-governança)
4. **CP-2** `feat(react): CopilotPanel + C1/C2 (rascunho + ajuste)` (e2e com provider fake determinístico; autoria no ledger; desfazer tudo)
5. **CP-3** `feat(react/studio): C3/C4 (explicar + change_summary)` (Revisão + PromotionPanel; assinatura humana obrigatória inalterada)
6. **CP-4** `feat(react): C5/C6 (fix de soundness + consulta ao ledger com citações)`
7. **CP-5** `feat(library): adapter de prompt-templates do copiloto + versão no header do painel` (dogfooding §1.5)

## 8. Critérios de aceite

1. **Guarda-corpos:** proposta com comando fora da whitelist → rejeição íntegra com mensagem; grep de CI prova ausência de imports de governança no copilot; nenhum caminho de código IA → promote/sign (teste).
2. **Autoria:** aplicar proposta → entradas de ledger com `ia.copilot@<modelo>` + promptTemplateRef; Ledger Explorer as exibe com selo próprio; C4 nunca submete sem edição/assinatura humana (e2e).
3. **Undo:** "Desfazer tudo" reverte o plano inteiro em 1 comando; redo o reaplica.
4. **S-FEEL:** vetores por regra suportada; cada item da lista de exclusão → `nonSimulable` com célula e razão; simulador para com o aviso honesto (e2e); hit U com 2 matches → erro declarado (violação de Unique), F retorna a primeira.
5. **Degradação:** sem AIProvider → painel ausente, zero regressão; sem DMN → C1 gera XOR com labels e declara a degradação na resposta.
6. **Provider fake nos testes:** todo e2e usa provider determinístico local (fixture de respostas) — CI nunca chama rede.
7. **Honestidade de conteúdo:** README do copilot documenta o fluxo de dados (nada sai do cliente exceto via provider do host).

## 9. Screenshots

| Arquivo | Estado |
|---|---|
| `01-copiloto.jpg` | Canvas vazio + painel com pedido em linguagem natural e botão gerar |
| `02-copiloto.jpg` | Rascunho aplicado: diagrama completo, selo autoria mista, resposta com ledger/soundness, tabela DMN ✓ |
| `03-copiloto.jpg` | Ajuste conversacional: 3ª regra + aviso de AND-join validado |

## 10. O que NÃO fazer

- Não dar à IA nenhum caminho para promover/aprovar/assinar (cerca §1.1) — nem "modo auto" opcional.
- Não aplicar propostas parcialmente nem mutar estado fora do command bus (§1.3).
- Não embutir SDK de LLM, chave de API ou telemetria de conteúdo (§1.4/§1.7).
- Não implementar FEEL além do subconjunto (§5) — "quase FEEL" é o bug mais caro; registrar demanda em pendencias.md.
- Não inventar resposta na C6 sem entrada de ledger citável.
- Não criar cor de nó para "feito por IA" — autoria vive no ledger e selos, não na notação.
