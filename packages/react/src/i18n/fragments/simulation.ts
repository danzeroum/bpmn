import type { Messages } from '../messages.js';

/**
 * Simulation & replay dictionary fragment (Handoff 11 N-6). Covers the
 * simulation panel, gateway/decision choice cards (`sim.*`) and the token-replay
 * panel (`replay.*`). Both official dictionaries sit side by side; `en.ts` /
 * `ptBR.ts` spread each side into the flat lookup tables. Plural pairs use
 * `_one` / `_other`; interpolation tokens are `{token}`.
 */
export const simulation: { en: Messages; ptBR: Messages } = {
  en: {
    // Simulation panel
    'sim.panel.aria': 'Simulation panel',
    'sim.eyebrow': 'SIMULATION · SESSION #{session}',
    'sim.reset': 'Restart',
    'sim.boundary.fire': 'Fire boundary “{label}”',
    'sim.boundary.nonInterrupting': ' (non-interrupting)',
    'sim.error.title': 'Throw error on “{host}”',
    'sim.error.throw': 'Error “{label}”',
    'sim.error.uncatalogued': 'Uncatalogued error',
    // ES-5 (§4e): manual event-subprocess card — never auto-fires.
    'sim.esub.title': 'Event subprocess “{label}”',
    'sim.esub.interrupting': 'interrupting — cancels the tokens of this scope',
    'sim.esub.nonInterrupting': 'non-interrupting — the scope continues in parallel',
    'sim.esub.fireTimer': 'Fire timer manually (never auto-fires)',
    'sim.esub.fireConditional': 'Fire condition manually (never auto-fires)',
    'sim.stepMode': 'Step-by-step mode without animation (reduced motion)',
    'sim.coverage.title': 'PATH COVERAGE · {covered}/{total}',
    'sim.trail.title': 'SESSION TRAIL',
    'sim.trail.empty': 'session started',
    'sim.trail.approx': ' · ~approx',
    'sim.approxNotice.before': 'This model uses an OR gateway — join semantics are ',
    'sim.approxNotice.emphasis': 'approximate',
    'sim.approxNotice.after': ' (see limitations.md).',
    'sim.record': 'Record session to ledger',
    // Gateway choice card
    'sim.gateway.aria': 'Gateway {label}',
    'sim.gateway.chooseExit': 'Gateway “{label}” — choose the exit:',
    'sim.choice.confirm': 'Confirm ({n})',
    'sim.choice.approx': 'approximate semantics (limitations.md)',
    // Decision-input card
    'sim.decision.label': 'Decision: {label}',
    'sim.decision.evaluate': 'Evaluate table',
    'sim.decision.blocked': 'decision not simulable',
    'sim.decision.cell': "cell '{cell}': ",
    'sim.decision.seeSubset': 'See the supported S-FEEL subset in ',
    // Replay panel
    'replay.panel.aria': 'Replay panel',
    'replay.eventLog': 'IMPORTED EVENT LOG',
    'replay.meta': '{cases} cases · {events} events · pre-aggregated in 1 pass',
    'replay.meta.unmapped_one': ' · {count} unmapped activity',
    'replay.meta.unmapped_other': ' · {count} unmapped activities',
    'replay.fitness.title': 'TOKEN-REPLAY FITNESS',
    'replay.fitness.empty':
      'No runs in this version — compare against a version that has runs to ground the promotion.',
    'replay.fitness.conforming': '{conforming} of {total} cases reproduce fully in the model. ',
    'replay.fitness.nonConforming_one':
      '{n} case with events lacking a matching path (deviations below).',
    'replay.fitness.nonConforming_other':
      '{n} cases with events lacking a matching path (deviations below).',
    'replay.compare.title': 'BEFORE APPROVING v{version}',
    'replay.compare.attached':
      'Analysis attached to the promotion request — becomes a block in the Approver Review and an entry in the ledger.',
    'replay.compare.attach': 'attach this analysis to the promotion request',
    'replay.deviations.title': 'MODEL DEVIATIONS · {n}',
    'replay.deviations.none': 'No deviations — the log fully adheres to the model.',
    'replay.cases_one': '{n} case',
    'replay.cases_other': '{n} cases',
    'replay.variants.title': 'VARIANTS · TOP {n} (SAMPLED)',
    'replay.variant.stop': 'Stop',
    'replay.variant.play': 'Play',
    'replay.legend':
      'Import: XES 2.0 or CSV (case, activity, timestamp). Pre-aggregated heatmap — the animation reproduces only sampled traces, never 1 token per event.',
  },
  ptBR: {
    // Simulation panel
    'sim.panel.aria': 'Painel de simulação',
    'sim.eyebrow': 'SIMULAÇÃO · SESSÃO #{session}',
    'sim.reset': 'Reiniciar',
    'sim.boundary.fire': 'Disparar boundary “{label}”',
    'sim.boundary.nonInterrupting': ' (não-interruptivo)',
    'sim.error.title': 'Lançar erro em “{host}”',
    'sim.error.throw': 'Erro “{label}”',
    'sim.error.uncatalogued': 'Erro não catalogado',
    // ES-5 (§4e): card manual do event subprocess — nunca auto-dispara.
    'sim.esub.title': 'Event subprocess “{label}”',
    'sim.esub.interrupting': 'interruptivo — cancela os tokens deste escopo',
    'sim.esub.nonInterrupting': 'não-interruptivo — o escopo segue em paralelo',
    'sim.esub.fireTimer': 'Disparar timer manualmente (nunca auto-dispara)',
    'sim.esub.fireConditional': 'Disparar condição manualmente (nunca auto-dispara)',
    'sim.stepMode': 'Modo passo a passo sem animação (reduced motion)',
    'sim.coverage.title': 'COBERTURA DE CAMINHOS · {covered}/{total}',
    'sim.trail.title': 'TRILHA DA SESSÃO',
    'sim.trail.empty': 'sessão iniciada',
    'sim.trail.approx': ' · ~aprox',
    'sim.approxNotice.before': 'Este modelo usa gateway OR — semântica de join é ',
    'sim.approxNotice.emphasis': 'aproximada',
    'sim.approxNotice.after': ' (ver limitations.md).',
    'sim.record': 'Registrar sessão no ledger',
    // Gateway choice card
    'sim.gateway.aria': 'Gateway {label}',
    'sim.gateway.chooseExit': 'Gateway “{label}” — escolha a saída:',
    'sim.choice.confirm': 'Confirmar ({n})',
    'sim.choice.approx': 'semântica aproximada (limitations.md)',
    // Decision-input card
    'sim.decision.label': 'Decisão: {label}',
    'sim.decision.evaluate': 'Avaliar tabela',
    'sim.decision.blocked': 'decisão não-simulável',
    'sim.decision.cell': "célula '{cell}': ",
    'sim.decision.seeSubset': 'Ver o subconjunto S-FEEL suportado em ',
    // Replay panel
    'replay.panel.aria': 'Painel de replay',
    'replay.eventLog': 'EVENT LOG IMPORTADO',
    'replay.meta': '{cases} casos · {events} eventos · pré-agregado em 1 passada',
    'replay.meta.unmapped_one': ' · {count} atividade não mapeada',
    'replay.meta.unmapped_other': ' · {count} atividades não mapeadas',
    'replay.fitness.title': 'TOKEN-REPLAY FITNESS',
    'replay.fitness.empty':
      'Sem execuções nesta versão — compare com uma versão que tenha runs para fundamentar a promoção.',
    'replay.fitness.conforming':
      '{conforming} de {total} casos reproduzem integralmente no modelo. ',
    'replay.fitness.nonConforming_one':
      '{n} caso com eventos sem caminho correspondente (desvios abaixo).',
    'replay.fitness.nonConforming_other':
      '{n} casos com eventos sem caminho correspondente (desvios abaixo).',
    'replay.compare.title': 'ANTES DE APROVAR A v{version}',
    'replay.compare.attached':
      'Análise anexada ao pedido de promoção — vira bloco na Revisão do Aprovador e entrada no ledger.',
    'replay.compare.attach': 'anexar esta análise ao pedido de promoção',
    'replay.deviations.title': 'DESVIOS DO MODELO · {n}',
    'replay.deviations.none': 'Nenhum desvio — o log adere integralmente ao modelo.',
    'replay.cases_one': '{n} caso',
    'replay.cases_other': '{n} casos',
    'replay.variants.title': 'VARIANTES · TOP {n} (AMOSTRADAS)',
    'replay.variant.stop': 'Parar',
    'replay.variant.play': 'Reproduzir',
    'replay.legend':
      'Import: XES 2.0 ou CSV (case, activity, timestamp). Heatmap pré-agregado — a animação reproduz apenas traces amostrados, nunca 1 token por evento.',
  },
};
