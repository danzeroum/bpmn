import type { Messages } from '../messages.js';

/**
 * Pedigree / signing dictionary fragment (Handoff 11 N-6). Covers the edge
 * pedigree strip and the two signing-identity surfaces beside it — the
 * canonical payload card (`payload.*`) and the anchor seal (`anchor.*`). Keys
 * are namespaced by surface; `{token}` slots interpolate ids, hashes and labels
 * resolved at render time.
 */
export const pedigree: { en: Messages; ptBR: Messages } = {
  en: {
    'pedigree.aria': 'Edge pedigree',
    'pedigree.kicker': 'PEDIGREE · SUPERSESSION CHAIN',
    'pedigree.close': 'Close pedigree',
    'pedigree.supersede': 'supersede',
    'pedigree.ledger': 'ledger',
    'pedigree.cardAria': 'Version {version} of the connection',
    'pedigree.diffAria': 'Diff',
    'pedigree.closeDiff': 'Close diff',

    'payload.kicker': 'WHAT YOU ARE SIGNING (CANONICAL PAYLOAD)',
    'payload.identity': 'diagram: {id} · version: {version}',
    'payload.decision': 'decision: {decision} (role {role})',
    'payload.note':
      'The signature covers the XML hash + the chain head — any later change invalidates verification, detectable by any third party.',

    'anchor.label.anchored': 'ANCHORED',
    'anchor.label.pending': 'PENDING',
    'anchor.label.none': 'NO ANCHOR CONFIGURED',
    'anchor.label.broken': 'CHAIN ≠ ANCHOR',
    'anchor.aria': 'Anchor: {label}',
    'anchor.anchoredDetail': 'anchored: {adapter} · head {head}',
    'anchor.external': 'external',
    'anchor.pendingDetail': 'guarantee in force: signatures + local hash-chain',
    'anchor.retrying': 'retrying…',
    'anchor.retry': 'Retry anchoring',
    'anchor.brokenDetail': 'local {head} ≠ anchored {anchored}',
  },
  ptBR: {
    'pedigree.aria': 'Pedigree da conexão',
    'pedigree.kicker': 'PEDIGREE · CADEIA DE SUPERSESSÃO',
    'pedigree.close': 'Fechar pedigree',
    'pedigree.supersede': 'supersede',
    'pedigree.ledger': 'ledger',
    'pedigree.cardAria': 'Versão {version} da conexão',
    'pedigree.diffAria': 'Diff',
    'pedigree.closeDiff': 'Fechar diff',

    'payload.kicker': 'O QUE VOCÊ ESTÁ ASSINANDO (PAYLOAD CANÔNICO)',
    'payload.identity': 'diagrama: {id} · versão: {version}',
    'payload.decision': 'decisão: {decision} (papel {role})',
    'payload.note':
      'A assinatura cobre o hash do XML + o head da cadeia — qualquer mudança posterior invalida a verificação, detectável por qualquer terceiro.',

    'anchor.label.anchored': 'ANCORADA',
    'anchor.label.pending': 'PENDENTE',
    'anchor.label.none': 'SEM ÂNCORA CONFIGURADA',
    'anchor.label.broken': 'CADEIA ≠ ÂNCORA',
    'anchor.aria': 'Âncora: {label}',
    'anchor.anchoredDetail': 'ancorado: {adapter} · head {head}',
    'anchor.external': 'externo',
    'anchor.pendingDetail': 'garantia vigente: assinaturas + hash-chain local',
    'anchor.retrying': 'retentando…',
    'anchor.retry': 'Retentar ancoragem',
    'anchor.brokenDetail': 'local {head} ≠ ancorado {anchored}',
  },
};
