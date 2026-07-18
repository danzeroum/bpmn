import { useRef, useState } from 'react';
import {
  addNodeCommand,
  AuditLedger,
  BpmnXmlConverter,
  createDiagram,
  generateId,
  getEdgeChain,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  astarConnection,
  CopilotPanel,
  BpmnEditor,
  eventBindingRule,
  LintPanel,
  BpmnReplay,
  BpmnSimulator,
  EdgePedigreeStrip,
  I18nProvider,
  PT_BR,
  resolveEditorConfig,
  useCanvasState,
  useDiagram,
  useDismissal,
  type BpmnPlugin,
  type EdgeRouterContext,
  type GovernanceBreadcrumbLevel,
  type Messages,
} from '@buildtovalue/react';
import { BpmnViewer } from '@buildtovalue/react/viewer';
import {
  createSfeelDecisionSupport,
  DecisionPeek,
  DecisionTableEditor,
  decisionInspectorSection,
  dmnPlugin,
  type DecisionSummary,
} from '@buildtovalue/dmn';
import { domainExamplePlugin } from '@buildtovalue/domain-example';
import { healthcarePlugin } from '@buildtovalue/healthcare';
import { callActivityBindingRule, VersionRegistry } from '@buildtovalue/registry';
import { soundnessPromotionRule, soundnessRules } from '@buildtovalue/soundness';
import {
  activeCopilotPromptVersion,
  eventBindingChangedEntry,
  replayAnalysisEntry,
  simulationSessionEntry,
} from '@buildtovalue/adapters-bpmn';
import { demoEventResolver } from './eventLibrary.js';
import type { AIProvider } from '@buildtovalue/copilot';
import {
  buildClosedDiagram,
  buildBoundaryDiagram,
  buildDeadlockDiagram,
  buildHealthcareDiagram,
  buildDrdDiagram,
  buildAstarDiagram,
  buildFallbackDiagram,
  buildFanoutDiagram,
  buildManualRouteDiagram,
  buildSampleDiagram,
  buildSfeelDiagram,
  buildReplayTraces,
  buildSimulationDiagram,
  buildStressDiagram,
  DEMO_DECISION_TABLE,
  buildErrorSimDiagram,
  buildEventDefsDiagram,
  buildEventIoDiagram,
  buildTimerDiagram,
} from './sampleDiagram.js';
import { LifecyclePanel } from './LifecyclePanel.js';
import { AuditPanel } from './AuditPanel.js';
import { LibrarySurface } from './LibrarySurface.js';
import { StudioSurface } from './StudioSurface.js';
import './demo.css';

// Observability sink (§2): the host decides what to do with editor events —
// here they go to the console (lead time, import warnings, slow frames are
// the product KPIs a real host would measure).
const observabilityPlugin: BpmnPlugin = {
  id: 'demo/observability',
  onEditorEvent: (event) => {
    console.debug('[editor-event]', event.type, event.meta ?? {});
  },
};

// Soundness (Handoff 4 §C2): the SND_* rules feed Validate, the Soundness
// section of the PromotionPanel and the node badges; structural ERRORS block
// promotion to active through the lifecycle engine — the UI only reflects it.
const soundnessPlugin: BpmnPlugin = {
  id: 'demo/soundness',
  validationRules: soundnessRules({ locale: 'pt' }),
  lifecycleConfig: { promotionRules: [soundnessPromotionRule({ locale: 'pt' })] },
};

// Call-activity binding (Handoff 5 §3.2): the demo registry starts empty, so
// the sample's 'Billing (shared)' reference resolves to CALL_REF_MISSING on
// Validate — red stroke + badge + code on the node.
const demoProcessRegistry = new VersionRegistry();
const bindingPlugin: BpmnPlugin = {
  id: 'demo/call-binding',
  validationRules: [callActivityBindingRule(demoProcessRegistry)],
};

// BPMN ⇄ DMN link (Handoff 5 §4.3): in the BPMN sample the linked decision
// lives in the DRD demo diagram, so the peek and the DECISÃO · DMN inspector
// resolve it through this registry-like summary; "abrir →"/"editar tabela →"
// navigate to the decision's own surface (?drd=1).
const DEMO_DECISIONS: DecisionSummary[] = [
  {
    ref: 'demo-decision-risk',
    label: 'Aprovar crédito?',
    semanticVersion: '0.1.0',
    status: 'draft',
    table: DEMO_DECISION_TABLE,
  },
];

const searchDemoDecisions = (query: string) =>
  DEMO_DECISIONS.filter(
    (decision) =>
      query.trim() === '' ||
      decision.label.toLowerCase().includes(query.toLowerCase()) ||
      decision.ref.toLowerCase().includes(query.toLowerCase()),
  );

const openDecisionSurface = (ref: string) => {
  window.location.search = `?drd=1&decision=${encodeURIComponent(ref)}`;
};

const dmnDemoPlugin: BpmnPlugin = {
  ...dmnPlugin,
  inspectorSections: [
    decisionInspectorSection({ searchDecisions: searchDemoDecisions, onOpen: openDecisionSurface }),
  ],
};

// Context-menu plugin (Handoff 11 N-5): a `demo/menu` section through the
// {id, label, when, run} contract. The action goes through an EXISTING
// command (addNodeCommand) — `run` only ever receives the dispatcher, so the
// plugin cannot touch editor state directly.
const menuPlugin: BpmnPlugin = {
  id: 'demo/menu',
  contextMenuItems: () => [
    {
      id: 'duplicate-node',
      label: 'Duplicar nó',
      when: (target) => target.kind === 'node' && target.id !== undefined && target.diagram.nodes[target.id] !== undefined,
      run: (target, api) => {
        const node = target.diagram.nodes[target.id!];
        if (!node) return;
        api.execute(
          addNodeCommand({
            ...node,
            id: generateId(),
            x: node.x + 40,
            y: node.y + 40,
            label: `${node.label} (cópia)`,
            properties: { ...node.properties },
          }),
        );
      },
    },
  ],
};

const PLUGINS = [domainExamplePlugin, dmnDemoPlugin, healthcarePlugin, observabilityPlugin, soundnessPlugin, bindingPlugin, menuPlugin];

// Governed event definitions (`?events=1&lib=1`, Handoff 16 E-3): the demo
// catalog's resolver injected as a plugin + eventBindingRule wired as
// validation — the react editor never consults a registry. Binding changes
// are audited through the EXISTING `command.executed` event (catalog N-3
// stays at 16): the glue arms a diff the host runs in `onChange`, appending
// EVENT_BINDING_CHANGED entries and marking the DOM for e2e observability.
const eventLibraryLedger = new AuditLedger();
// The stack notifies `onChange` BEFORE the `command.executed` event, so the
// host stores the transition there and audits it here, once the event names
// a governed compose (bind/unbind/re-bind).
let lastTransition: { previous: BpmnDiagram; next: BpmnDiagram } | null = null;
const eventLibraryPlugin: BpmnPlugin = {
  id: 'demo/event-library',
  eventDefinitionResolver: demoEventResolver,
  validationRules: [eventBindingRule(demoEventResolver)],
  onEditorEvent: (event) => {
    if (event.type !== 'command.executed' || !lastTransition) return;
    const description = (event.meta as { description?: string }).description ?? '';
    if (description.includes('governada') || description.includes('governed')) {
      auditBindingChanges(lastTransition.previous, lastTransition.next);
    }
  },
};

const auditBindingChanges = (previous: BpmnDiagram, next: BpmnDiagram) => {
  for (const node of Object.values(next.nodes)) {
    const from = previous.nodes[node.id]?.properties.eventDefinitionBinding as string | undefined;
    const to = node.properties.eventDefinitionBinding as string | undefined;
    if (from === to) continue;
    void eventLibraryLedger.append(
      eventBindingChangedEntry({
        diagramId: next.id,
        versionId: next.version.id,
        nodeId: node.id,
        actor: { id: 'demo' },
        ...(from !== undefined ? { from } : {}),
        ...(to !== undefined ? { to } : {}),
      }),
    );
    document.body.dataset.eventBindingChanges = String(
      Number(document.body.dataset.eventBindingChanges ?? '0') + 1,
    );
    document.body.dataset.lastEventBinding = `${node.id}:${from ?? ''}→${to ?? ''}`;
  }
};

// Engine bridge demo (`?engine=candidate|active`, Handoff 14 §1f): turns on
// the properties panel's "Execução" tab. The signature truth is host-owned —
// here `?signed=1` plays the host ledger; deploy just marks the DOM so the
// e2e can observe the gate.
const engineBridgePlugin: BpmnPlugin = {
  id: 'demo/engine-bridge',
  engine: {
    id: 'zeebe',
    name: 'Camunda 8 (Zeebe)',
    isSigned: () => new URLSearchParams(window.location.search).get('signed') === '1',
    deploy: () => {
      document.body.dataset.deployed = '1';
    },
    onRequestPromotion: () => {
      document.body.dataset.promotionRequested = '1';
    },
  },
};

// A* zero-recalc probe (`?astar=1`, Handoff 10 R-2b): a router that delegates to
// the real astar connection but bumps a global counter on every PER-RENDER
// call. Cached edges bypass this (they paint from stored waypoints), so a pan
// with no drag must leave the counter untouched — the e2e's central assertion.
declare global {
  interface Window {
    __routerCalls?: number;
  }
}
const astarSpyPlugin: BpmnPlugin = {
  id: 'demo/astar-spy',
  edgeRouter: (source, target, context?: EdgeRouterContext) => {
    if (typeof window !== 'undefined') window.__routerCalls = (window.__routerCalls ?? 0) + 1;
    return astarConnection(source, target, context);
  },
};
const ASTAR_PLUGINS = [...PLUGINS, astarSpyPlugin];
const EVENT_LIB_PLUGINS = [...PLUGINS, eventLibraryPlugin];

/** In-memory ledger the `?simulate` demo registers sessions into (Handoff 7A-3). */
const simulationDemoLedger = new AuditLedger();

/** Two versions with bound runs for the `?replay` demo header (bindRun, 7B-3). */
const REPLAY_VERSIONS = [
  { versionId: 'v20', semanticVersion: '2.0.0', runCount: 100, traces: buildReplayTraces() },
  { versionId: 'v21', semanticVersion: '2.1.0', status: 'candidate', runCount: 0, traces: [] },
];
/** Ledger the `?replay` demo attaches its comparative analysis into (7B-3). */
const replayDemoLedger = new AuditLedger();

/**
 * Deterministic FAKE provider for the `?copilot=1` demo/e2e (§8.6 — CI never
 * calls the network): first completion returns the reimbursement draft,
 * later ones an incremental adjust.
 */
function makeFakeCopilotProvider(): AIProvider {
  const draft = JSON.stringify({
    commands: [
      { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'Início', x: 60, y: 160 } },
      { type: 'addNode', params: { id: 'analisar', type: 'userTask', label: 'Analisar pedido', x: 180, y: 140 } },
      { type: 'addNode', params: { id: 'decidir', type: 'exclusiveGateway', label: 'Aprovado?', x: 400, y: 150 } },
      { type: 'addNode', params: { id: 'pagar', type: 'serviceTask', label: 'Pagar reembolso', x: 540, y: 60 } },
      { type: 'addNode', params: { id: 'negar', type: 'task', label: 'Comunicar negativa', x: 540, y: 240 } },
      { type: 'addNode', params: { id: 'fim1', type: 'endEvent', label: 'Fim', x: 760, y: 80 } },
      { type: 'addNode', params: { id: 'fim2', type: 'endEvent', label: 'Fim', x: 760, y: 260 } },
      { type: 'addEdge', params: { id: 'c1', sourceId: 's', targetId: 'analisar' } },
      { type: 'addEdge', params: { id: 'c2', sourceId: 'analisar', targetId: 'decidir' } },
      { type: 'addEdge', params: { id: 'c3', sourceId: 'decidir', targetId: 'pagar', label: 'sim' } },
      { type: 'addEdge', params: { id: 'c4', sourceId: 'decidir', targetId: 'negar', label: 'não' } },
      { type: 'addEdge', params: { id: 'c5', sourceId: 'pagar', targetId: 'fim1' } },
      { type: 'addEdge', params: { id: 'c6', sourceId: 'negar', targetId: 'fim2' } },
    ],
    rationale: 'Rascunho: reembolso com análise e decisão de aprovação.',
    promptTemplateRef: { id: 'copilot-draft', version: '1.0.0' },
  });
  const adjust = JSON.stringify({
    commands: [{ type: 'updateNode', params: { id: 'analisar', label: 'Analisar pedido (SLA 48h)' } }],
    rationale: 'Ajuste: SLA explícito na análise.',
    promptTemplateRef: { id: 'copilot-adjust', version: '1.0.0' },
  });
  // C5 (CP-4): the fix for the `?copilot=1&fix=1` deadlock trap — the AND-join
  // becomes an XOR convergence (the branches are alternatives). It rides the
  // SAME validation pipeline as any other proposal.
  const fix = JSON.stringify({
    commands: [
      { type: 'removeNode', params: { id: 'join' } },
      { type: 'addNode', params: { id: 'junta', type: 'exclusiveGateway', label: 'Convergir', x: 520, y: 153 } },
      { type: 'addEdge', params: { id: 'g1', sourceId: 'yes', targetId: 'junta' } },
      { type: 'addEdge', params: { id: 'g2', sourceId: 'no', targetId: 'junta' } },
      { type: 'addEdge', params: { id: 'g3', sourceId: 'junta', targetId: 'end' } },
    ],
    rationale: 'Correção: a sincronização AND vira convergência XOR — os ramos são alternativos.',
    promptTemplateRef: { id: 'copilot-fix', version: '1.0.0' },
  });
  let calls = 0;
  return {
    id: 'claude-4',
    complete: async ({ messages }) => {
      const last = messages.at(-1)?.content ?? '';
      if (last.includes('Corrija os erros de soundness')) return fix;
      return calls++ === 0 ? draft : adjust;
    },
  };
}
const fakeCopilotProvider = makeFakeCopilotProvider();

/** Ledger-wired copilot surface: real AuditLedger over the editor stack, hash
 * resolved into the response footer. */
function CopilotDemo() {
  const { stack } = useDiagram();
  const ledgerRef = useRef<AuditLedger | null>(null);
  if (!ledgerRef.current) {
    ledgerRef.current = new AuditLedger();
    ledgerRef.current.connectCommandStack(stack, { id: 'ana.ruiz', role: 'editor' });
  }
  return (
    <CopilotPanel
      provider={fakeCopilotProvider}
      author="ana.ruiz"
      resolveLedgerHash={async () => {
        await ledgerRef.current!.flush();
        return ledgerRef.current!.getEntries().at(-1)?.hash;
      }}
      // CP-5 (§1.5): the header reflects what the Biblioteca adapter says is
      // the ACTIVE template version — the same canonical registry.
      promptStatus={(template) =>
        activeCopilotPromptVersion(template.id) === template.version ? 'ativa' : undefined
      }
    />
  );
}

export function App() {
  const [diagram, setDiagram] = useState<BpmnDiagram>(() => {
    // `?stress=350` loads the synthetic perf grid (see perf.spec.ts / NFR);
    // `?deadlock=1` loads the XOR-split → AND-join trap (soundness e2e).
    const params = new URLSearchParams(window.location.search);
    const stress = params.get('stress');
    if (stress) return buildStressDiagram(Number(stress) || 350, Number(params.get('closed')) || 0);
    if (params.get('astar')) return buildAstarDiagram();
    if (params.get('manual')) return buildManualRouteDiagram();
    if (params.get('fallback')) return buildFallbackDiagram();
    if (params.get('fanout')) return buildFanoutDiagram();
    if (params.get('deadlock')) return buildDeadlockDiagram();
    if (params.get('boundary')) return buildBoundaryDiagram();
    if (params.get('eventio')) return buildEventIoDiagram();
    if (params.get('timer')) return buildTimerDiagram();
    if (params.get('events')) return buildEventDefsDiagram(params.get('lib') !== null);
    if (params.get('drd')) return buildDrdDiagram();
    if (params.get('closed')) return buildClosedDiagram();
    if (params.get('hc')) return buildHealthcareDiagram();
    // `?empty=1` (Handoff 15 §2f): a truly empty canvas — the teaching empty
    // state with the one-click governed example (reviewFlow/palette e2e).
    if (params.get('empty')) return createDiagram({ id: 'demo-vazio', name: 'Canvas vazio' });
    const base = buildSampleDiagram();
    // `?engine=candidate|active` (Handoff 14 §1f): the deploy gate depends on
    // the version status — the e2e drives both sides of it.
    const engineStatus = params.get('engine');
    if (engineStatus === 'candidate' || engineStatus === 'active') {
      base.version = { ...base.version, status: engineStatus };
    }
    return base;
  });
  const [editorKey, setEditorKey] = useState(0);
  // Runtime dictionary switch (Handoff 11 N-6): the host owns locale. `messages`
  // is injected by prop — `undefined` → English fallback, `PT_BR` → the second
  // official dictionary. Toggling re-renders in place, no remount.
  const [lang, setLang] = useState<'en' | 'pt'>('pt');
  const messages: Messages | undefined = lang === 'pt' ? PT_BR : undefined;
  const latestRef = useRef(diagram);
  // `?drd=1` shows the decision's own surface; `?decision=<ref>` opens its
  // table straight away (deep link used by "abrir →"/"editar tabela →").
  const params = new URLSearchParams(window.location.search);
  const drdMode = params.get('drd') !== null;
  const decisionParam = params.get('decision');
  // `?library=1` renders the Biblioteca surface (Handoff 6 S-3) instead of
  // the editor — a read-only catalog page, no canvas. `?studio=1` renders
  // the full Studio shell (S-4: Biblioteca + Revisão do Aprovador).
  const libraryMode = params.get('library') !== null;
  const studioMode = params.get('studio') !== null;
  // `?simulate=1` enters token-simulation mode (Handoff 7A) over the 3-path demo.
  const simulateMode = params.get('simulate') !== null;
  // `?astar=1` swaps in the router-spy plugin over the A* routing demo.
  const astarMode = params.get('astar') !== null;
  // `?events=1&lib=1` adds the governed event-definition library (E-3).
  const eventsLibMode = params.get('events') !== null && params.get('lib') !== null;
  // `?replay=1` enters replay mode (Handoff 7B) over the same model + a synthetic log.
  const replayMode = params.get('replay') !== null;
  // `?sfeel=1` — S-FEEL decision demo (Handoff 9 SF-2); `&bad=1` uses a table
  // with a date() cell, outside the subset (honest ⚠ stop).
  const sfeelMode = params.get('sfeel') !== null;
  // `?copilot=1` — governed copilot demo (Handoff 9 CP-2), fake provider.
  const copilotMode = params.get('copilot') !== null;
  // `?viewer=1` — the lightweight, tree-shakeable read-only viewer (Handoff 11
  // N-7), imported from the '@buildtovalue/react/viewer' entry point.
  const viewerMode = params.get('viewer') !== null;
  if (viewerMode) {
    return (
      <div className="demo-app" data-testid="viewer-surface">
        <header className="demo-header">
          <h1>bpmn-react viewer</h1>
          <span className="demo-muted">read-only · tree-shakeable</span>
          <span className="demo-spacer" />
          <button
            type="button"
            data-testid="lang-toggle"
            data-lang={lang}
            onClick={() => setLang((l) => (l === 'pt' ? 'en' : 'pt'))}
          >
            {lang === 'pt' ? 'EN' : 'PT'}
          </button>
        </header>
        <main className="demo-main">
          <BpmnViewer diagram={diagram} plugins={PLUGINS} messages={messages} />
        </main>
      </div>
    );
  }
  if (studioMode) return <StudioSurface />;
  if (libraryMode) return <LibrarySurface />;
  if (replayMode) {
    // These read-only demo surfaces stay in pt-BR (their prior default); the
    // dictionary is injected via the shared I18nProvider (N-6).
    return (
      <I18nProvider messages={PT_BR}>
        <BpmnReplay
          diagram={buildSimulationDiagram()}
          versions={REPLAY_VERSIONS}
          candidate={{ semanticVersion: '2.1.0', change: 'boundary timer de 48h + escalation' }}
          author="demo"
          fileName="onboarding_prod_jun.xes"
          plugins={PLUGINS}
          // Handoff 7B-3: attach the comparative analysis to the candidate's
          // promotion — a ledger entry (host injection) the Approver Review reads.
          onAttachAnalysis={(analysis) => {
            void replayDemoLedger.append(replayAnalysisEntry(analysis, { id: 'demo' }, 'v21'));
          }}
          onExit={() => {
            window.location.search = '?simulate=1';
          }}
        />
      </I18nProvider>
    );
  }
  if (copilotMode) {
    // `&fix=1` seeds the XOR-split → AND-join trap (C5): the panel lists the
    // SND_* error and "✦ Sugerir correção" must REALLY remove it.
    const fixMode = params.get('fix') !== null;
    return (
      <BpmnEditor
        diagram={fixMode ? buildDeadlockDiagram() : createDiagram({ id: 'demo-copilot', name: 'Copiloto', createdBy: 'demo' })}
        plugins={PLUGINS}
        messages={PT_BR}
      >
        <CopilotDemo />
      </BpmnEditor>
    );
  }
  if (sfeelMode) {
    const sfeelDiagram = buildSfeelDiagram(params.get('bad') !== null);
    return (
      <I18nProvider messages={PT_BR}>
        <BpmnSimulator
          diagram={sfeelDiagram}
          plugins={PLUGINS}
          author="demo"
          decisions={createSfeelDecisionSupport(sfeelDiagram)}
          onExit={() => {
            window.location.search = '';
          }}
        />
      </I18nProvider>
    );
  }
  if (simulateMode) {
    return (
      <I18nProvider messages={PT_BR}>
        <BpmnSimulator
          diagram={params.get('errors') ? buildErrorSimDiagram() : buildSimulationDiagram()}
          plugins={PLUGINS}
          author="demo"
          // Handoff 7A-3: register the session as an auditable ledger entry (host
          // injection). The mapper lives in adapters-bpmn; the demo appends to an
          // in-memory ledger, which certify would turn into SACM evidence.
          onRecord={(session) => {
            void simulationDemoLedger.append(simulationSessionEntry(session, { id: 'demo' }));
          }}
          onExit={() => {
            window.location.search = '';
          }}
        />
      </I18nProvider>
    );
  }

  const replaceFromOutside = (next: BpmnDiagram) => {
    latestRef.current = next;
    setDiagram(next);
    setEditorKey((k) => k + 1); // remount: new diagram, fresh history
  };

  const importXml = async (file: File) => {
    const text = await file.text();
    const config = resolveEditorConfig(PLUGINS);
    const converter = new BpmnXmlConverter({
      registry: config.registry,
      preferredTypes: config.preferredTypes,
    });
    try {
      const { diagram: imported, warnings } = converter.fromXml(text);
      if (warnings.length > 0) {
        // Observability (§2, payload tipado N-3): one event per warning.
        for (const warning of warnings) {
          config.emitEditorEvent('import.warning', { message: warning });
        }

        alert(`Imported with warnings:\n${warnings.join('\n')}`);
      }
      replaceFromOutside(imported);
    } catch (error) {
       
      alert(`Import failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="demo-app">
      <header className="demo-header">
        <h1>bpmn-react demo</h1>
        <span className="demo-muted">zero-dependency BPMN designer with governance</span>
        <span className="demo-spacer" />
        <label className="demo-import">
          Import BPMN XML
          <input
            type="file"
            accept=".xml,.bpmn"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importXml(file);
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" onClick={() => replaceFromOutside(buildSampleDiagram())}>
          Reset sample
        </button>
        <button
          type="button"
          data-testid="lang-toggle"
          data-lang={lang}
          onClick={() => setLang((l) => (l === 'pt' ? 'en' : 'pt'))}
        >
          {lang === 'pt' ? 'EN' : 'PT'}
        </button>
      </header>

      <main className="demo-main">
        <BpmnEditor
          key={editorKey}
          diagram={diagram}
          plugins={
            astarMode
              ? ASTAR_PLUGINS
              : eventsLibMode
                ? EVENT_LIB_PLUGINS
                : params.get('engine') || params.get('eventio')
                  ? [...PLUGINS, engineBridgePlugin]
                  : PLUGINS
          }
          messages={messages}
          onChange={(next) => {
            if (eventsLibMode) lastTransition = { previous: latestRef.current, next };
            latestRef.current = next;
          }}
        >
          <SidePanels />
          {/* E-5 (§3d): the lint dock over the timer demo — TIMER_MALFORMED +
              EVT_REF_MISSING ride the EXISTING U-5 surface, zero new UI. */}
          {params.get('timer') && <LintPanel />}
          {!drdMode && (
            <DecisionPeek
              resolveDecision={(ref) => DEMO_DECISIONS.find((d) => d.ref === ref)}
              onOpen={openDecisionSurface}
            />
          )}
          {drdMode && <DrdTableSurface initialDecisionId={decisionParam} />}
          <PedigreeSurface />
        </BpmnEditor>
      </main>
    </div>
  );
}

/**
 * The decision's own editing surface (DRD mode, Handoff 5 §4.2): opens on
 * the selection of a dmn:decision (or the ?decision deep link) with the
 * governance breadcrumb `fluxo vX ▸ nó ▸ tabela vY [SELO]`. Esc rides the
 * single dismissal stack — table popovers close first, then this surface,
 * then the canvas selection (§11.1).
 */
function DrdTableSurface({ initialDecisionId }: { initialDecisionId: string | null }) {
  const { diagram } = useDiagram();
  const selectedIds = useCanvasState((s) => s.selectedIds);
  const selected = selectedIds.length === 1 ? diagram.nodes[selectedIds[0]] : undefined;
  const fromSelection = selected?.type === 'dmn:decision' ? selected.id : null;

  const [manual, setManual] = useState<string | null>(initialDecisionId);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  // Selection change re-arms the surface (dismissal is per stay-selected).
  const [lastSelection, setLastSelection] = useState(fromSelection);
  if (fromSelection !== lastSelection) {
    setLastSelection(fromSelection);
    if (fromSelection) setDismissedFor(null);
  }

  const decisionId = fromSelection ?? manual;
  const decision = decisionId ? diagram.nodes[decisionId] : undefined;
  const open = Boolean(decision) && dismissedFor !== decisionId;
  const close = () => {
    setDismissedFor(decisionId);
    setManual(null);
  };
  useDismissal('drd-table-surface', open, close);

  if (!open || !decision || !decisionId) return null;
  const { semanticVersion, status } = diagram.version;
  const levels: GovernanceBreadcrumbLevel[] = [
    { id: null, label: diagram.name, semanticVersion, status },
    { id: decisionId, label: decision.label },
    { id: 'table', label: 'tabela', semanticVersion, status },
  ];
  return (
    <div className="demo-table-surface">
      <DecisionTableEditor
        decisionId={decisionId}
        breadcrumbLevels={levels}
        onNavigate={() => close()}
      />
    </div>
  );
}

/**
 * Edge pedigree (Handoff 5 §5): selecting an edge that belongs to a
 * supersession chain (length > 1) docks the pedigree strip over the lower
 * canvas. Esc order: DiffView do par adjacente → faixa → seleção (§11.1).
 */
function PedigreeSurface() {
  const { diagram } = useDiagram();
  const selectedIds = useCanvasState((s) => s.selectedIds);
  const edge = selectedIds.length === 1 ? diagram.edges[selectedIds[0]] : undefined;
  const chain = edge ? getEdgeChain(diagram, edge.id) : [];

  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [lastEdge, setLastEdge] = useState<string | null>(edge?.id ?? null);
  if ((edge?.id ?? null) !== lastEdge) {
    setLastEdge(edge?.id ?? null);
    if (edge) setDismissedFor(null);
  }
  if (!edge || chain.length < 2 || dismissedFor === edge.id) return null;
  return <EdgePedigreeStrip edgeId={edge.id} onClose={() => setDismissedFor(edge.id)} />;
}

/** Right-hand governance/audit column rendered inside the editor context. */
function SidePanels() {
  const { diagram } = useDiagram();
  void diagram; // subscribe so the panels stay in sync
  // One ledger for the whole demo: command auditing (AuditPanel) and the
  // promotion toast (PromotionPanel) share the same hash chain.
  const ledgerRef = useRef<AuditLedger | null>(null);
  if (ledgerRef.current === null) ledgerRef.current = new AuditLedger();
  // Bumped when governance appends outside the command stack (attestation).
  const [ledgerTick, setLedgerTick] = useState(0);
  return (
    <div className="demo-side">
      <LifecyclePanel
        ledger={ledgerRef.current}
        onLedgerAppend={() => setLedgerTick((tick) => tick + 1)}
      />
      <AuditPanel ledger={ledgerRef.current} refreshToken={ledgerTick} />
    </div>
  );
}
