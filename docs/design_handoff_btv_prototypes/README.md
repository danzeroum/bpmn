# Handoff 3: Protótipos de UX — Designer + Biblioteca de Templates

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · complementa os handoffs 1 (`docs/design_handoff_btv_bpmn/`) e 2 (`docs/design_handoff_btv_craft_governance/`)
**Data:** julho 2026

---

## 1. Overview

Dois protótipos **interativos e navegáveis** que materializam os handoffs anteriores em cenários reais de uso. Eles são a referência de UX para as PRs 4–8 (Handoff 2) e para a futura camada de aplicação sobre `@buildtovalue/react` + `@buildtovalue/registry`:

1. **Designer** (`Prototipo Designer BTV.dc.html`) — o editor com processo real "Onboarding de Cliente": pool/lanes humano × IA, shapes btv, boundary timer (F6), os 4 edges do domínio, selo de vigência, fluxo de promoção com gates e integração conceitual com as specs OMG vizinhas (DMN, BMM, VDML, PPMN).
2. **Biblioteca** (`Biblioteca de Templates BTV.dc.html`) — a galeria de artefatos versionáveis com selos de vigência por versão, filtros por status, e drawer de detalhe com linha do tempo, proveniência e execuções presas.

## 2. Sobre os arquivos de design

Os `.dc.html` são **referências de design em HTML** — protótipos de aparência e comportamento, não código para copiar. A tarefa é **recriar em React** no ambiente do repositório (ou da aplicação que o consome), usando os padrões existentes (`styles.css` tokens, `StatusBadge`, `VersionTimeline`, `DiffView`, `Palette`, plugin declarativo). **Fidelidade: alta (hifi)** — cores, medidas e tipografia são finais. Abra os arquivos no navegador para sentir as interações; os screenshots em `screenshots/` documentam cada estado.

## 3. Screenshots (estados capturados)

| Arquivo | Estado |
|---|---|
| `01-designer.jpg` | Estado inicial: gate selecionado, selo CANDIDATA, inspector com DMN/BMM/regras do core |
| `02-designer.jpg` | Deliverable selecionado: painel VDML + proveniência PPMN |
| `03-designer.jpg` | Aba Versões (antes da ativação) |
| `04-designer.jpg` | Modal de promoção aberto: checklist de gates, diff visual, 0/2 aprovações |
| `05-designer.jpg` | Modal com 2/2 aprovações — botão Ativar habilitado (verde) |
| `06-designer.jpg` | **Pós-ativação:** selo ATIVA, timeline v2.1.0 ativa / v2.0.0 descontinuada, toast de ledger |
| `07-designer-canvas-direita.jpg` | Canvas rolado: lane IA — prompt + boundary timer, connector, approval com disco-check, deliverable |
| `01-biblioteca.jpg` | Galeria completa: filtros com contagem, card selecionado (anel dourado), drawer |
| `02-biblioteca.jpg` | Drawer do connector "CRM Sync": vigência, aprovadores, timeline com supersede |
| `03-biblioteca.jpg` | Filtro "Encerradas": descontinuada + arquivada |

## 4. TELA 1 — Designer

### Layout (grid da aplicação)
- **Toolbar** 58px: logo (26px, rx 7, `#9A7B1E`) · nome do produto · título do diagrama · **selo de vigência** · spacer · ações (Diff, Exportar BPMN 2.0.2, Promover… primária dourada).
- **Paleta** esquerda 172px: 3 grupos com cabeçalhos mono 9px letter-spacing 1.8 — `CORE BPMN` (cinza), `EVENTOS` + badge F6, `BUILDTOVALUE` (dourado, itens com fundo `#FDFAF1`). Ícones de linha 18px stroke 1.5. Hover `#F2EFE8` (btv: `#F6EDD4`).
- **Canvas** central: fundo `#FAF9F6` + dot grid `#D8D3C8` 16px. Diagrama SVG 1100×540.
- **Inspector** direita 292px com tabs Propriedades | Versões (tab ativa: fundo `#FAF9F6` + borda inferior 2px dourada).
- **Status bar** 30px mono 10px: perfil de conformidade + specs OMG à esquerda; zoom/contagem/ledger à direita.

### Selo de vigência (spec do StatusBadge v2 — Handoff 2 §B1)
- CANDIDATA: container borda `#E8D9AE` fundo `#FDFAF1`; pill `#F6EDD4`/`#7A611E` 10px 700 ls1; semver mono 11px; meta 11px `#6F675A` ("canal: piloto · aguarda 2 aprovações").
- ATIVA: borda `#BCDCC9` fundo `#F2F9F4`; pill `#DFF0E6`/`#1A6A54`; meta "vigente desde 07/07/2026 · aprovada por operação, compliance". Botão Promover vira "✓ Em vigor" (desabilitado).

### Canvas — conteúdo do cenário
- Pool "Squad Onboarding" (banda 34px `#F2F0EC`, título rotacionado -90°) com 2 lanes (banda 26px): "Ana Ruiz · Humano" e "Agentes IA".
- Lane 1: start (r18) → userTask "Coletar briefing" (150×70, glifo pessoa, tag ANA RUIZ) → gate btv "Aprovar briefing" (72×56, pausa dourada).
- Lane 2: prompt "Gerar plano de conta" (150×70, dobra, **boundary timer** no lado inferior: círculo duplo r12/r9 + relógio) → connector "CRM Sync" (130×64 tracejado) → deliverable "Plano publicado" (flâmula).
- Task auxiliar "Notificar líder" (alvo da escalation).
- **Edges** (craft pack — cantos arredondados `Q` r8): sequências em tinta 1.5 com seta cheia; **handoff** gate→prompt cruzando lanes com **chip de purpose** (pill 156×17 `#F6EDD4` borda dourada, texto mono 9px "purpose: briefing → plano"); **approval** connector→deliverable (verde 2 + disco-check r8 no meio); **feedback** connector→task (tracejado 5/4 ameixa, seta aberta, label com halo `paint-order: stroke`); **escalation** boundary→notificar (vermelho, chevron duplo).
- **Seleção:** contorno 2.5 `#1A6A54` + halo offset 3px opacity 0.35 + portas r4 nos pontos médios (só na task; nos demais halo simples).
- **Sombra** `feDropShadow 0 1 2 rgba(68,64,58,0.10)` em activities/cards (não em events/gateways/pool).

### Inspector — conteúdo por seleção (ligação com as specs OMG)
- **Gate:** caixa `DECISÃO · DMN 1.7` (tabela "Critérios de aprovação", 4 regras, hit policy FIRST, link "Abrir tabela de decisão →") · caixa `MOTIVAÇÃO · BMM 1.3` (Goal + Directive) · caixa `REGRAS DO CORE` (single-funnel, congela conexões).
- **Task:** persona vinculada com versão própria ("persona v1.2.0 · ativa · versionada separadamente").
- **Prompt:** template de prompt v1.3.0 ATIVA + bindRun · caixa `BOUNDARY TIMER · F6` (48h, ancoragem paramétrica lado inferior t 0.33).
- **Connector:** contrato REST, retry, timeout, versão própria.
- **Deliverable:** caixa `VALOR · VDML 1.1` (valueProposition + beneficiário).
- **Todos:** caixa comum `PROVENIÊNCIA · PPMN` (criado em versão, hash do ledger, autor) — fundo `#FAF9F6`.

### Modal de promoção (Handoff 2 §B2) — fluxo completo
1. Header: kicker mono "PROMOÇÃO FORMAL · STATE MACHINE DO CORE", título "Ativar v2.1.0", trilha `draft → test → candidate → active`.
2. Gates (cards verdes `#F2F9F4` quando satisfeitos): change_summary preenchido · **diff visual** embutido (tags +/~/⤳ com as cores do DiffView existente).
3. Aprovações 2 papéis: botões toggle "Aprovar como Operação/Compliance" (aprovado: fundo `#DFF0E6`, borda/texto verdes, prefixo ✓); contador (n/2).
4. Aviso âmbar dos efeitos: v2.0.0 → Descontinuada, effective_until, runs presas, ledger.
5. "Ativar v2.1.0" **desabilitado** (`#C9C4BA`, cursor not-allowed) até 2/2; habilitado `#1A6A54`.
6. Ao ativar: selo→ATIVA, timeline atualiza (v2.0.0 DESCONTINUADA vermelha, "vigente 12/05 → 07/07/2026"), **toast** escuro 6s: "v2.1.0 ativa · v2.0.0 → descontinuada · ledger #a3f9e1 gravado".

**Regra de implementação:** transições e gates vêm da state machine + rules engine do core — a UI só reflete (nunca hardcodar).

### Estados/máquina do protótipo (replicar)
`selected: task|gate|prompt|conn|deliv` · `tab: props|vers` · `promo: bool` · `apOp/apComp: bool` · `activated: bool` · `toast: bool (auto-dismiss 6s)`.

## 5. TELA 2 — Biblioteca de Templates

### Layout
- Header 58px: logo · nav (Galeria ativa com pill dourada / Meus rascunhos / Auditoria) · busca 220px · "+ Novo template" primário.
- **Filtros:** chips arredondados com contagem mono — Todos 10 / Ativas 4 / Candidatas 2 / Teste interno 1 / Rascunhos 1 / Encerradas 2. Ativo: fundo `#9A7B1E` texto branco.
- **Grid:** `repeat(auto-fill, minmax(272px, 1fr))` gap 16.
- **Drawer** direito fixo 316px com detalhe do artefato selecionado.

### Card de artefato
- Thumb 108px: dot grid + miniatura SVG por tipo (fluxo mini start→task→gateway; persona pill; prompt nota; connector tracejado; gate hexágono) + chip de tipo no canto (`FLUXO/PERSONA/PROMPT/CONNECTOR/POLÍTICA`).
- Corpo: nome 13.5px 600 + semver mono 11px · **linha de selos**: selo de vigência + chip de canal + (se houver) chip verde "N execuções presas" · meta 11px muted.
- Selecionado: borda `#9A7B1E` + anel `0 0 0 3px rgba(154,123,30,0.18)`. Hover: sombra `0 4px 14px rgba(68,64,58,0.12)`, transição 120ms.

### Selos de vigência (tabela canônica — usar em TODO o produto)
| Status | Label PT | bg | fg | Nota |
|---|---|---|---|---|
| draft | RASCUNHO | `#FAF9F6` | `#44403A` | **borda tracejada** `#A49C8F` |
| test | TESTE INTERNO | `#E3ECF7` | `#33567E` | |
| candidate | CANDIDATA | `#F6EDD4` | `#7A611E` | |
| active | ATIVA | `#DFF0E6` | `#1A6A54` | única que vale em produção |
| deprecated | DESCONTINUADA | `#F7E6E0` | `#B3372F` | |
| retired | ARQUIVADA | `#EFECE6` | `#6F675A` | |

### Drawer de detalhe
Kicker "DETALHE · {tipo}" · nome 16px 700 · selo + semver + canal · caixa Vigência/Aprovação/change_summary · caixa `PROVENIÊNCIA · PPMN` (hash + autor) · **linha do tempo de versões** (dot colorido por status + pill + nota, incl. supersede e "N execuções presas") · ações: "Abrir no Designer" (primária) e "Diff vs versão ativa".

### Dados de exemplo (10 artefatos — cobrem todos os status)
Fluxos: Onboarding (candidata·piloto), Renovação de Contrato (ativa·geral·12 runs), Suporte N2 (rascunho), Cobrança legado (arquivada). Personas: Ana Ruiz (ativa), Agente SDR (teste). Prompts: Gerar plano (ativa), Resumo de reunião (descontinuada·1 run presa). Connector: CRM Sync (ativa, timeline com v1.x SOAP arquivada). Política: Gate Aprovação Dupla (candidata). Conteúdo completo nos `.dc.html`.

## 6. Mapeamento protótipo → componentes do repo

| Protótipo | Implementar em |
|---|---|
| Selo de vigência | `StatusBadge.tsx` estendido (PR5) |
| Modal de promoção | novo `PromotionPanel` (PR6) — embute `DiffView` existente |
| Timeline com vigência + bindRun | `VersionTimeline.tsx` (PR7) |
| Paleta agrupada + ícones | `Palette.tsx` + `paletteItems` (grupos; ícones ReactNode já suportados) |
| Chip de purpose / disco-check / chevrons | `EdgeRenderer` + `Defs` via `edgeStyles` do plugin (PR3, Handoff 1) |
| Cantos arredondados r8 | `waypointsToPath` no core (PR4) |
| Halo de seleção + portas + sombras | `NodeRenderer`/`overlays` + `Defs` (PR4) |
| Boundary timer | F6 (PR8+) — ancoragem paramétrica |
| Caixas DMN/VDML/BMM/PPMN do inspector | `PropertiesPanel` — seções plugáveis por tipo (novo ponto de extensão no plugin: `inspectorSections?`) |
| Biblioteca inteira | camada de aplicação sobre `@buildtovalue/registry` (fora de packages/react; demo em `packages/example` serve de host) |

## 7. Tokens usados (além dos handoffs 1–2)
Toast: fundo `#262220`, texto `#ECE8E1`, check `#57B895`, hash `#CBA84B`. Aviso âmbar: `#FDF6E8` borda `#E8D9AE` texto `#7A611E`. Fontes: Space Grotesk (UI) + IBM Plex Mono (semver, hashes, kickers, specs). Kickers: mono 9–10px, letter-spacing 1.5–2px, cor `#9A7B1E`.

## 8. Critérios de aceite (resumo)
1. Selo visível em qualquer diagrama sem interação; muda de CANDIDATA→ATIVA ao completar a promoção.
2. Ativar bloqueado até changelog + diff renderizado + 2 papéis distintos; efeito colateral (deprecar anterior) anunciado antes e gravado no ledger.
3. Biblioteca filtra por status com contagens corretas; card mostra selo+canal+runs sem abrir detalhe.
4. Timeline responde "qual versão estava ativa no dia X" (vigência de/até por versão).
5. Craft pack: cantos r8, hover 120ms, halo de seleção, sombras só em activities, labels com halo — 60fps@350 nós.

## 9. Arquivos
- `design-refs/Prototipo Designer BTV.dc.html` — protótipo 1 (interativo)
- `design-refs/Biblioteca de Templates BTV.dc.html` — protótipo 2 (interativo)
- `design-refs/BTV Notation.dc.html` — folha de notação (handoff 1, incluída por conveniência)
- `screenshots/01–07-designer.jpg`, `01–03-biblioteca.jpg` — estados documentados (§3)
