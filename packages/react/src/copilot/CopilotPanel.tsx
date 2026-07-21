import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildPlan,
  parseProposal,
  soundnessErrors,
  validateProposal,
  COPILOT_ADJUST_PROMPT,
  COPILOT_DRAFT_PROMPT,
  COPILOT_FIX_PROMPT,
  type AIProvider,
  type CopilotPlan,
  type CopilotPromptTemplate,
  type Msg,
  type PromptTemplateRef,
  type ProposedCommand,
  type SoundnessPreview,
} from '@buildtovalue/copilot';
import { generateId, type BpmnDiagram } from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Copilot panel (Handoff 9 CP-2, §6 UX): 372px chat surface where the AI
 * DRAFTS and humans stay in charge. Header shows the provider, the versioned
 * prompt-template and the `SÓ RASCUNHA` pill; every AI response carries a
 * mono footer with authorship, the applied command id (ledger-traceable) and
 * the LOCALLY computed soundness preview. "Desfazer tudo" reverts the whole
 * plan in one undo. Without a provider the panel renders nothing and the
 * editor is unchanged (§8.5).
 *
 * #150 (N-3) — aplicar ≠ aprovar made VISIBLE: a valid proposal arrives as a
 * card in state PROPOSTA (nothing touches the diagram); `[Aplicar no
 * rascunho]` executes the ONE composite through the normal CommandStack
 * (RuleEngine/lint validate it like any edit) and the card — which never
 * disappears — turns APLICADA · NÃO APROVADA (amber pill + banner).
 * APROVADA (green) is only ever painted from the HOST's lifecycle signal
 * (`suggestionStatus`), never by the act of applying.
 */
export interface CopilotPanelProps {
  /** HOST-injected transport (§1.4). Absent → the panel does not render. */
  provider?: AIProvider;
  /**
   * Resolves the ledger hash to show in the response footer after a proposal
   * is applied (the host owns the ledger). Optional — footer omits the line.
   */
  resolveLedgerHash?: () => Promise<string | undefined>;
  /** Human co-author shown in the mixed-authorship seal (e.g. "ana.ruiz"). */
  author?: string;
  /**
   * CP-5 (cerca §1.5): lifecycle status of a template as the host's Biblioteca
   * knows it — e.g. "ativa" when the shipped version is the active one. Shown
   * after the version in the header ("prompt: copilot-draft v1.0.0 ativa").
   * Omitted → header unchanged.
   */
  promptStatus?: (template: PromptTemplateRef) => string | undefined;
  /**
   * #150: host hook behind `[Enviar p/ aprovação]` on an APPLIED card — the
   * panel only ROUTES the intent (the lifecycle/registry/RBAC live in the
   * host). Omitted → the button is not rendered.
   */
  onSubmitForApproval?: (info: { commandId: string }) => void;
  /**
   * #150: the HOST's lifecycle verdict for an applied suggestion, by the
   * applied command id — the ONLY source that ever paints the green
   * APROVADA pill. Applying never changes lifecycle status; omitting this
   * prop means no suggestion is ever shown as approved.
   */
  suggestionStatus?: (commandId: string) => 'approved' | undefined;
}

/** #150 — the three visible states of a suggestion card. */
type ProposalStatus = 'proposed' | 'applied' | 'discarded';

interface ProposalState {
  plan: CopilotPlan;
  commands: ProposedCommand[];
  status: ProposalStatus;
  showDiff: boolean;
  /** Declared veto reason when the CommandStack/RuleEngine refused the apply. */
  vetoReason?: string;
}

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  footer?: { author: string; commandId: string; ledgerHash?: string; soundness: SoundnessPreview };
  error?: boolean;
  proposal?: ProposalState;
}

export function CopilotPanel({
  provider,
  resolveLedgerHash,
  author = 'anônimo',
  promptStatus,
  onSubmitForApproval,
  suggestionStatus,
}: CopilotPanelProps) {
  const { diagram, execute, undo, stack } = useDiagram();
  const t = useT();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const conversationId = useRef(generateId());
  const history = useRef<Msg[]>([]);
  const appliedState = useRef<BpmnDiagram | null>(null);

  const empty = Object.keys(diagram.nodes).length === 0;
  const template = empty && messages.length === 0 ? COPILOT_DRAFT_PROMPT : COPILOT_ADJUST_PROMPT;
  // C5 (Handoff 9 §4): the SND_* errors of the CURRENT diagram, from the same
  // LOCAL analyzer as the preview — the list recomputes after every apply, so
  // a "fix" that does not fix stays visibly listed.
  const sndErrors = useMemo(() => soundnessErrors(diagram), [diagram]);

  const push = (entry: ChatEntry) => setMessages((m) => [...m, entry]);
  const patchProposal = (index: number, patch: Partial<ProposalState>) =>
    setMessages((m) =>
      m.map((entry, i) =>
        i === index && entry.proposal ? { ...entry, proposal: { ...entry.proposal, ...patch } } : entry,
      ),
    );

  const ask = useCallback(
    async (text: string, promptTemplate?: CopilotPromptTemplate) => {
      if (!provider || busy) return;
      setBusy(true);
      push({ role: 'user', text });
      const context =
        `Estado atual do diagrama: ` +
        JSON.stringify({
          nodes: Object.values(diagram.nodes).map((n) => ({ id: n.id, type: n.type, label: n.label })),
          edges: Object.values(diagram.edges).map((e) => ({ id: e.id, sourceId: e.sourceId, targetId: e.targetId })),
        });
      history.current.push({ role: 'user', content: `${text}\n\n${context}` });
      try {
        const raw = await provider.complete({
          system: (promptTemplate ?? template).system,
          messages: history.current,
        });
        history.current.push({ role: 'assistant', content: raw });
        const parsed = parseProposal(raw);
        if ('error' in parsed) {
          push({ role: 'assistant', text: `Proposta inválida: ${parsed.error}`, error: true });
          return;
        }
        const verdict = validateProposal(diagram, parsed.proposal);
        if (!verdict.ok) {
          // Integral rejection (§1.3): nothing was applied.
          push({
            role: 'assistant',
            text:
              'Proposta rejeitada por inteiro:\n' +
              verdict.errors.map((e) => `• comando #${e.index + 1}: ${e.message}`).join('\n'),
            error: true,
          });
          return;
        }
        const plan = buildPlan(diagram, parsed.proposal, {
          providerId: provider.id,
          conversationId: conversationId.current,
        });
        // #150: NOTHING executes here. The proposal lands as a card the human
        // applies (or discards) explicitly — state PROPOSTA.
        push({
          role: 'assistant',
          text: parsed.proposal.rationale,
          proposal: {
            plan,
            commands: parsed.proposal.commands,
            status: 'proposed',
            showDiff: false,
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, diagram, provider, template],
  );

  const applyProposal = useCallback(
    (index: number, proposal: ProposalState) => {
      // The plan rides the NORMAL CommandStack pipeline — RuleEngine/lint
      // validate it like any edit; a veto is declared on the card, never mute.
      const verdict = execute(proposal.plan.command);
      if (!verdict.allowed) {
        patchProposal(index, { vetoReason: verdict.reason ?? 'vetoed' });
        return;
      }
      appliedState.current = stack.current;
      setApplied(true);
      patchProposal(index, { status: 'applied', vetoReason: undefined });
      void (async () => {
        const ledgerHash = await resolveLedgerHash?.();
        setMessages((m) =>
          m.map((entry, i) =>
            i === index
              ? {
                  ...entry,
                  footer: {
                    author: `ia.copilot@${provider?.id ?? '?'} + ${author}`,
                    commandId: proposal.plan.command.id,
                    ledgerHash,
                    soundness: proposal.plan.soundnessPreview,
                  },
                }
              : entry,
          ),
        );
      })();
    },
    [author, execute, provider, resolveLedgerHash, stack],
  );

  if (!provider) return null;

  const undoAll = () => {
    // The plan is ONE composite: a single undo reverts it whole. Only offered
    // while the proposal is still the top of the stack.
    undo();
    setApplied(false);
    appliedState.current = null;
  };
  const undoAllEnabled = applied && appliedState.current === stack.current;

  /** #150: per-card undo — reverts the ONE composite and re-arms PROPOSTA. */
  const undoProposal = (index: number) => {
    if (!undoAllEnabled) return;
    undo();
    setApplied(false);
    appliedState.current = null;
    setMessages((m) =>
      m.map((entry, i) =>
        i === index && entry.proposal
          ? { ...entry, footer: undefined, proposal: { ...entry.proposal, status: 'proposed' } }
          : entry,
      ),
    );
  };

  const proposalCard = (entry: ChatEntry, index: number) => {
    const proposal = entry.proposal!;
    const { plan, commands, status } = proposal;
    const approved = status === 'applied' && suggestionStatus?.(plan.command.id) === 'approved';
    return (
      <div className="bpmnr-copilot-proposal" data-testid="copilot-proposal" data-status={approved ? 'approved' : status}>
        {status === 'proposed' && (
          <span className="bpmnr-copilot-proposal-pill" data-testid="copilot-proposal-pill">
            {t('copilot.proposal.pill')}
          </span>
        )}
        {status === 'applied' && !approved && (
          <span className="bpmnr-copilot-applied-pill" data-testid="copilot-applied-pill">
            {t('copilot.applied.pill')}
          </span>
        )}
        {approved && (
          <span className="bpmnr-copilot-approved-pill" data-testid="copilot-approved-pill">
            {t('copilot.approved.pill')}
          </span>
        )}
        <span className="bpmnr-copilot-proposal-summary">
          {t('copilot.proposal.summary', { count: commands.length })} ·{' '}
          {t('copilot.soundnessPreview', {
            errors: plan.soundnessPreview.errors,
            warnings: plan.soundnessPreview.warnings,
          })}
        </span>
        {status === 'applied' && !approved && (
          <p className="bpmnr-copilot-applied-banner" data-testid="copilot-applied-banner">
            {t('copilot.applied.banner')}
          </p>
        )}
        {proposal.vetoReason && (
          <p className="bpmnr-copilot-proposal-veto" data-testid="copilot-proposal-veto">
            🔒 {proposal.vetoReason}
          </p>
        )}
        {proposal.showDiff && (
          <ul className="bpmnr-copilot-proposal-diff" data-testid="copilot-proposal-diff">
            {commands.map((command, i) => (
              <li key={i}>
                <code>{command.type}</code> {JSON.stringify(command.params)}
              </li>
            ))}
          </ul>
        )}
        {status === 'proposed' && (
          <div className="bpmnr-copilot-proposal-actions">
            <button type="button" data-testid="copilot-apply" onClick={() => applyProposal(index, proposal)}>
              {t('copilot.proposal.apply')}
            </button>
            <button type="button" data-testid="copilot-discard" onClick={() => patchProposal(index, { status: 'discarded' })}>
              {t('copilot.proposal.discard')}
            </button>
            <button type="button" data-testid="copilot-view-diff" onClick={() => patchProposal(index, { showDiff: !proposal.showDiff })}>
              {t('copilot.applied.viewDiff')}
            </button>
          </div>
        )}
        {status === 'applied' && (
          <div className="bpmnr-copilot-proposal-actions">
            <button type="button" data-testid="copilot-undo-proposal" disabled={!undoAllEnabled} onClick={() => undoProposal(index)}>
              {t('copilot.applied.undo')}
            </button>
            <button type="button" data-testid="copilot-view-diff" onClick={() => patchProposal(index, { showDiff: !proposal.showDiff })}>
              {t('copilot.applied.viewDiff')}
            </button>
            {onSubmitForApproval && !approved && (
              <button
                type="button"
                data-testid="copilot-submit-approval"
                onClick={() => onSubmitForApproval({ commandId: plan.command.id })}
              >
                {t('copilot.applied.submitApproval')}
              </button>
            )}
          </div>
        )}
        {status === 'discarded' && (
          <p className="bpmnr-copilot-proposal-discarded" data-testid="copilot-discarded">
            {t('copilot.proposal.discarded')}
          </p>
        )}
      </div>
    );
  };

  return (
    <aside className="bpmnr-copilot" data-testid="copilot-panel" style={{ width: 372 }}>
      <header className="bpmnr-copilot-header">
        <strong>✦ {t('copilot.title')}</strong>
        <span className="bpmnr-copilot-meta" data-testid="copilot-meta">
          {provider.id} · {t('copilot.promptLabel')} {template.id} v{template.version}
          {promptStatus?.(template) ? ` ${promptStatus(template)}` : ''}
        </span>
        <span className="bpmnr-copilot-pill" data-testid="copilot-pill">
          {t('copilot.pill')}
        </span>
      </header>
      {applied && (
        <div className="bpmnr-copilot-seal" data-testid="copilot-seal">
          ◌ {t('copilot.sealDraft')} · {t('copilot.sealAuthorship')}{' '}
          <span style={{ color: '#33567E' }}>ia.copilot@{provider.id}</span> +{' '}
          {author}
        </div>
      )}
      {sndErrors.length > 0 && (
        <div className="bpmnr-copilot-snd" data-testid="copilot-snd-errors">
          <strong>
            ⚠ {t('copilot.soundness')} · {t('copilot.soundnessCount', { count: sndErrors.length })}
          </strong>
          <ul>
            {sndErrors.map((issue, index) => (
              <li key={index}>
                <code>{issue.code}</code> {issue.nodeId ?? issue.edgeId ?? ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="copilot-fix"
            disabled={busy}
            onClick={() =>
              // C5: the fix request rides the SAME pipeline as C2 — whitelist,
              // integral rejection, local preview; only the template differs.
              void ask(
                'Corrija os erros de soundness: ' +
                  sndErrors
                    .map((issue) => `${issue.code} em '${issue.nodeId ?? issue.edgeId ?? '?'}'`)
                    .join('; '),
                COPILOT_FIX_PROMPT,
              )
            }
          >
            ✦ {t('copilot.suggestFix')}
          </button>
          <span className="bpmnr-copilot-meta">
            {t('copilot.promptLabel')} {COPILOT_FIX_PROMPT.id} v{COPILOT_FIX_PROMPT.version}
          </span>
        </div>
      )}
      <div className="bpmnr-copilot-chat">
        {messages.map((entry, index) => (
          <div key={index} data-role={entry.role} data-error={entry.error || undefined}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</p>
            {entry.proposal && proposalCard(entry, index)}
            {entry.footer && (
              <pre className="bpmnr-copilot-footer" data-testid="copilot-footer">
                {`autoria: ${entry.footer.author}\n` +
                  (entry.footer.ledgerHash ? `ledger: #${entry.footer.ledgerHash.slice(0, 12)}\n` : '') +
                  `comando: ${entry.footer.commandId}\n` +
                  `soundness: ${entry.footer.soundness.errors} erros · ${entry.footer.soundness.warnings} avisos ${entry.footer.soundness.errors === 0 ? '✓' : '✗'}`}
              </pre>
            )}
          </div>
        ))}
      </div>
      {empty && messages.length === 0 ? (
        <button
          type="button"
          disabled={busy || input.trim() === ''}
          onClick={() => void ask(input.trim())}
          data-testid="copilot-generate"
        >
          ✦ {t('copilot.generate')}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || input.trim() === ''}
          onClick={() => void ask(input.trim())}
          data-testid="copilot-adjust"
        >
          {t('copilot.adjust')}
        </button>
      )}
      <textarea
        aria-label={t('copilot.inputAria')}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={empty ? t('copilot.placeholderProcess') : t('copilot.placeholderAdjust')}
      />
      <button type="button" disabled={!undoAllEnabled} onClick={undoAll} data-testid="copilot-undo-all">
        {t('copilot.undoAll')}
      </button>
    </aside>
  );
}
