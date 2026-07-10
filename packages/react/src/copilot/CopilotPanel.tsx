import { useCallback, useRef, useState } from 'react';
import {
  buildPlan,
  parseProposal,
  validateProposal,
  COPILOT_ADJUST_PROMPT,
  COPILOT_DRAFT_PROMPT,
  type AIProvider,
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

  const push = (entry: ChatEntry) => setMessages((m) => [...m, entry]);

  const ask = useCallback(
    async (text: string) => {
      if (!provider || busy) return;
      setBusy(true);
      push({ role: 'user', text });
      const context =
        `Estado atual do diagrama (nós): ` +
        JSON.stringify(Object.values(diagram.nodes).map((n) => ({ id: n.id, type: n.type, label: n.label })));
      history.current.push({ role: 'user', content: `${text}\n\n${context}` });
      try {
        const raw = await provider.complete({ system: template.system, messages: history.current });
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
