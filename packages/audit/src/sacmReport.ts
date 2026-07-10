import type { VerificationState } from '@buildtovalue/identity';
import {
  EVIDENCE_COLLAPSE_THRESHOLD,
  type AssuranceAnchor,
  type AssuranceArgument,
  type AssuranceCase,
  type AssuranceEvidence,
} from './assuranceCase.js';

/** Icon glyph per signature state (never color alone — §4.1). */
const APPROVER_GLYPH: Record<VerificationState, string> = {
  valid: '✓',
  invalid: '✕',
  legacy: '◌',
};

/** The footer anchor line (Handoff 8 §4.2), or undefined when none is passed. */
function anchorLine(anchor: AssuranceAnchor | undefined): string | undefined {
  if (!anchor) return undefined;
  switch (anchor.state) {
    case 'anchored':
      return `ancorado: ${anchor.adapterId ?? 'externo'} · head ${short(anchor.head ?? '')}`;
    case 'pending':
      return 'ancoragem pendente · garantia vigente: assinaturas + hash-chain local';
    case 'broken':
      return 'CADEIA ≠ ÂNCORA — o head local diverge do ancorado';
    default:
      return 'sem âncora configurada';
  }
}

const esc = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const short = (hash: string): string => (hash ? `#${hash.slice(0, 7)}` : '#—');

function evidenceRows(evidence: AssuranceEvidence[]): string {
  return evidence
    .map(
      (item) => `
        <tr>
          <td class="hash">${short(item.hash)}</td>
          <td>${esc(item.kind)}</td>
          <td>${esc(item.actor)}</td>
          <td>${esc(item.at)}</td>
        </tr>`,
    )
    .join('');
}

const TABLE_HEAD = `
      <thead>
        <tr><th>hash</th><th>registro</th><th>ator</th><th>quando</th></tr>
      </thead>`;

/**
 * One evidence group (A1, A2, …): §11.2 — the table header repeats on every
 * printed page break (native \`<thead>\` behavior), each group carries its
 * subtotal, and above EVIDENCE_COLLAPSE_THRESHOLD rows the body collapses
 * into "N evidências · faixa de hashes #x…#y" with the full rows in the
 * annex at the end of the document.
 */
function evidenceGroup(argument: AssuranceArgument): string {
  const total = `subtotal ${argument.id}: ${argument.evidence.length} ${
    argument.evidence.length === 1 ? 'evidência' : 'evidências'
  }`;
  if (argument.evidence.length > EVIDENCE_COLLAPSE_THRESHOLD) {
    const first = argument.evidence[0];
    const last = argument.evidence[argument.evidence.length - 1];
    return `
    <section class="evidence-group" data-argument="${argument.id}" data-collapsed="true">
      <h3>${argument.id} · ${esc(argument.statement)}</h3>
      <p class="collapsed-range">${argument.evidence.length} evidências · faixa de hashes ${short(
        first.hash,
      )}…${short(last.hash)} — íntegra no anexo</p>
      <p class="subtotal">${total}</p>
    </section>`;
  }
  return `
    <section class="evidence-group" data-argument="${argument.id}">
      <h3>${argument.id} · ${esc(argument.statement)}</h3>
      <table class="evidence">
        ${TABLE_HEAD}
        <tbody>${evidenceRows(argument.evidence)}
        </tbody>
      </table>
      <p class="subtotal">${total}</p>
    </section>`;
}

function annex(assurance: AssuranceCase): string {
  const collapsed = assurance.arguments.filter(
    (argument) => argument.evidence.length > EVIDENCE_COLLAPSE_THRESHOLD,
  );
  if (collapsed.length === 0) return '';
  return `
  <section class="annex" data-annex>
    <h2>Anexo · evidências completas</h2>
    ${collapsed
      .map(
        (argument) => `
    <h3>${argument.id} (${argument.evidence.length} evidências)</h3>
    <table class="evidence">
      ${TABLE_HEAD}
      <tbody>${evidenceRows(argument.evidence)}
      </tbody>
    </table>`,
      )
      .join('')}
  </section>`;
}

/** SACM notation: claim = rectangle, argument = parallelogram, evidence = circle. */
function claimBlock(assurance: AssuranceCase): string {
  return assurance.claims
    .map((claim) => {
      const argument = assurance.arguments.find((entry) => entry.id === claim.argumentId);
      const evidence = argument?.evidence ?? [];
      const circles = evidence
        .slice(0, 5)
        .map(
          (item) =>
            `<span class="sacm-evidence" title="${esc(item.kind)}">${short(item.hash)}</span>`,
        )
        .join('');
      const more =
        evidence.length > 5 ? `<span class="sacm-evidence-more">+${evidence.length - 5}</span>` : '';
      return `
    <section class="sacm-claim ${claim.supported ? '' : 'unsupported'}" data-claim="${claim.id}"
             data-supported="${claim.supported}">
      <p class="claim-statement"><strong>${claim.id}</strong> ${esc(claim.statement)}
        ${claim.supported ? '' : '<span class="verdict" data-verdict>não sustentado</span>'}
      </p>
      <div class="sacm-argument" data-argument-shape>
        <strong>${claim.argumentId}</strong> ${esc(argument?.statement ?? '')}
      </div>
      <div class="sacm-evidence-row">${circles}${more}</div>
    </section>`;
    })
    .join('');
}

/**
 * Print-ready SACM assurance-case report (Handoff 5 §5, F-C3) as a single
 * self-contained HTML document under the certify sub-brand: 4px gold rule,
 * \`BTV CERTIFY · ASSURANCE CASE · <spec>\` kicker (spec label parameterized —
 * §11.4), canonical SACM notation (claim rectangle / argument parallelogram
 * / evidence circles carrying ledger-entry hashes), dashed inferred
 * relations, and the audit footer (chain hash, verification result, date,
 * approvers, page n/N) fixed on every page.
 *
 * §11.3 — DECLARED EXCEPTION: no dark mode. The document keeps the paper
 * base (#FAF9F6/ink) even under \`prefers-color-scheme: dark\` — an audit
 * document has ONE canonical appearance. \`color-scheme: only light\` plus
 * the absence of any dark block is intentional, not a bug.
 */
export function renderAssuranceCaseHtml(assurance: AssuranceCase): string {
  const verification = assurance.verification;
  const chainLine = verification.intact
    ? `cadeia SHA-256 íntegra · ${verification.entries} entradas · head ${short(assurance.ledgerHeadHash)}`
    : `cadeia SHA-256 QUEBRADA na entrada ${verification.firstBreak?.index ?? '?'} — esperado ${short(
        verification.firstBreak?.expected ?? '',
      )}, encontrado ${short(verification.firstBreak?.actual ?? '')}`;
  const approvers =
    assurance.signedApprovers.length > 0
      ? assurance.signedApprovers
          .map(
            (a) =>
              `${APPROVER_GLYPH[a.state]} ${a.userId} (${a.role})${
                a.state === 'valid' && a.fingerprint ? ` ${a.fingerprint}` : ''
              }`,
          )
          .join(' · ')
      : 'sem aprovações registradas';
  const anchor = anchorLine(assurance.anchor);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Assurance Case · ${esc(assurance.diagramName)} v${esc(assurance.semanticVersion)}</title>
<style>
  /* §11.3: paper canonical — only light, deliberately no dark block. */
  :root { color-scheme: only light; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    background: #faf9f6;
    color: #44403a;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.55;
  }
  .gold-rule { height: 4px; background: var(--btv-gold, #9a7b1e); }
  main { max-width: 780px; margin: 0 auto; padding: 28px 32px 96px; }
  .kicker {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    letter-spacing: 2.2px;
    color: #6f675a;
    margin: 0 0 6px;
  }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .subtitle { margin: 0 0 24px; color: #6f675a; }
  .subtitle .status { text-transform: uppercase; letter-spacing: 1px; font-size: 11px; }

  /* SACM canonical notation. */
  .sacm-claim {
    border: 1.5px solid var(--btv-sacm-claim, #33567e);
    background: #ffffff;
    border-radius: 2px;
    padding: 12px 14px;
    margin: 0 0 18px;
    break-inside: avoid;
  }
  .sacm-claim.unsupported { border-color: var(--btv-error, #b3372f); }
  .verdict {
    color: var(--btv-error, #b3372f);
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: 1px solid var(--btv-error, #b3372f);
    border-radius: 3px;
    padding: 1px 6px;
    margin-left: 8px;
  }
  .sacm-argument {
    transform: skewX(-12deg);
    border: 1.5px solid var(--btv-sacm-argument, #7a611e);
    background: #fdfaf1;
    padding: 8px 18px;
    margin: 10px 0 10px 22px;
    max-width: 90%;
  }
  .sacm-argument > * { display: inline-block; transform: skewX(12deg); }
  /* Inferred relations render dashed. */
  .sacm-claim .sacm-argument, .sacm-evidence-row { position: relative; }
  .sacm-claim .sacm-argument::before, .sacm-evidence-row::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 50%;
    width: 12px;
    border-top: 1.5px dashed #a49c8f;
  }
  .sacm-evidence-row { margin-left: 44px; display: flex; gap: 8px; flex-wrap: wrap; }
  .sacm-evidence {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: 1.5px solid var(--btv-sacm-evidence, #1a6a54);
    background: #f2f9f4;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9px;
  }
  .sacm-evidence-more { align-self: center; color: #6f675a; font-size: 11px; }

  /* Evidence tables (§11.2): thead repeats on print page breaks. */
  .evidence-group { margin: 22px 0; }
  .evidence-group h3 { font-size: 13px; margin: 0 0 6px; }
  table.evidence { width: 100%; border-collapse: collapse; }
  table.evidence th, table.evidence td {
    border: 1px solid #d8d3c8;
    padding: 4px 8px;
    text-align: left;
    font-size: 11.5px;
  }
  table.evidence thead th {
    background: #efece6;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9.5px;
    letter-spacing: 1px;
  }
  td.hash { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
  .subtotal {
    text-align: right;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    color: #6f675a;
    margin: 4px 0 0;
  }
  .collapsed-range {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 11px;
    border: 1px dashed #a49c8f;
    padding: 8px 10px;
    background: #ffffff;
  }
  .annex { break-before: page; }

  /* Audit footer on EVERY page: fixed box prints per page in browsers;
     the @page margin box carries "página n/N" for paged-media engines. */
  footer.audit {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-top: 1px solid #d8d3c8;
    background: #faf9f6;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9px;
    letter-spacing: 0.4px;
    color: #6f675a;
    padding: 6px 32px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }
  @page {
    margin: 18mm 14mm 24mm;
    @bottom-right { content: "página " counter(page) "/" counter(pages); }
  }
  .page-counter::after { content: 'página ' counter(page) '/' counter(pages); }
</style>
</head>
<body>
<div class="gold-rule"></div>
<main>
  <p class="kicker">BTV CERTIFY · ASSURANCE CASE · ${esc(assurance.spec)}</p>
  <h1>${esc(assurance.diagramName)}</h1>
  <p class="subtitle">v${esc(assurance.semanticVersion)} · <span class="status">${esc(
    assurance.status,
  )}</span> · ${esc(assurance.diagramId)}</p>

  ${claimBlock(assurance)}

  <h2>Evidências por argumento</h2>
  ${assurance.arguments.map(evidenceGroup).join('')}
  ${annex(assurance)}
</main>
<footer class="audit" data-audit-footer data-chain-intact="${verification.intact}">
  <span>${chainLine}</span>
  <span>verificado ${esc(verification.verifiedAt)} · gerado ${esc(assurance.generatedAt)}</span>
  <span>aprovadores: ${esc(approvers)}</span>
  ${anchor ? `<span data-audit-anchor>âncora: ${esc(anchor)}</span>` : ''}
  <span class="page-counter"></span>
</footer>
</body>
</html>
`;
}
