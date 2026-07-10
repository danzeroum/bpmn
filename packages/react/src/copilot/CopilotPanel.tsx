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
  type CopilotPromptTemplate,
  type Msg,
  type SoundnessPreview,
} from '@buildtovalue/copilot';
import { generateId, type BpmnDiagram } from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';

/**
 * Copilot panel (Handoff 9 CP-2, §6 UX): 372px chat surface where the AI
 * DRAFTS and humans stay in charge. Header shows the provider, the versioned
 * prompt-template and the `SÓ RASCUNHA` pill; every AI response carries a
 * mono footer with authorship, the applied command id (ledger-traceable) and
 * the LOCALLY computed soundness preview. "Desfazer tudo" reverts the whole
 * plan in one undo. Without a provider the panel renders nothing and the
 * editor is unchanged (§8.5).
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
}

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  footer?: { author: string; commandId: string; ledgerHash?: string; soundness: SoundnessPreview };
  error?: boolean;
}

export function CopilotPanel({ provider, resolveLedgerHash, author = 'anônimo' }: CopilotPanelProps) {
  const { diagram, execute, undo, stack } = useDiagram();
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
        execute(plan.command);
        appliedState.current = stack.current;
        setApplied(true);
        const ledgerHash = await resolveLedgerHash?.();
        push({
          role: 'assistant',
          text: parsed.proposal.rationale,
          footer: {
            author: `ia.copilot@${provider.id} + ${author}`,
            commandId: plan.command.id,
            ledgerHash,
            soundness: plan.soundnessPreview,
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [author, busy, diagram, execute, provider, resolveLedgerHash, stack, template],
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

  return (
    <aside className="bpmnr-copilot" data-testid="copilot-panel" style={{ width: 372 }}>
      <header className="bpmnr-copilot-header">
        <strong>✦ Copiloto</strong>
        <span className="bpmnr-copilot-meta" data-testid="copilot-meta">
          {provider.id} · prompt: {template.id} v{template.version}
        </span>
        <span className="bpmnr-copilot-pill" data-testid="copilot-pill">
          SÓ RASCUNHA
        </span>
      </header>
      {applied && (
        <div className="bpmnr-copilot-seal" data-testid="copilot-seal">
          ◌ RASCUNHO · autoria: <span style={{ color: '#33567E' }}>ia.copilot@{provider.id}</span> +{' '}
          {author}
        </div>
      )}
      {sndErrors.length > 0 && (
        <div className="bpmnr-copilot-snd" data-testid="copilot-snd-errors">
          <strong>⚠ Soundness · {sndErrors.length} erro(s)</strong>
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
            ✦ Sugerir correção
          </button>
          <span className="bpmnr-copilot-meta">
            prompt: {COPILOT_FIX_PROMPT.id} v{COPILOT_FIX_PROMPT.version}
          </span>
        </div>
      )}
      <div className="bpmnr-copilot-chat">
        {messages.map((entry, index) => (
          <div key={index} data-role={entry.role} data-error={entry.error || undefined}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</p>
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
          ✦ Gerar rascunho do processo
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || input.trim() === ''}
          onClick={() => void ask(input.trim())}
          data-testid="copilot-adjust"
        >
          Pedir ajuste
        </button>
      )}
      <textarea
        aria-label="Pedido ao copiloto"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={empty ? 'Descreva o processo…' : 'Descreva o ajuste…'}
      />
      <button type="button" disabled={!undoAllEnabled} onClick={undoAll} data-testid="copilot-undo-all">
        Desfazer tudo
      </button>
    </aside>
  );
}
