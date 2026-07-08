# Handoff 6: BuildToValue Studio — Biblioteca genérica + Revisão do Aprovador + Ledger Explorer

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–5
**Pré-requisito:** Trust Layer (Handoff 4) merged. **Independente do Handoff 5** (BPM+) — pode ser executado em paralelo ou depois; onde houver DMN, a Biblioteca o trata como mais um tipo via adapter (§3).
**Data:** julho 2026

---

## 0. Tese

Tudo até aqui serve **uma persona: quem modela**. O ciclo de governança construído (lifecycle, multi-role, ledger, attestation, soundness, certify) tem três personas sem tela: **quem consome** artefatos (Biblioteca), **quem aprova** (Revisão) e **quem audita** (Ledger Explorer). Este handoff cria a camada de aplicação que fecha o ciclo — quase toda em React puro sobre APIs que já existem.

**Requisito estrutural do dono do produto (vinculante):** a Biblioteca é **genérica e independente** — não conhece BPMN, DMN, prompts nem nenhum tipo concreto. Ela cataloga *qualquer artefato versionável* do ecossistema BuildToValue através de um contrato de adapter (§3). As bibliotecas existentes e futuras (`core`, `registry`, `dmn`, healthcare, o que vier) se **conectam a ela**, nunca o contrário.

Leis do repo inalteradas: zero runtime deps; headless + React separados; PRs estratégicas, run do Actions confirmada verde antes e depois do merge; escopo npm conforme pendência §1 (recomendação registrada: `@buildtovalue/*`).

## 1. Arquitetura de pacotes

```
packages/library          <scope>/library          headless: catálogo genérico + contrato ArtifactAdapter
packages/library-react    <scope>/library-react    React: galeria, filtros, drawer, selos (UI da Biblioteca)
packages/studio           <scope>/studio           aplicação: shell (nav), Revisão, Auditoria; compõe library-react
packages/adapters-bpmn    <scope>/adapters-bpmn    adapters concretos: diagrama BPMN, persona, prompt, connector, política (sobre registry)
```

- **`library` não importa nada do ecossistema** (nem `core`, nem `registry`). Só define tipos + lógica de catálogo (busca, filtro, ordenação, agrupamento). É publicável e utilizável por terceiros para catalogar artefatos que não são BPMN.
- `adapters-bpmn` é quem conhece `registry`/`core` e traduz para o contrato. Um futuro `<scope>/dmn` entrega seu próprio adapter (1 arquivo) e as decisões DMN aparecem na Biblioteca **sem nenhuma mudança nela** — este é o teste de acidez da arquitetura.
- `studio` é a única camada com composição de produto (nav entre as 3 telas, roteamento, papel do usuário).

## 2. Arquivos deste pacote

- `design-refs/Biblioteca de Templates BTV.dc.html` — protótipo interativo (origem: Handoff 3, agora comissionado)
- `design-refs/Revisao do Aprovador BTV.dc.html` — protótipo interativo novo
- `design-refs/Ledger Explorer BTV.dc.html` — protótipo interativo novo
- `screenshots/` — estados capturados (§7)

Como sempre: são referências hifi em HTML — recriar em React nos padrões do repo, não copiar. Tokens, selos e componentes citados já existem (tabela canônica de selos no Handoff 3 §5; StatusBadge/DiffView/GovernanceBreadcrumb no react).

## 3. Contrato `ArtifactAdapter` (o coração do handoff)

```ts
// <scope>/library — headless, zero deps
interface ArtifactRef { adapterId: string; artifactId: string }

interface ArtifactSummary {
  ref: ArtifactRef;
  name: string;
  typeLabel: string;              // "FLUXO", "PERSONA", "DECISÃO"… — livre, do adapter
  version: string;                // semver da versão relevante ao canal do observador
  status: LifecycleStatus;        // 'draft'|'test'|'candidate'|'active'|'deprecated'|'retired'
  channel?: string;
  boundRuns?: number;             // execuções presas (bindRun) — opcional
  meta?: string;                  // linha livre de contexto
  thumbnail?: ThumbnailSpec;      // ver §3.1
}

interface ArtifactDetail extends ArtifactSummary {
  effectiveFrom?: string; effectiveUntil?: string;
  approvers?: string[]; changeSummary?: string;
  provenance?: { ledgerHash: string; author: string; createdAt: string };
  versions: VersionEntry[];       // linha do tempo completa
  actions: ArtifactAction[];      // ver §3.2
}

interface ArtifactAdapter {
  id: string;                     // "bpmn-diagram", "prompt", "dmn-decision"…
  typeLabel: string;
  list(query: LibraryQuery): Promise<ArtifactSummary[]>;
  get(id: string): Promise<ArtifactDetail>;
  subscribe?(cb: () => void): () => void;   // invalidação (opcional)
}
```

Regras:
- **`LifecycleStatus` é o único vocabulário compartilhado** — os 6 estados da tabela canônica. Adapter que tenha lifecycle diferente mapeia para esses 6 (documentando a perda).
- A Biblioteca **nunca** executa mutação: `actions` (§3.2) são descritores que o Studio roteia (abrir no Designer, diff, solicitar promoção). Read-only por construção.
- `library` valida adapters no registro (id único, typeLabel não vazio) — warning, não crash.

### 3.1 Thumbnails sem acoplamento
`ThumbnailSpec = { kind: 'svg', svg: string } | { kind: 'icon', icon: string } | { kind: 'none' }` — o **adapter** fornece a miniatura (o adapter BPMN desenha o mini-fluxo; o de prompt desenha a nota). A Biblioteca só posiciona. Proibido: a Biblioteca importar shapes de qualquer pacote.

### 3.2 Ações como descritores
`ArtifactAction = { id, label, kind: 'navigate'|'download'|'external', href?/payload? }`. O adapter declara ("Abrir no Designer", "Diff vs ativa", "Baixar attestation"); o host (Studio) resolve. A Biblioteca renderiza botões — sem lógica.

## 4. TELA 1 — Biblioteca (`library-react`, spec visual = protótipo do Handoff 3)

A spec pixel a pixel completa está no Handoff 3 §5 (grid, card, drawer, tabela canônica de selos) — **continua válida integralmente**. O que muda com a arquitetura genérica:

- Filtros de status vêm do `LifecycleStatus` (fixos); filtros de **tipo** vêm dos adapters registrados (dinâmicos — cada adapter é um chip com seu `typeLabel` e contagem).
- Chip de tipo no thumb do card = `typeLabel` do adapter.
- Drawer: seções `provenance`/vigência/aprovadores só renderizam se o adapter as fornecer (campos opcionais → UI opcional; nada de "N/A").
- Busca e ordenação (nome, atualização, status) implementadas no headless `library` — testáveis sem DOM.
- Props do `<LibraryView>`: `adapters: ArtifactAdapter[]`, `onAction(ref, action)`, `initialQuery?`. Nenhuma prop conhece tipos concretos.

## 5. TELA 2 — Revisão do Aprovador (`studio`)

Protótipo: `Revisao do Aprovador BTV.dc.html`. Layout: fila à esquerda (296px) + área de revisão central (máx 820px).

### Fila
- Header mono: "FILA DE APROVAÇÃO · SEU PAPEL: {papel}". Fonte: pedidos de promoção pendentes onde o papel do usuário está em `requiredApprovalRoles` e ainda não aprovou (API do rules engine — mesma fonte do PromotionPanel, **nunca duplicar a regra na UI**).
- Item: nome + semver · selo + progresso ("1/2 aprovações") · linha de SLA (âmbar quando < 3 dias). Selecionado: fundo `#FDFAF1` + filete esquerdo 3px dourado.

### Área de revisão (read-only absoluto)
Blocos, em ordem: cabeçalho do pedido (kicker "PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE", título + semver, solicitante/data/canal, selo com progresso) → **change_summary** (citação da solicitante) → **diff** (mesmo `DiffView` do PromotionPanel + link "abrir no canvas →" que abre o Designer em modo leitura na versão candidata) → **verificações automáticas** (grid 2×2: Soundness, Conformidade, Ledger, Dependências — cada card verde/vermelho vindo de `evaluateGates` + certify + verifyLedger + resolução do registry) → **decisão**.

### Bloco de decisão
- Texto de contexto: quem já aprovou, se a sua é a última, e o aviso **"a ativação NÃO é automática — a solicitante executa a promoção final"** (decisão de produto: aprovar ≠ ativar; separação de poderes).
- Botões: "Aprovar como {papel}" (primário verde) · "Rejeitar com justificativa…" (outline vermelho; justificativa obrigatória min 10 chars, vira entrada de ledger).
- Após decidir: card verde de confirmação com hash do ledger. Sem edição, sem undo — decisão de aprovação é imutável (corrigir = novo ciclo).

## 6. TELA 3 — Ledger Explorer (`studio`)

Protótipo: `Ledger Explorer BTV.dc.html`. Layout: barra de filtros + trilha central (máx 720px) + detalhe à direita (340px).

### Barra de filtros e verificação
- Chips por categoria de evento: Todos / Promoções / Aprovações / Comandos / Verificações (contagens reais). Chips removíveis de contexto: artefato, período.
- Botão **"Verificar cadeia"** no header: roda `verifyLedger()` e vira "✓ Cadeia íntegra (n/n)" verde + banner com head hash, algoritmo, timestamp e link "baixar VerificationReport.json". **Se quebrada:** banner vermelho apontando o índice exato da quebra (`firstBreak`), trilha marca a entrada quebrada e todas as posteriores como não-confiáveis (fundo `#F7E6E0`).
- "Exportar XES" no header — chama `toXES` com os filtros correntes.

### Trilha
- Timeline vertical: dot colorido por categoria (promoção = quadrado dourado; aprovação = círculo verde; comando = círculo tinta; verificação = quadrado azul) + linha conectora 1.5px.
- Linha do evento: `TYPE` mono 10px na cor da categoria + título 12.5px + linha meta (autor · quando · hash mono). Selecionado: fundo `#FDFAF1` borda `#E8D9AE`.

### Detalhe (340px)
- Bloco mono: index, hash, prev (encadeamento visível!), autor, quando, "íntegra ✓".
- Bloco PAYLOAD: descrição legível do evento.
- Se a entrada for uma ativação: bloco dourado **ATTESTATION** (xmlHash, ledgerHead, aprovadores, effectiveFrom + "baixar attestation.json").
- Ações: "Ver diff desta mudança" · "Abrir versão no Designer (leitura)".

## 7. Screenshots

| Arquivo | Estado |
|---|---|
| `01-revisao.jpg` | Fila + pedido aberto: change_summary, diff, verificações 4×verde, decisão pendente (1/2) |
| `02-revisao.jpg` | Pós-aprovação: card de confirmação com hash, selo 2/2 |
| `01-ledger.jpg` | Trilha completa, entrada COMMAND selecionada |
| `02-ledger.jpg` | Cadeia verificada: banner verde 47/47 + head hash |
| `03-ledger.jpg` | Filtro "Promoções" ativo; detalhe com bloco ATTESTATION |

## 8. Mapeamento API → tela (tudo já existe, exceto o marcado ⊕)

| UI | API |
|---|---|
| Selos, timeline, canais | registry: versão/status/effectiveFrom/approvers (PR5/PR7) |
| Fila de aprovação | rules engine: `requiredApprovalRoles` + estado de aprovações (PR6/PR15-16) |
| Verificações da Revisão | `evaluateGates()` + `certify --json` + `verifyLedger()` + resolução de refs |
| Diff | `DiffView` existente |
| Aprovar/rejeitar | comando de aprovação existente (multi-role) · ⊕ rejeição com justificativa se ainda não existir como comando |
| Trilha do ledger | leitura do ledger (existente) · ⊕ categorização de eventos p/ filtros (função pura no `studio`) |
| Verificar/baixar | `verifyLedger()` + `VerificationReport` (PR-B1) |
| Attestation | `attestVersion` (PR-B1) |
| XES | `toXES` (PR-B2) |
| Biblioteca | ⊕ `library` + `adapters-bpmn` (este handoff) |

## 9. Ordem das PRs

1. **S-1** `feat(library): <scope>/library — contrato ArtifactAdapter + catálogo headless` (tipos, busca/filtro/ordenação, validação de adapters; 100% testável sem DOM)
2. **S-2** `feat(adapters-bpmn): adapters de diagrama/persona/prompt/connector/política sobre o registry` (+ fixture de um adapter fake "recipe" provando a genericidade — o teste de acidez do §1)
3. **S-3** `feat(library-react): galeria + drawer` (spec Handoff 3 §5 + §4 deste; e2e de filtro/seleção/ação)
4. **S-4** `feat(studio): shell de navegação + Revisão do Aprovador` (§5; e2e do fluxo aprovar e rejeitar)
5. **S-5** `feat(studio): Ledger Explorer` (§6; e2e verificar cadeia íntegra e quebrada)
6. **S-6** `feat(studio): papel do usuário + integração fim-a-fim` (Biblioteca → abrir → Revisão → aprovar → Ledger mostra tudo; demo com dados de exemplo)

## 10. Critérios de aceite

1. **Genericidade (o mais importante):** o adapter fake "recipe" da S-2 (artefato sem nenhuma relação com BPMN) aparece na Biblioteca com filtro, card, drawer e timeline funcionais **sem nenhuma linha alterada em `library`/`library-react`** — verificado por teste que roda a Biblioteca só com o adapter fake.
2. `library` não tem imports de `core`/`registry`/`react` do ecossistema (teste de grafo de dependência, mesmo padrão do check:no-runtime-deps).
3. Revisão: usuário cujo papel não está em `requiredApprovalRoles` não vê o pedido na fila; aprovar grava entrada de ledger com papel + hash; rejeitar exige justificativa; a tela não contém nenhum caminho de mutação do modelo (e2e: nenhum comando de edição disparável).
4. Revisão nunca mostra estado divergente do engine: os 4 cards de verificação vêm de chamadas reais (mock só nos testes), não de estado local.
5. Ledger Explorer: fixture adulterada (1 byte) → banner vermelho com índice exato + entradas posteriores marcadas não-confiáveis; export XES respeita os filtros correntes.
6. Selos: todas as 3 telas usam o mesmo componente StatusBadge e a tabela canônica (nenhum hex de selo hardcoded fora dos tokens).
7. Navegação: Biblioteca → "Abrir no Designer" → voltar preserva filtros e seleção (estado de query na URL).
8. Acessibilidade: fila e trilha navegáveis por teclado (setas + Enter); decisão de aprovação alcançável sem mouse.

## 11. O que NÃO fazer

- Não colocar conhecimento de tipo concreto em `library`/`library-react` (nem "se for BPMN então…"). Tudo via adapter.
- Não duplicar regras de aprovação na UI — `evaluateGates`/rules engine é a única fonte (lição da PR16).
- Não permitir edição em nenhuma das 3 telas — Studio é leitura + decisões de governança; edição é o Designer.
- Não fazer a aprovação ativar automaticamente — separação solicitante/aprovador é intencional.
- Não adicionar roteador/lib de UI externa — navegação por estado + URL hash, mantendo zero deps.
- Não publicar no npm sem a decisão de escopo (pendência §1 — que este handoff torna urgente: 4 pacotes novos precisam do escopo definido).
