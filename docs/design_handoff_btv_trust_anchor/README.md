# Handoff 8: Identidade, Assinatura e Âncora de Confiança

**Para:** desenvolvedor com Claude Code
**Repositório:** `danzeroum/bpmn` · sucede os handoffs 1–7
**Pré-requisito:** Trust Layer (Handoff 4) merged. Independente dos handoffs 5–7 (pode andar em paralelo); a Revisão do Aprovador (Handoff 6) e o registro de sessão (7) **consomem** este quando existir.
**Data:** julho 2026 · Origem: parecer de dois analistas externos + gatilho pré-registrado no Handoff 4 §3 ("PKI é decisão futura, registrar se houver demanda" — a demanda materializou)

---

## 0. Tese

O ledger prova **o que** mudou e **quando** — mas não prova **quem** de forma não-repudiável. Hash-chain sem assinatura é tamper-evidence para si mesmo: quem controla o cliente regenera a cadeia inteira. O `attest.ts` declara *hash-based only* de propósito; este handoff completa a camada que torna o histórico **provável a terceiros**:

1. **Assinaturas Ed25519 (WebCrypto)** em aprovações e promoções — identidade vinculada criptograficamente substitui o nome digitado.
2. **Âncora externa pluggável** do head da cadeia — o único pedaço que sai do cliente, como adapter opcional.
3. **RBAC declarativo de verificação** — "esta promoção exige assinatura de papel X; a assinatura #y satisfaz?".

É o handoff que converte a governança de narrativa em prova — e muda a resposta corporativa de "adote com cautela" para "adotável em ambiente regulado".

## 1. Cercas vinculantes (parecer externo, aceito integralmente)

1. **Nunca construir PKI.** A biblioteca **não gera, não armazena e não gerencia chaves**. Chaves vêm de fora (SSO/IdP, YubiKey, chave git); a biblioteca só **assina via handle injetado, verifica e registra**. Gestão de chaves é do host — declarado no README do pacote.
2. **RBAC é verificação, não enforcement.** O cliente verifica assinaturas contra papéis exigidos — verificável por qualquer terceiro. Ele **não impede** ações: quem controla o cliente ignora regras locais. Enforcement é responsabilidade da âncora e de quem a hospeda. **Primeira linha de `limitations.md`** — ou o primeiro pentest corporativo abre um "bug" que é decisão de arquitetura.
3. **O contrato de falha da âncora tem um terceiro estado.** Anchors falham (rede, credencial, TSA fora do ar). Promoção com assinatura registrada mas ancoragem falhada = **"assinada · ancoragem pendente"** — não é aprovada-com-prova-externa nem rejeitada. Retry automático; a promoção **não regride**; o selo declara a garantia vigente ("assinaturas + hash-chain local"). Sem este estado, o dev inventa — e inventa errado.
4. **Sem âncora configurada, dizer isso.** Instalação sem anchor adapter mantém garantia = assinaturas + hash-chain local. Nunca renderizar como se houvesse prova externa. `limitations.md`.
5. **Histórico legado nunca é reescrito.** Entradas/aprovações anteriores a este handoff ficam como estão, exibidas com o estado "não assinada (legado)" — o estado declara a garantia menor; não se assina retroativamente.
6. **Publish amarrado a este handoff.** O primeiro publish npm (`@buildtovalue/*`) acontece **após** o 8, com **npm provenance attestations (OIDC no CI)** — o pacote que verifica assinaturas deve ser ele próprio verificável. Publicar a lib de governança sem proveniência própria seria a ironia final da tese furada.

## 2. Arquivos deste pacote

- `design-refs/Assinatura e Ancora BTV.dc.html` — protótipo interativo: aba 1 = fluxo de assinatura (identidade do SSO → payload canônico → assinar → âncora pendente → retentar → ancorada, com o rodapé SACM resultante mudando ao vivo); aba 2 = catálogo dos 6 estados de verificação + card RBAC advisory.
- `screenshots/` — estados capturados (§8).

## 3. Arquitetura

```
packages/identity        @buildtovalue/identity      headless: contratos Signer/Verifier, payload
                                                     canônico, verificação ed25519 (WebCrypto),
                                                     avaliação RBAC (verificação). Zero deps;
                                                     consome APENAS core (canonicalJson, tipos).
packages/anchor-git      @buildtovalue/anchor-git    adapter: head → commit assinado (host fornece o transport)
packages/anchor-rfc3161  @buildtovalue/anchor-rfc3161 adapter: timestamp TSA (RFC 3161)
packages/anchor-s3       @buildtovalue/anchor-s3     adapter: objeto com object-lock (host fornece client)
packages/react|studio    (extensão)                  badges de identidade, fluxo de assinar, estados de âncora
```

Regras: adapters de âncora **nunca** no core; `identity` não importa react nem network (transports injetados pelo host — mesmo padrão de injeção dos handoffs 6–7, com teste de grafo de dependências). Integrações degradáveis: sem `identity` → comportamento atual (hash only); sem anchor → estado "sem âncora configurada".

### Contratos (headless)

```ts
interface Signer {                       // implementado pelo HOST (SSO, YubiKey, git key…)
  identity: { subject: string; role: string; publicKeyFingerprint: string };
  sign(payload: Uint8Array): Promise<Uint8Array>;   // a chave privada nunca entra na lib
}
interface SignedApproval {
  payload: CanonicalApprovalPayload;     // diagramId, version, xmlHash, ledgerHead, decisão, papel
  signature: string;                     // ed25519, base64
  signer: Signer['identity'];
  signedAt: string;
}
// verifySignature(approval, publicKey): 'valid' | 'invalid'
// evaluateRoleRequirement(requiredRoles, approvals): satisfeito? quais faltam? (VERIFICAÇÃO — cerca §1.2)

interface AnchorAdapter {
  id: string;                            // "git", "rfc3161", "s3"
  anchor(head: { hash: string; seq: number }): Promise<AnchorReceipt>;
  verify(receipt: AnchorReceipt, head: string): Promise<'anchored' | 'mismatch' | 'unavailable'>;
}
// estado derivado: 'anchored' | 'pending' (falha + retry) | 'none' (sem adapter) | 'broken' (mismatch)
```

Payload canônico via `canonicalJson` existente (determinístico — mesmo insumo do attestation). A assinatura cobre `xmlHash + ledgerHead + decisão + papel`: qualquer mudança posterior invalida a verificação.

## 4. Spec de UX (superfície pequena, alto peso — sem teatro de segurança)

Regra geral: estado **nunca só por cor** — ícone + label sempre; caminho negativo em `--btv-error`.

### 4.1 Badge de identidade (substitui o nome solto em Revisão, PromotionPanel, Ledger Explorer, SACM)
| Estado | Pill | Uso |
|---|---|---|
| Assinada · verificada | `✓ ASSINADA · VERIFICADA` verde (`#DFF0E6`/`#1A6A54`) + fingerprint mono | aprovação com assinatura válida |
| Não assinada (legado) | `◌ NÃO ASSINADA (LEGADO)` âmbar (`#F7F0DC`/`#7A611E`) | histórico pré-handoff-8 (cerca §1.5) |
| Assinatura inválida | `✕ ASSINATURA INVÁLIDA` fundo `--btv-error` texto branco; card com borda 1.5 `--btv-error`; mostra esperado × obtido | payload alterado ou chave errada; SACM marca claim "não sustentada" |

### 4.2 Estados da âncora (selo no rodapé SACM + Ledger Explorer + banner)
| Estado | Pill | Comportamento |
|---|---|---|
| Ancorada | `✓ ANCORADA` verde | selo: "ancorado: RFC 3161 · TSA · timestamp UTC · head #hash" |
| Assinada · ancoragem pendente | `⏳ PENDENTE` âmbar | cerca §1.3: não regride, retry, selo declara "garantia vigente: assinaturas + hash-chain local"; botão retentar |
| Cadeia ≠ âncora | `✕ CADEIA ≠ ÂNCORA` `--btv-error` | head local ≠ head ancorado (cadeia regenerada após ancoragem — o estado que hash-chain sozinho nunca detecta); banner vermelho no Ledger Explorer, entradas posteriores não-confiáveis |
| Sem âncora | `— SEM ÂNCORA CONFIGURADA` cinza | nunca simular prova externa (cerca §1.4) |

### 4.3 Fluxo de assinar (protótipo, aba 1)
1. Card identidade: avatar, subject + papel, fingerprint mono + origem ("SSO corporativo — a chave nunca toca a biblioteca"), pill verificada.
2. Card payload canônico visível ANTES de assinar (o usuário vê o que assina) + explicação de 1 linha do que a assinatura cobre.
3. Botão único "🔏 Assinar aprovação com minha chave" (verde, 44px).
4. Pós-assinatura: confirmação com fingerprint da assinatura → card da âncora com o ciclo pendente→ancorada → preview do rodapé SACM mudando ao vivo.

### 4.4 Integrações
- **Revisão do Aprovador (Handoff 6):** o botão "Aprovar como {papel}" vira o fluxo 4.3 quando `identity` está configurado; sem `identity`, comportamento atual + badge "não assinada".
- **SACM (Handoff 5 F-C3):** aprovadores com badge; rodapé ganha a linha de âncora; invariante do gerador estendido: *"evidência derivada do ledger, nunca digitada — e assinada quando a instalação suporta"*.
- **Ledger Explorer:** "Verificar cadeia" passa a verificar também assinaturas e âncora; três resultados distintos no banner (íntegra / íntegra-mas-não-ancorada / rompida).
- **Rules engine:** `evaluateGates` ganha gate opcional "aprovações exigem assinatura válida" (ON por default quando `identity` configurado).

## 5. Ordem das PRs

1. **I-1** `feat(identity): @buildtovalue/identity — contratos + verificação ed25519 + payload canônico + RBAC de verificação` (headless; teste de independência; vetores de teste ed25519 conhecidos)
2. **I-2** `feat(react/studio): assinatura na Revisão/PromotionPanel + badges de identidade` (fluxo 4.3; estados 4.1; e2e assinar→verificar→invalidar)
3. **I-3** `feat(anchor): contrato AnchorAdapter + anchor-git + estados de âncora na UI` (ciclo pendente→ancorada→mismatch; banner no Ledger Explorer)
4. **I-4** `feat(anchor): anchor-rfc3161 + anchor-s3` (transports injetados; fixtures de receipt)
5. **I-5** `feat(conformance/audit): SACM assinado + verifyLedger estendido + gate de assinatura no evaluateGates`
6. **I-6** `chore(release): primeiro publish npm com provenance (OIDC)` — cerca §1.6; requer NPM_TOKEN/OIDC configurado pelo dono.

## 6. Critérios de aceite

1. **Verificação:** vetores ed25519 conhecidos passam; payload alterado em 1 byte → `invalid` com esperado×obtido; assinatura verificável **offline** (sem rede) dado a chave pública.
2. **Não-PKI:** grep de CI prova que `identity` não contém geração de chave nem storage (sem `generateKey` para persistência, sem localStorage de chaves privadas); Signer é sempre injetado.
3. **Terceiro estado:** e2e do ciclo assinar → anchor falha → estado pendente (promoção não regride, selo declara garantia local) → retry → ancorada; e fixture mismatch → `CADEIA ≠ ÂNCORA` com heads exibidos.
4. **Legado:** ledger antigo carrega sem erro; aprovações antigas exibem "não assinada (legado)"; nenhuma tentativa de assinatura retroativa.
5. **RBAC:** `evaluateRoleRequirement` puro e testado; a UI mostra "quais papéis faltam assinatura"; documentado como verificação (limitations.md linha 1).
6. **SACM:** relatório com 2 aprovações assinadas + âncora exibe a linha completa; com assinatura inválida, claim "não sustentada" em `--btv-error`.
7. **Degradação:** sem `identity` → tudo funciona como hoje; sem anchor → estado declarado; testes de ambas as ausências.
8. **Provenance do pacote:** release workflow com attestation OIDC; `npm audit signatures` verde no pacote publicado.

## 7. Nota para o Handoff 9 (registrar, não implementar)

O Copiloto (IA governada) vem depois deste — autoria `ia.copilot@modelo` só tem força quando aprovações humanas são assinadas. Junto dele, avaliação **S-FEEL mínima** para o businessRuleTask do simulador, com **lista de exclusão explícita**: sem invocação de função externa, sem aritmética complexa de data/duração, sem `for`/`some`/`every`, sem contexto aninhado — comparações, ranges, listas de valores e `-`. Célula fora do subconjunto = decisão **"não-simulável"** declarada (token para com aviso honesto), nunca avaliação silenciosamente errada. Registrar em `pendencias.md`.

## 8. Screenshots

| Arquivo | Estado |
|---|---|
| `01-assinatura.jpg` | Fluxo antes de assinar: identidade verificada + payload canônico |
| `02/03-assinatura.jpg` | Assinada: confirmação + ciclo da âncora (pendente → ancorada, abaixo da dobra — ver protótipo interativo) |
| `04-assinatura.jpg` | Catálogo dos 6 estados de verificação + card RBAC advisory |

## 9. O que NÃO fazer

- Não gerar/armazenar/exportar chaves privadas — nunca, em nenhum pacote (cerca §1.1).
- Não apresentar RBAC como enforcement, nem âncora ausente como prova externa (§1.2/§1.4).
- Não regredir promoção por falha de anchor (§1.3); não assinar histórico retroativamente (§1.5).
- Não colocar network no `identity` — transports dos anchors são injetados.
- Não publicar antes da I-6 com provenance (§1.6).
- Não inventar criptografia própria: WebCrypto/ed25519 padrão, `canonicalJson` existente, zero deps.
