# Mapa de Dados — Cluster Governança / Confiança / Análise

Catálogo de dados (mapa de dados) para os pacotes de governança, confiança criptográfica e análise
do monorepo BPMN: `registry`, `audit`, `identity`, `anchor-git`, `anchor-rfc3161`, `anchor-s3`,
`conformance`, `soundness`, `replay`. Para cada arquivo `src/` documentam-se **todos** os dados que
circulam — entradas, dados intermediários (mesmo quando se perdem na própria classe/função) e saídas.

**Fronteiras de dados do cluster.** Os dados *entram* de `@buildtovalue/core` (o núcleo): `BpmnDiagram`,
`BpmnVersion`, `BpmnDiff`, `AuditEntry`, `AuditLedger`/`LedgerLike`, `ApprovalRecord`, `XmlElement`,
funções `computeDiagramHash`/`computeEntryHash`/`sha256Hex`/`canonicalJson`/`computeDiff`, o
`BpmnXmlConverter` e o `MiniXmlParser`. Os dados *saem* para o host / mundo externo como valores
serializáveis: recibos de âncora (`AnchorReceipt`), XML XES 2.0, HTML do relatório SACM, Markdown de
conformidade, `RunBinding` congelado, `VerificationReport`/`ReplayAnalysis` em JSON e verdicts de
promoção. Nenhum pacote faz rede: transportes (git/TSA/S3), chaves e relógio são **injetados** pelo host.

---

## registry

### `packages/registry/src/types.ts`
**Papel:** Contratos de dados da camada de registro governável de versões de diagramas.
**Entradas:** Tipos importados de core (`BpmnDiagram`, `BpmnVersion`, `VersionStatus`); nenhum dado em runtime (só declarações).
**Processamento (intermediário):** Nenhum — arquivo puramente declarativo de interfaces/tipos.
**Saídas:** As interfaces exportadas que trafegam por todo o pacote.
**Estruturas de dados que trafegam:** `DateInput` (`Date|string`); `PublicationTarget` (`channel`, `environment?`); `Publication` (estende target: `versionId`, `status`, `effectiveFrom`, `effectiveUntil?`, `publishedBy`); `RegistryEntry` (`version: BpmnVersion`, `snapshot: BpmnDiagram`, `snapshotHash: string`, `technicalNotes?`, `registeredAt`, `publications: Publication[]`); `RegistrySink` (`write(entry)`); `RegisterOptions` (`changeSummary?`, `technicalNotes?`); `PublishOptions` (target + `status?`, `effectiveFrom?`, `publishedBy?`); `RunBinding` (`runId`, `versionId`, `semanticVersion`, `snapshotHash`, `channel?`, `environment?`, `boundAt`); `ExportedRegistry` (`entries: RegistryEntry[]`).

### `packages/registry/src/VersionRegistry.ts`
> Δ 2026-07: índice interno `lanes: Map<laneKey, Publication[]>` (ordenado por `effectiveFrom`, populado em publish/import) — `publish`/`channelTimeline`/`publicationAt` consultam o índice em vez de varrer todas as entradas × publicações.
**Papel:** Camada consultável de governança sobre o ciclo de vida — registra versões imutáveis com snapshots hasheados, janelas temporais e publicações por canal/ambiente.
**Entradas:** `register(diagram: BpmnDiagram, options: RegisterOptions)`; `publish(versionId, options: PublishOptions)`; `diffBetween(from,to)`; `activeAt(at: DateInput, target?)`; `publicationAt`; `channelTimeline`; `lineageOf`; `import(data: ExportedRegistry)`; opção `{ sink?: RegistrySink }`. Dados de core: `BpmnDiagram`, `BpmnVersion`, `BpmnDiff`, `computeDiagramHash`, `computeDiff`, `nowIso`.
**Processamento (intermediário):** `structuredClone(diagram)` (cópia profunda imutável do snapshot); `snapshotHash = await computeDiagramHash(snapshot)` (SHA-256 do conteúdo) e verificação contra `version.snapshotHash` declarado; backfill do hash computado em `storedVersion`; mapa privado `entries: Map<string,RegistryEntry>`, array `order: string[]`, fila `queue: Promise` serializando mutações (`enqueue`); chaves de lane `laneKey = channel␟environment`; conversões `toMillis`; fechamento da publicação aberta na lane (seta `effectiveUntil`); janelas de cobertura (`covers`, `bestFrom`); cadeia de ancestralidade via `parentVersionId` com `Set` de visitados.
**Saídas:** `RegistryEntry` (register/get), `Publication` (publish), `BpmnDiff` (diffBetween), `RegistryEntry[]` (list/history/lineageOf/channelTimeline via Publication[]), `BpmnDiagram` clonado (snapshotOf), `BpmnVersion` (versionOf), `ExportedRegistry` clonado (export), instância `VersionRegistry` (import). Efeito colateral: `sink.write(entry)` persiste no host. Lança `RegistryError` em id duplicado, hash divergente ou falha de verificação na importação.
**Estruturas de dados que trafegam:** `RegistryEntry`, `Publication`, `PublicationTarget`, `ExportedRegistry`, `BpmnDiff`, `BpmnDiagram`, `BpmnVersion`.

### `packages/registry/src/callActivity.ts`
**Papel:** Sinergia F7 — resolve cada callActivity de um diagrama para a versão registrada em vigor no instante `at` e expõe regra de validação de referência quebrada.
**Entradas:** `resolveCallActivities(diagram: BpmnDiagram, registry: VersionRegistry, at: DateInput, target?: PublicationTarget)`; `callActivityBindingRule(registry, at?, target?)`. De core: `calledElementOf(node)`, tipo `ValidationRule`.
**Processamento (intermediário):** `atMs` via `toMillis`; iteração sobre `diagram.nodes` filtrando `type === 'callActivity'`; extração de `calledElement`; lista de candidatos `entry.snapshot.id === calledElement`; `pickActive` escolhe janela cobrindo `atMs` (por publicação quando há `target`, senão pela validade da versão), guardando `best`/`bestFrom`; `coversWindow(from,until,atMs)`.
**Saídas:** `CallActivityResolution[]` (`nodeId`, `calledElement?`, `entry?`); `ValidationRule` que produz `ValidationIssue` com código `CALL_REF_MISSING` (severity `error`, `nodeId`, `message`).
**Estruturas de dados que trafegam:** `CallActivityResolution`, `RegistryEntry`, `PublicationTarget`, `ValidationRule`/`ValidationIssue`.

### `packages/registry/src/runBinding.ts`
**Papel:** Fixa (pin) uma execução a uma versão exata — o "hash de commit do deploy" aplicado a um processo.
**Entradas:** `bindRun(entry: RegistryEntry, options: BindRunOptions{runId?,channel?,environment?})`; `verifyRunBinding(binding: RunBinding, entry: RegistryEntry)`. De core: `generateId`, `nowIso`.
**Processamento (intermediário):** Deriva `runId` (UUID gerado quando omitido), lê `entry.version.id`/`semanticVersion`/`snapshotHash`; `Object.freeze` para tornar o registro imutável; `boundAt = nowIso()`. Verificação: comparação pura `versionId` e `snapshotHash`.
**Saídas:** `RunBinding` congelado (host armazena por run); `boolean` de integridade (detecta snapshot adulterado ou hash à deriva). Lança `RegistryError` quando falta `snapshotHash`.
**Estruturas de dados que trafegam:** `RunBinding`, `BindRunOptions`, `RegistryEntry`.

### `packages/registry/src/errors.ts`
**Papel:** Erro tipado do domínio de registro.
**Entradas:** `message: string`; classe base `BpmnError` de core.
**Processamento (intermediário):** Chama `super('REGISTRY', message)` — fixa o código de domínio.
**Saídas:** Instância `RegistryError`.
**Estruturas de dados que trafegam:** `RegistryError` (estende `BpmnError`).

### `packages/registry/src/index.ts`
**Papel:** Barrel de exportação pública do pacote registry.
**Entradas:** Re-exporta `./types`, `./errors`, `./VersionRegistry`, `./runBinding`, `./callActivity`.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública do pacote.
**Estruturas de dados que trafegam:** Todas as do registry (tipos + `VersionRegistry`).

---

## audit

### `packages/audit/src/verify.ts`
> Δ 2026-07: `verifyLedger` verifica cadeias mistas — `computeEntryHash` despacha por `entry.hashVersion` (v2 exato / v1 legado por entrada).
**Papel:** Re-verificação completa da cadeia hash-encadeada do ledger de auditoria, tornando a integridade demonstrável sob demanda.
**Entradas:** `verifyLedger(ledger: LedgerLike)`. `LedgerLike = AuditLedger | { entries: readonly AuditEntry[] }` (aceita objeto vivo ou o shape de `ledger.export()`/`ledger.json`). De core: `computeEntryHash`, tipos `AuditEntry`, `AuditLedger`.
**Processamento (intermediário):** `entriesOf` normaliza a fonte (`getEntries()` vs `.entries`); `previousHash` acumulado ('' inicial); para cada entry compara `entry.previousHash` com o esperado e recomputa `computeEntryHash(entry)` comparando com `entry.hash`; para no primeiro rompimento capturando `index`/`expected`/`actual`; `verifiedAt` = timestamp ISO da execução.
**Saídas:** `VerificationReport` (`intact`, `entries`, `firstBreak?{index,expected,actual}`, `verifiedAt`).
**Estruturas de dados que trafegam:** `VerificationReport`, `LedgerLike`, `AuditEntry`.

### `packages/audit/src/attest.ts`
> Δ 2026-07: canonização via `canonicalJsonExact` (números exatos no hash de atestação); erros de lookup lançam `BpmnAuditError` (antes `Error`).
**Papel:** Constrói uma atestação assinável (hash-based) do momento em que uma versão foi promovida — o que estava ativo, desde quando e quem aprovou, endereçado por conteúdo.
**Entradas:** `attestVersion(registry: VersionRegistry, diagramId, versionId, options: AttestOptions{ledger?,attestedAt?})`; `canonicalAttestation(attestation)`; `attestationHash(attestation)`. De core: `BpmnXmlConverter`, `canonicalJson`, `sha256Hex`, `ApprovalRecord`.
**Processamento (intermediário):** Busca `registry.get(versionId)`; valida `entry.snapshot.id === diagramId`; exporta XML canônico via `new BpmnXmlConverter().toXml(entry.snapshot)`; `xmlHash = await sha256Hex(xml)`; obtém `ledgerHeadHash` (hash da última entry do ledger ou ''); copia `approvedBy` (`ApprovalRecord[]`); `attestedAt` (override para determinismo).
**Saídas:** `Attestation` (`diagramId`, `versionId`, `semanticVersion`, `xmlHash`, `ledgerHeadHash`, `status`, `effectiveFrom?`, `approvers`, `attestedAt`); string JSON canônica byte-estável; SHA-256 sobre a forma canônica (id publicável). Lança `Error` quando a versão não está registrada ou pertence a outro diagrama.
**Estruturas de dados que trafegam:** `Attestation`, `AttestOptions`, `ApprovalRecord`, `LedgerLike`.

### `packages/audit/src/signatures.ts`
**Papel:** Camada de assinatura sobre o ledger — coleta os `SignedApproval` gravados nas entradas, re-verifica offline e expõe o gate de promoção por assinatura.
**Entradas:** `collectSignedApprovals(ledger: LedgerLike, versionId?)`; `verifyLedgerSignatures(ledger, resolvePublicKey: PublicKeyResolver)`; `signaturePromotionRule(options: SignatureGateOptions)`. De identity: `verificationState`, `SignedApproval`, `VerificationState`. De core: `AuditEntry`, `PromotionRule`.
**Processamento (intermediário):** Lê `entry.details.signedApproval` (mesmo slot que `approvePromotion` grava, entrando na hash-chain); filtra por `versionId` e por presença de `signature: string`; para cada approval resolve a chave pública via fingerprint e chama `verificationState` (WebCrypto Ed25519); acumula `Set<string>` de papéis com assinatura válida; contadores `total`/`valid`/`invalid`; no gate deriva `required` = papéis distintos de `approvedBy` e computa `missing`.
**Saídas:** `SignedApproval[]`; `LedgerSignatureReport` (`total`, `valid`, `invalid`, `results: SignedApprovalVerification[]`); `PromotionRule` retornando `{allowed:true}` ou `{allowed:false, reason}` (pt/en) — só bloqueia promoção a `active`.
**Estruturas de dados que trafegam:** `SignedApprovalVerification` (`approval`, `state`), `LedgerSignatureReport`, `SignatureGateOptions`, `PublicKeyResolver`, `SignedApproval`, `PromotionRule`.

### `packages/audit/src/xes.ts`
**Papel:** Exporta a história de governança como log de eventos XES 2.0 (IEEE 1849-2016) para mineração de processos.
**Entradas:** `toXES(ledger: LedgerLike, options: XesOptions{logName?,registry?})`. De core: `canonicalJson`, `XmlBuilder`, `AuditEntry`.
**Processamento (intermediário):** `Map<string, XesEvent[]>` de traces por `versionId` (uma trace por versão, insertion-ordered); cada `AuditEntry` vira evento com `name`(type), `timestamp`, `resource`(userId) e extras `bpmnr:seq`/`bpmnr:hash`/`bpmnr:details`(canonicalJson); com registry, adiciona eventos `VERSION_REGISTERED` (usa `registeredAt`, `createdBy`, `semanticVersion`) e `VERSION_PUBLISHED` (por `Publication`: `effectiveFrom`, `publishedBy`, `channel`, `environment?`, `status`); constantes `XES_EXTENSIONS` (concept/time/org/lifecycle); eventos ordenados cronologicamente dentro da trace via `Date.parse`; construção via `XmlBuilder` (log/extension/global/classifier/trace/event).
**Saídas:** String de XML XES 2.0 (`lifecycle:transition = complete`) — dado que sai para ferramentas externas (ProM, Celonis, Disco).
**Estruturas de dados que trafegam:** `XesOptions`, `XesEvent` (interno: `name`, `timestamp`, `resource?`, `extras`), `AuditEntry`, `LedgerLike`, `Publication`.

### `packages/audit/src/assuranceCase.ts`
> Δ 2026-07: evidência de aprovação hasheada com `canonicalJsonExact`.
**Papel:** Constrói o assurance case SACM 100% derivado de registros de governança — claims, argumentos e evidências hasheadas, com verificação da cadeia e re-verificação de assinaturas.
**Entradas:** `buildAssuranceCase(diagram: BpmnDiagram, ledger: LedgerLike, options: AssuranceCaseOptions{specVersion?,generatedAt?,resolvePublicKey?,anchor?})`. De core: `canonicalJson`, `sha256Hex`, `ApprovalRecord`, `AuditEntry`, `BpmnDiagram`. De identity: `verificationState`, `AnchorState`, `VerificationState`.
**Processamento (intermediário):** `verifyLedger` roda no momento da geração (produz `VerificationReport`); enriquece cada `approvedBy` casando `SignedApproval` por `payload.role`, resolve chave e obtém `state` (valid/invalid/legacy) + `fingerprint` curto (`ed25519:#xxxx…yyyy`); flag `anySignatureInvalid`; classifica entradas por regex `PROMOTION_TYPES`/`SIMULATION_TYPES` em `simulationEntries`/`promotionEntries`/`commandEntries`; monta argumentos A1 (aprovações + promoções — `approvalEvidence` faz `sha256Hex(canonicalJson(approval))`), A2 (comandos — `entryEvidence` usa `entry.hash`) e opcional A3 (simulação — `simulationEvidence` deriva `covered/total` e `roteiroHash` dos details); claims C1/C2/(C3) com `supported` calculado; `ledgerHeadHash` = hash da última entry.
**Saídas:** `AssuranceCase` (`spec`, `diagramId`, `diagramName`, `semanticVersion`, `status`, `claims`, `arguments`, `approvers`, `signedApprovers`, `anchor?`, `verification`, `ledgerHeadHash`, `generatedAt`). Constantes exportadas `SACM_SPEC_VERSION='SACM 2.3'`, `EVIDENCE_COLLAPSE_THRESHOLD=20`.
**Estruturas de dados que trafegam:** `AssuranceEvidence` (`id`,`hash`,`kind`,`at`,`actor`), `AssuranceArgument`, `AssuranceClaim`, `SignedApproverInfo`, `AssuranceAnchor`, `AssuranceCase`, `AssuranceCaseOptions`.

### `packages/audit/src/sacmReport.ts`
**Papel:** Renderiza o assurance case como documento HTML SACM pronto para impressão (sub-marca BTV CERTIFY), com notação canônica e rodapé de auditoria.
**Entradas:** `renderAssuranceCaseHtml(assurance: AssuranceCase)`. De identity: `VerificationState`.
**Processamento (intermediário):** Mapa `APPROVER_GLYPH` (valid ✓ / invalid ✕ / legacy ◌); `anchorLine` deriva texto por `anchor.state` (anchored/pending/broken/none); `esc` (escape HTML) e `short` (hash → `#7chars`); `evidenceRows`/`evidenceGroup` (colapsa grupos acima de `EVIDENCE_COLLAPSE_THRESHOLD` para "N evidências · faixa de hashes"); `annex` com evidências completas; `claimBlock` (círculos de evidência com hashes curtos, verdict "não sustentado"); `chainLine` a partir de `verification.intact`/`firstBreak`; linha de aprovadores com fingerprints.
**Saídas:** String HTML autocontida (documento canônico só-claro, sem dark mode) — sai para o host/impressão. Verdicts embutidos (`data-supported`, `data-chain-intact`, "não sustentado", âncora).
**Estruturas de dados que trafegam:** `AssuranceCase`, `AssuranceArgument`, `AssuranceEvidence`, `AssuranceAnchor`, `VerificationState`.

### `packages/audit/src/anchorEntry.ts`
**Papel:** Fabrica a entrada de ledger `ANCHOR_RECORDED` — o ato de ancoragem como registro de primeira classe na trilha.
**Entradas:** `anchorRecordedEntry(receipt: AnchorReceipt, actor: {id})`. De identity: `AnchorReceipt`.
**Processamento (intermediário):** Deriva `versionId = ledger-head-${receipt.head.seq}`; empacota em `details` o `adapterId`, `headHash`(receipt.head.hash), `headSeq`, `proof` e `anchoredAt`.
**Saídas:** Objeto de entrada `{type: ANCHOR_RECORDED_TYPE, userId, versionId, details}` (host anexa ao ledger). Constante `ANCHOR_RECORDED_TYPE = 'ANCHOR_RECORDED'`.
**Estruturas de dados que trafegam:** `AnchorReceipt`, entrada de ledger parcial (`type`/`userId`/`versionId`/`details`).

### `packages/audit/src/index.ts`
**Papel:** Barrel público do pacote audit.
**Entradas:** Re-exporta attest, verify, signatures, xes, assuranceCase, sacmReport, anchorEntry.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública (funções + tipos `Attestation`, `VerificationReport`, `LedgerLike`, `LedgerSignatureReport`, etc.).
**Estruturas de dados que trafegam:** Todas as do audit.

---

## identity

Cerca §1.1 — a biblioteca **nunca** gera, armazena ou gerencia chaves: o `Signer` (chave privada) é sempre implementado e injetado pelo host; só o payload canônico cruza a fronteira `sign`.

### `packages/identity/src/types.ts`
**Papel:** Contratos públicos de identidade/assinatura (a própria API pública, fixada por `apiSurface.test.ts`).
**Entradas:** Nenhuma em runtime — declarações.
**Processamento (intermediário):** Nenhum.
**Saídas:** Interfaces/tipos exportados.
**Estruturas de dados que trafegam:** `SignerIdentity` (`subject`, `role`, `publicKeyFingerprint`); `Signer` (`identity`, `sign(payload: Uint8Array): Promise<Uint8Array>`); `CanonicalApprovalPayload` (`diagramId`, `version`, `xmlHash`, `ledgerHead`, `decision`, `role`); `SignedApproval` (`payload`, `signature` base64, `signer`, `signedAt`); `VerificationState` (`valid|invalid|legacy`); `RoleRequirementResult` (`satisfied`, `missing[]`); `AnchorState` (`anchored|pending|none|broken`); `AnchorHead` (`hash`, `seq`); `AnchorReceipt` (`adapterId`, `head`, `proof`, `anchoredAt`); `AnchorAdapter` (`id`, `anchor(head)`, `verify(receipt, head)`).

### `packages/identity/src/base64.ts`
**Papel:** Conversão base64 ⇄ bytes, zero dependências (via `btoa`/`atob` globais).
**Entradas:** `toBase64(bytes: Uint8Array)`; `fromBase64(base64: string)`.
**Processamento (intermediário):** Acumula string binária caractere a caractere (`String.fromCharCode` / `charCodeAt`) — dados transitórios locais.
**Saídas:** String base64; `Uint8Array`.
**Estruturas de dados que trafegam:** `Uint8Array`, `string`.

### `packages/identity/src/payload.ts`
> Δ 2026-07: `encodePayload` usa `canonicalJsonExact` — bytes idênticos aos anteriores (payload é só strings, coberto por teste), assinaturas existentes seguem válidas.
**Papel:** Constrói o payload canônico que a assinatura de aprovação cobre e o serializa para bytes determinísticos.
**Entradas:** `buildApprovalPayload(input: CanonicalApprovalPayload)`; `encodePayload(payload)`. De core: `canonicalJson`.
**Processamento (intermediário):** Reordena explicitamente os campos (`diagramId`, `version`, `xmlHash`, `ledgerHead`, `decision`, `role`); `canonicalJson(payload)` estabiliza a ordem de chaves; `TextEncoder().encode(...)` gera os bytes UTF-8 sobre os quais `sign` e `verify` operam.
**Saídas:** `CanonicalApprovalPayload` normalizado; `Uint8Array` (bytes a assinar/verificar).
**Estruturas de dados que trafegam:** `CanonicalApprovalPayload`, `Uint8Array`.

### `packages/identity/src/sign.ts`
**Papel:** Assina um payload de aprovação usando o `Signer` injetado pelo host.
**Entradas:** `signApproval(signer: Signer, payload: CanonicalApprovalPayload, signedAt: string)`.
**Processamento (intermediário):** `signer.sign(encodePayload(payload))` produz a assinatura Ed25519 raw; `toBase64(signature)` codifica; `signedAt` é passado (nunca lido do relógio — determinismo).
**Saídas:** `SignedApproval` (`payload`, `signature` base64, `signer: signer.identity`, `signedAt`).
**Estruturas de dados que trafegam:** `SignedApproval`, `Signer`, `CanonicalApprovalPayload`.

### `packages/identity/src/verify.ts`
**Papel:** Verifica offline a assinatura Ed25519 de uma aprovação e resolve o estado de verificação de três valores.
**Entradas:** `verifySignature(approval: SignedApproval, publicKey: Uint8Array)`; `isLegacyApproval(approval)`; `verificationState(approval, publicKey)`. Constante `ED25519 = 'Ed25519'`.
**Processamento (intermediário):** `crypto.subtle.importKey('raw', publicKey, Ed25519)` e `crypto.subtle.verify` sobre `fromBase64(signature)` e `encodePayload(payload)`; cópias em `Uint8Array` frescos para satisfazer `BufferSource`; try/catch retorna `invalid` (nunca lança) em payload alterado, chave errada ou material malformado; ausência de assinatura → `legacy`; assinado sem chave disponível → `invalid`.
**Saídas:** `'valid'|'invalid'` (verifySignature); `boolean` (isLegacyApproval); `VerificationState` (`valid|invalid|legacy`).
**Estruturas de dados que trafegam:** `SignedApproval`, `VerificationState`, `Uint8Array`.

### `packages/identity/src/anchor.ts`
**Papel:** Deriva de forma pura o estado de UI da âncora a partir de haver adaptador configurado e do resultado bruto de `verify`.
**Entradas:** `deriveAnchorState({hasAdapter: boolean, verification?: 'anchored'|'mismatch'|'unavailable'})`.
**Processamento (intermediário):** Mapeamento puro: sem adaptador → `none`; `anchored` → `anchored`; `mismatch` → `broken`; `unavailable`/não ancorado → `pending` (não regride a promoção).
**Saídas:** `AnchorState`.
**Estruturas de dados que trafegam:** `AnchorState`.

### `packages/identity/src/rbac.ts`
**Papel:** Avalia (verificação, não enforcement) se todo papel exigido tem aprovação correspondente.
**Entradas:** `evaluateRoleRequirement(requiredRoles: readonly string[], approvals: readonly SignedApproval[])`.
**Processamento (intermediário):** `Set` de papéis presentes de `approval.payload.role` (campo coberto pela assinatura); acumula `missing` preservando ordem e deduplicando.
**Saídas:** `RoleRequirementResult` (`satisfied`, `missing[]`).
**Estruturas de dados que trafegam:** `RoleRequirementResult`, `SignedApproval`.

### `packages/identity/src/index.ts`
**Papel:** Barrel público do pacote identity.
**Entradas:** Re-exporta base64, payload, sign, verify, rbac, anchor + todos os tipos.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** Todas as de identity (incl. o contrato `AnchorAdapter` compartilhado pelos anchor-*).

---

## anchor-git / anchor-rfc3161 / anchor-s3 — contrato compartilhado

Os três pacotes implementam **o mesmo contrato `AnchorAdapter`** de `@buildtovalue/identity` (`id`, `anchor(head: AnchorHead): Promise<AnchorReceipt>`, `verify(receipt: AnchorReceipt, head: string): Promise<'anchored'|'mismatch'|'unavailable'>`). O dado de entrada comum é o `AnchorHead` (`hash`+`seq`, o head da cadeia); o dado de saída comum é o `AnchorReceipt` (`adapterId`, `head`, `proof`, `anchoredAt`), persistido pelo host e re-verificado depois. Nenhum faz rede: cada transporte é **injetado**. Em `verify`, o chamador passa o hash ATUAL da entry em `receipt.head.seq`, de modo que uma cadeia que apenas cresceu ainda verifica, enquanto uma reescrita dá `mismatch`. Diferem apenas no **transporte** e no formato de `proof`.

## anchor-git

### `packages/anchor-git/src/gitAnchor.ts`
**Papel:** `AnchorAdapter` git — ancora o head da cadeia a um commit via transporte injetado.
**Entradas:** `createGitAnchor(transport: GitAnchorTransport, options: GitAnchorOptions{now?})`; em runtime `anchor(head: AnchorHead)` e `verify(receipt, head)`. Transporte: `commit(payload): Promise<{ref}>`, `read(ref): Promise<string|undefined>`.
**Processamento (intermediário):** `encodeHead(head)` = `JSON.stringify({hash, seq})` (serialização determinística); `now()` injetável (`anchoredAt`); em verify lê o payload de volta (`transport.read(receipt.proof)`), faz `JSON.parse`, compara `stored.hash === head`; try/catch → `unavailable` (loja inalcançável, dispara `pending`) ou `mismatch` (JSON inválido / hash divergente).
**Saídas:** `AnchorReceipt` (`adapterId:'git'`, `head`, `proof:ref`, `anchoredAt`); veredicto `'anchored'|'mismatch'|'unavailable'`.
**Estruturas de dados que trafegam:** `GitAnchorTransport`, `GitAnchorOptions`, `AnchorAdapter`, `AnchorHead`, `AnchorReceipt`.

### `packages/anchor-git/src/index.ts`
**Papel:** Barrel público do anchor-git.
**Entradas:** Re-exporta `createGitAnchor` e tipos `GitAnchorTransport`, `GitAnchorOptions`.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** As do gitAnchor.

## anchor-rfc3161

### `packages/anchor-rfc3161/src/rfc3161Anchor.ts`
**Papel:** `AnchorAdapter` RFC 3161 — ancora o head a um token de timestamp de TSA (transporte injetado).
**Entradas:** `createRfc3161Anchor(transport: Rfc3161Transport)`; runtime `anchor(head)`/`verify(receipt, head)`. Transporte: `timestamp(digest): Promise<{token, genTime}>`, `verifyToken(token, digest): Promise<boolean>`.
**Processamento (intermediário):** Solicita token sobre `head.hash` (o digest); `anchoredAt = genTime` (relógio da TSA); em verify chama `transport.verifyToken(receipt.proof, head)`; try/catch → `unavailable`; token válido → `anchored`, senão `mismatch` (head mudou após timestamping).
**Saídas:** `AnchorReceipt` (`adapterId:'rfc3161'`, `head`, `proof:token`, `anchoredAt:genTime`); veredicto de verificação.
**Estruturas de dados que trafegam:** `Rfc3161Transport`, `AnchorAdapter`, `AnchorHead`, `AnchorReceipt`.

### `packages/anchor-rfc3161/src/index.ts`
**Papel:** Barrel público do anchor-rfc3161.
**Entradas:** Re-exporta `createRfc3161Anchor` e tipo `Rfc3161Transport`.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** As do rfc3161Anchor.

## anchor-s3

### `packages/anchor-s3/src/s3Anchor.ts`
**Papel:** `AnchorAdapter` S3 object-lock/WORM — ancora o head a um objeto write-once com chave `seq-hash`.
**Entradas:** `createS3Anchor(transport: S3Transport, options: S3AnchorOptions{prefix?,now?})`; runtime `anchor(head)`/`verify(receipt, head)`. Transporte: `put(key, body): Promise<{versionId?}>`, `get(key): Promise<string|undefined>`.
**Processamento (intermediário):** `prefix` (default `'anchors/'`); chave `${prefix}${head.seq}-${head.hash}`; `encodeHead(head)` = `JSON.stringify({hash, seq})`; `now()` injetável; em verify lê `transport.get(receipt.proof)`, faz `JSON.parse`, compara `stored.hash === head`; try/catch → `unavailable`/`mismatch`.
**Saídas:** `AnchorReceipt` (`adapterId:'s3'`, `head`, `proof:key`, `anchoredAt`); veredicto de verificação.
**Estruturas de dados que trafegam:** `S3Transport`, `S3AnchorOptions`, `AnchorAdapter`, `AnchorHead`, `AnchorReceipt`.

### `packages/anchor-s3/src/index.ts`
**Papel:** Barrel público do anchor-s3.
**Entradas:** Re-exporta `createS3Anchor` e tipos `S3Transport`, `S3AnchorOptions`.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** As do s3Anchor.

---

## conformance

### `packages/conformance/src/matrix.ts`
**Papel:** Matriz de conformidade elemento-a-elemento BPMN 2.0 — fonte única de verdade do perfil suportado.
**Entradas:** `classCoverage(entries: ConformanceEntry[], klass: ConformanceClass)`.
**Processamento (intermediário):** Filtra entradas por classe; `usable` = status `supported|partial`; percentual arredondado `usable/relevant*100`.
**Saídas:** `CONFORMANCE_MATRIX: ConformanceEntry[]` (≈40 linhas: `element`, `status`, `conformanceClass`, `mappedTo?`, `notes?`); número de cobertura por classe.
**Estruturas de dados que trafegam:** `ConformanceStatus` (`supported|partial|degraded|unsupported`), `ConformanceClass` (`descriptive|analytic|extended`), `ConformanceEntry`.

### `packages/conformance/src/manifest.ts`
**Papel:** Manifesto estrutural — digest destilado dos XSDs oficiais (atributos obrigatórios + pais legais) do perfil suportado, sem um motor de schema.
**Entradas:** Nenhuma em runtime.
**Processamento (intermediário):** Nenhum — tabela declarativa.
**Saídas:** `STRUCTURAL_MANIFEST: Record<string, ElementRule>` (por elemento: `requiredAttrs?`, `parents?`).
**Estruturas de dados que trafegam:** `ElementRule`, `STRUCTURAL_MANIFEST`.

### `packages/conformance/src/certify.ts`
**Papel:** Certifica um documento BPMN — bem-formação + segurança XXE, validação estrutural, warnings de import, round-trip lossless e a classe de conformidade alcançada. Puro, sem I/O.
**Entradas:** `certifyXml(xml: string, options: {require?: CertifiableClass})`. De core: `BpmnXmlConverter`, `createDefaultRegistry`, `MiniXmlParser`, `normalizeForDiff`, `XmlElement`.
**Processamento (intermediário):** `matrixCoverage` (descriptive/analytic via `classCoverage`); `MiniXmlParser().parse(xml)` — em erro deriva `xxeSafe` de `/doctype/i` na mensagem; `walk` recursivo (ignora conteúdo dentro de `extensionElements`, opaco por spec); `Set` `used` de local names (menos `IGNORED_LOCAL_NAMES`); verifica `STRUCTURAL_MANIFEST` por elemento gerando `STRUCT_MISSING_ATTR`/`STRUCT_BAD_PARENT`; mapeia via `LOCAL_TO_MATRIX` e `MATRIX_BY_ELEMENT` para classificar `highestClass` e coletar `unsupportedElements`; round-trip: `fromXml`→`toXml`→`fromXml` comparando `JSON.stringify(normalizeForDiff(...))`; `certifiable` = sem issues estruturais, sem não-suportados e round-trip lossless.
**Saídas:** `CertifyReport` (`wellFormed`, `xxeSafe`, `parseError?`, `structuralIssues: CertifyIssue[]`, `importWarnings`, `roundTripLossless`, `elementsUsed`, `unsupportedElements`, `achievedClass: 'descriptive'|'analytic'|'none'`, `matrixCoverage`, `requiredClass?`, `requirementMet?`).
**Estruturas de dados que trafegam:** `CertifyIssue` (código `STRUCT_MISSING_ATTR|STRUCT_BAD_PARENT`), `CertifiableClass`, `CertifyReport`, `XmlElement`.

### `packages/conformance/src/corpusPolicy.ts`
**Papel:** Política do corpus — proporção real/gerado documentada e testada anti-drift.
**Entradas:** Nenhuma em runtime.
**Processamento (intermediário):** Nenhum — constantes congeladas.
**Saídas:** `GENERATED_CORPUS_FILES = 58`; `EXTERNAL_CORPUS_MIN = 20`; `EXTERNAL_CORPUS_MAX = 40`; `EXTERNAL_CORPUS_SOURCES` (bpmn-io/bpmn-js-examples MIT, camunda quickstart Apache-2.0).
**Estruturas de dados que trafegam:** Constantes numéricas e a lista de fontes com licença.

### `packages/conformance/src/render.ts`
**Papel:** Renderiza `CONFORMANCE.md` determinística e reprodutivelmente a partir da matriz (freshness-checked em CI).
**Entradas:** `renderConformanceMarkdown(entries = CONFORMANCE_MATRIX)`. Usa `classCoverage` e as constantes de `corpusPolicy`.
**Processamento (intermediário):** Mapa `STATUS_BADGE` (emoji por status); acumula `lines: string[]` — cabeçalho gerado, percentuais descriptive/analytic, tabela Markdown por entrada, seção corpus real vs gerado (contagens de `corpusPolicy`), seção `certify --strict` vs XSD e exit codes.
**Saídas:** String Markdown (documento `CONFORMANCE.md`) — sai para o repositório.
**Estruturas de dados que trafegam:** `ConformanceEntry`, constantes de corpus.

### `packages/conformance/src/index.ts`
**Papel:** Barrel público do conformance.
**Entradas:** Re-exporta matrix, render, manifest, certify, corpusPolicy.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** Todas as do conformance.

### Corpus `packages/conformance/corpus/*.bpmn` (dado de entrada externo de teste)
O diretório contém 58 arquivos `.bpmn` **gerados** (`scripts/gen-corpus.mjs`, equivalentes estruturais, zero material proprietário, licença Apache-2.0) que servem como dado de entrada externo para a suíte de round-trip: cada arquivo deve importar sem erro fatal e re-exportar/re-importar identicamente (`normalizeForDiff`), com contagens de warnings snapshotadas. O corpus cobre, em variantes v1–v3 (numeradas 01–58), praticamente todo o perfil BPMN suportado: aprovação linear, gateways exclusivo/paralelo (fork)/inclusivo/baseado-em-evento, boundary events (interrompentes e não), typed throw events, error/conditional, subprocessos, marcadores de loop (standard e multi-instance), artefatos de dados (dataObject/dataStore), send/receive, elementos degradados, ausência de DI, colaboração com lanes, message flow e — deliberadamente — casos de referência pendente/quebrada (ex.: `49/50-dangling-reference`, sequenceFlow apontando para nó inexistente, warning esperado). Um corpus REAL adicional (≥20, cap 40) é baixado em CI para `corpus-external/` (git-ignorado), com proveniência por arquivo em `MANIFEST.json`.

---

## soundness

### `packages/soundness/src/graph.ts`
> Δ 2026-07: a classificação de fluxo (`isFlowNode`/`isFlowEdge`/`flowScopeOf`) agora vem de `@buildtovalue/core` (`model/flow.ts`) e é reexportada — API pública inalterada.
**Papel:** Constrói os grafos de sequence-flow por escopo (nível do processo + cada subprocesso) sobre os quais as regras de soundness rodam — análise estrutural apenas (adjacência, alcançabilidade, SCCs).
**Entradas:** `buildScopeGraphs(diagram: BpmnDiagram)`; `reachableFrom(graph, seeds)`; `coReachableTo(graph, seeds)`; `cyclicComponents(graph)`; helpers `isFlowNode`/`isFlowEdge`/`flowScopeOf`. De core: `activeNodes`, `activeEdges`, `boundaryAttachedTo`, `isContainerType`, `nodeParentId`, `BpmnNode`, `BpmnEdge`.
**Processamento (intermediário):** Exclui `NON_FLOW_TYPES` (dataObject/dataStore/textAnnotation/group) e `NON_FLOW_EDGE_TYPES` (messageFlow/association/dataAssociation) e elementos fechados; `Map` `graphs` por escopo e `scopeOf` por nó; para cada `ScopeGraph` monta `nodes`/`out`/`in`/`starts`; liga arestas apenas quando ambos endpoints existem no MESMO escopo; adiciona arestas sintéticas `implicit` host→boundaryEvent (só para alcançabilidade); `ends` = endEvents ou nós-sink (sem saída); BFS forward/backward com `Set`+fila; Tarjan **iterativo** (frames com cursor de aresta, `indices`/`lowlinks`/`onStack`/`stack`) retornando só componentes cíclicos reais (≥2 nós ou self-loop).
**Saídas:** `ScopeGraph[]`; `Set<string>` de alcançáveis/co-alcançáveis; `string[][]` de componentes cíclicos; booleanos dos helpers.
**Estruturas de dados que trafegam:** `FlowEdge` (`edgeId`, `source`, `target`, `implicit?`), `ScopeGraph` (`scope`, `nodes`, `out`, `in`, `starts`, `ends`).

### `packages/soundness/src/rules.ts`
**Papel:** Nove regras de soundness estrutural com códigos estáveis, severidades e mensagens bilíngues; entry point standalone e wrapper de plugin.
**Entradas:** `analyzeSoundness(diagram: BpmnDiagram, options: SoundnessOptions)`; `soundnessRules(options)`. De core: `laneFlowNodeRefs`, `BpmnNode`, `IssueSeverity`, `ValidationIssue`, `ValidationRule`.
**Processamento (intermediário):** `RuleContext` (`diagram`, `graphs = buildScopeGraphs`, `locale`, `severityOf` com overrides); `Set` `disabled`; cada `ScopedCheck` percorre os grafos — `deadlockJoin` (AND-join alimentado por XOR-split via `nearestSplits` com `splitCounts`), `unmatchedSplit` (`reachableFrom` procurando join do mesmo tipo), `noPathToEnd` (`coReachableTo(ends)`), `infiniteLoop` (SCC sem aresta de saída), `deadBranch` (`reachableFrom(starts)`), `boundaryNoOutflow`, `eventGatewayTargets` (`EVENT_GW_LEGAL_TARGETS`), `laneNoActor` (`laneFlowNodeRefs`), `implicitMerge` (2+ entradas sem gateway); mapa `CHECK_BY_CODE`; acumula `ValidationIssue[]`.
**Saídas:** `ValidationIssue[]` (verdicts com `code`, `severity`, `message`, `nodeId?`/`edgeId?`); `ValidationRule[]` (regra composta única). Constantes `SOUNDNESS_CODES`, `SOUNDNESS_RULES`.
**Estruturas de dados que trafegam:** `SoundnessCode`, `SoundnessLocale`, `SoundnessRuleDefinition` (`code`, `defaultSeverity`, `title` por locale), `SoundnessOptions` (`severityOverrides?`, `disabled?`, `locale?`), `RuleContext` (interno), `ValidationIssue`.

### `packages/soundness/src/promotion.ts`
**Papel:** Gate de promoção — erros de soundness bloqueiam a ativação através do mecanismo de `PromotionRule`.
**Entradas:** `soundnessPromotionRule(options: SoundnessOptions)`. De core: `PromotionRule`.
**Processamento (intermediário):** Só age quando `target === 'active'`; filtra issues com `severity === 'error'`; junta os `codes` distintos.
**Saídas:** `PromotionRule` → `{allowed:true}` ou `{allowed:false, reason}` (pt/en com contagem e códigos). Warnings/info nunca bloqueiam.
**Estruturas de dados que trafegam:** `PromotionRule`, `SoundnessOptions`.

### `packages/soundness/src/index.ts`
**Papel:** Barrel público do soundness.
**Entradas:** Re-exporta graph, promotion, rules.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** `ScopeGraph`, `FlowEdge`, tipos de regras.

---

## replay

Motor headless de replay que raciocina sobre um **grafo abstrato injetado** (`{nodes, edges}`) — não importa nada do ecossistema (nem `@buildtovalue/core`); tudo é JSON puro. Fitness por token-replay (cerca §0.2 — nunca alignments), passe único O(n) sem DOM (§0.3).

### `packages/replay/src/types.ts`
**Papel:** Tipos-valor públicos do motor de replay.
**Entradas:** Nenhuma em runtime.
**Processamento (intermediário):** Nenhum — declarações.
**Saídas:** Interfaces exportadas.
**Estruturas de dados que trafegam:** `ReplayNode` (`id`, `name?`); `ReplayEdge` (`id`, `source`, `target`); `ReplayGraph`; `LogEvent` (`activity`, `timestamp?`); `Trace` (`caseId`, `events[]`); `NodeStat` (`nodeId`, `count`, `avgMs?`); `EdgeStat`; `Deviation` (`from`, `to`, `count`, `cases`); `Variant` (`signature`, `activities`, `count`, `share`, `sampleCaseId`); `Fitness` (`fitness`, `fitMoves`, `totalMoves`, `conformingCases`, `totalCases`); `AggregatedLog`; `AggregateOptions` (`topVariants?`).

### `packages/replay/src/parseCsv.ts`
**Papel:** Faz parse de um log CSV de eventos (case/activity/timestamp) em traces, linha a linha.
**Entradas:** `parseCsv(text: string, mapping: CsvMapping)`; `parseTimestamp(value)`. `CsvMapping` (`case?`, `activity?`, `timestamp?`, `delimiter?`).
**Processamento (intermediário):** `parseTimestamp` (epoch numérico ou `Date.parse`); `splitLine` respeita aspas duplas e escapes; `resolveIndex` mapeia colunas nomeadas/índices; acumula `byCase: Map<string, LogEvent[]>` + `order: string[]` (dados transitórios); ordena eventos por timestamp quando todos presentes (stable sort).
**Saídas:** `Trace[]`.
**Estruturas de dados que trafegam:** `CsvMapping`, `Trace`, `LogEvent`.

### `packages/replay/src/parseXes.ts`
**Papel:** Faz parse de um log XES 2.0 em traces por regex, trace-a-trace/evento-a-evento, sem materializar DOM.
**Entradas:** `parseXes(xml: string)`.
**Processamento (intermediário):** `unescapeXml`; `readKeyed(fragment, key)` extrai o `value` do atributo XES; `TRACE_RE`/`EVENT_RE`; lê `concept:name` (caseId/activity — fallback posicional `case-N`) e `time:timestamp` (via `parseTimestamp`); acumula `LogEvent[]` por trace.
**Saídas:** `Trace[]`.
**Estruturas de dados que trafegam:** `Trace`, `LogEvent`.

### `packages/replay/src/aggregate.ts`
**Papel:** Replaya um log contra o grafo injetado em passe único — frequência e tempo médio por nó/aresta, fitness token-replay com detecção de desvios, variantes e gargalo.
**Entradas:** `aggregate(graph: ReplayGraph, traces: Iterable<Trace>, options: AggregateOptions)`; `normalizeName(name)`.
**Processamento (intermediário):** Índices `nodeByName` (nome normalizado→id, first wins), `nodeIds`, `edgeByPair` ("src tgt"→edgeId); acumuladores `nodeAcc`/`edgeAcc`/`devAcc`/`varAcc` (interfaces `NodeAcc`/`EdgeAcc`/`DevAcc`/`VarAcc` com `timeSum`/`timeN`); contadores `totalEvents`/`totalCases`/`fitMoves`/`totalMoves`/`conformingCases`; resolve cada evento a nodeId (ou `null`→`unmapped`); por transição incrementa `totalMoves`, tempo de sojourn (gap de entrada), casa aresta (`fitMoves`) ou registra `Deviation` (chaves `?activity` para não-mapeados, `traceConforms=false`); assinatura de variante normalizada; finalização ordena nodes/edges por `count`, deviations por `cases`, variantes top-N por share, calcula `fitness = fitMoves/totalMoves` e `bottleneckNodeId` (maior `avgMs`).
**Saídas:** `AggregatedLog` (`totalEvents`, `totalCases`, `nodes: NodeStat[]`, `edges: EdgeStat[]`, `deviations`, `variants`, `fitness`, `unmapped`, `bottleneckNodeId?`).
**Estruturas de dados que trafegam:** `AggregatedLog`, `AggregateOptions`, `ReplayGraph`, `Trace`, acumuladores internos, `Deviation`, `Variant`, `Fitness`.

### `packages/replay/src/analysis.ts`
**Papel:** Resume um replay em um sumário de governança serializável (gargalo, fitness, top desvio) com headline pronta — JSON neutro que o host anexa a um pedido de promoção/ledger.
**Entradas:** `summarizeReplay(log: AggregatedLog, options: SummarizeOptions)`. `SummarizeOptions` (`diagramId`, `versionId`, `semanticVersion`, `author`, `timestamp`, `label(nodeId)`, `formatMs(ms)`, `candidateSemanticVersion?`, `candidateChange?`).
**Processamento (intermediário):** Resolve `bottleneck` do `bottleneckNodeId` (via `label`/`formatMs`); `topDeviation` = `deviations[0]` com `share = cases/totalCases`; `endpoint` desfaz `?activity`; monta `headline` em pt-BR ("O gargalo real da vX é … — a vY ataca isso: …"); nunca lê relógio (timestamp injetado).
**Saídas:** `ReplayAnalysis` (`diagramId`, `versionId`, `semanticVersion`, `totalCases`, `fitness`, `bottleneck?`, `topDeviation?`, `candidateSemanticVersion?`, `author`, `timestamp`, `headline`).
**Estruturas de dados que trafegam:** `ReplayAnalysis`, `SummarizeOptions`, `AggregatedLog`.

### `packages/replay/src/index.ts`
**Papel:** Barrel público do replay.
**Entradas:** Re-exporta aggregate, analysis, parseCsv, parseXes + tipos.
**Processamento (intermediário):** Nenhum.
**Saídas:** Superfície pública.
**Estruturas de dados que trafegam:** Todas as do replay.

---

**Nota sobre os testes (`tests/*.test.ts`, fora de `src/`).** Cada pacote traz suítes (`apiSurface`, `independence`, mais fixtures de domínio: ledgers/aprovações hasheados no audit, vetores Ed25519 no identity, transportes fake nos anchor-*, o corpus `.bpmn` no conformance, grafos/logs sintéticos no replay/soundness) — dados de fixture que exercitam as estruturas acima sem sair do processo de teste.

---

## Síntese de dados de governança/confiança/análise

O cluster forma uma cadeia de custódia de dados que parte do conteúdo BPMN e termina em provas verificáveis por terceiros:

1. **Identidade de conteúdo (registry).** Um `BpmnDiagram` de `core` é clonado (`structuredClone`) e reduzido a um `snapshotHash` SHA-256 (`computeDiagramHash`); a `RegistryEntry` amarra versão imutável + snapshot + hash, e a `Publication` distribui a versão por lanes temporais. O `RunBinding` **congelado** (`Object.freeze`) fixa uma execução ao `snapshotHash` — o "commit hash do deploy" — verificável por comparação pura.
2. **Trilha e atestação (audit).** O `AuditLedger`/`LedgerLike` (cadeia hash-encadeada de `AuditEntry`) é re-verificado por `verifyLedger` (recomputa `computeEntryHash`, aponta o `firstBreak`) gerando um `VerificationReport`. A `Attestation` endereça por conteúdo (`xmlHash` do XML canônico + `ledgerHeadHash`) e produz um `attestationHash` canônico. O `AssuranceCase` (SACM 2.3) deriva claims/argumentos/evidências 100% do ledger e é renderizado em HTML; o `toXES` exporta a história como XES 2.0 para mineração de processos.
3. **Assinatura criptográfica (identity).** O `CanonicalApprovalPayload` (`xmlHash`+`ledgerHead`+`decision`+`role`) é serializado deterministicamente (`canonicalJson`→bytes UTF-8) e assinado por um `Signer` **injetado pelo host** (chave privada nunca entra), gerando um `SignedApproval` (Ed25519 base64). A verificação é **offline** (WebCrypto), tri-estado (`valid|invalid|legacy`), e alimenta o gate de promoção do audit.
4. **Ancoragem externa (anchor-git/rfc3161/s3).** Todos implementam o mesmo `AnchorAdapter`: entra um `AnchorHead` (`hash`+`seq`), sai um `AnchorReceipt` (`proof`=commit ref / token TSA / object key). `verify` compara o head atual contra o armazenado e devolve `anchored|mismatch|unavailable`, que `deriveAnchorState` traduz no estado de UI (`broken` detecta a cadeia regenerada — o que o hash-chain local sozinho não vê). O `anchorRecordedEntry` reintroduz o recibo na própria trilha.
5. **Análise estrutural e comportamental (conformance/soundness/replay).** `certifyXml` produz um `CertifyReport` (bem-formação, XXE, round-trip lossless, classe alcançada) contra a `CONFORMANCE_MATRIX`/`STRUCTURAL_MANIFEST`; `analyzeSoundness` percorre `ScopeGraph`s (alcançabilidade, Tarjan) emitindo `ValidationIssue`s com códigos `SND_*` que podem bloquear promoção; o motor de `replay` agrega logs (CSV/XES) contra um grafo abstrato num `AggregatedLog` (fitness token-replay, desvios, gargalo) resumido num `ReplayAnalysis` JSON.

**Dados que entram de `core`:** `BpmnDiagram`, `BpmnVersion`, `BpmnDiff`, `AuditEntry`/`AuditLedger`/`LedgerLike`, `ApprovalRecord`, `XmlElement`, e as primitivas de hash/canonicalização/conversão. **Dados que saem para o host/externo:** `RunBinding`, `AnchorReceipt`, `Attestation`/`attestationHash`, XML XES 2.0, HTML do assurance case SACM, Markdown `CONFORMANCE.md`, `CertifyReport`, `ValidationIssue[]`, `VerificationReport`, `AggregatedLog` e `ReplayAnalysis`. Nenhum pacote faz rede nem gerencia chaves — relógio, chaves e transportes são sempre injetados, mantendo determinismo e verificabilidade independente.
