import { useRef, useState } from 'react';
import { AuditLedger, BpmnXmlConverter, getEdgeChain, type BpmnDiagram } from '@bpmn-react/core';
import {
  BpmnEditor,
  BpmnSimulator,
  EdgePedigreeStrip,
  resolveEditorConfig,
  useCanvasState,
  useDiagram,
  useDismissal,
  type BpmnPlugin,
  type GovernanceBreadcrumbLevel,
} from '@bpmn-react/react';
import {
  DecisionPeek,
  DecisionTableEditor,
  decisionInspectorSection,
  dmnPlugin,
  type DecisionSummary,
} from '@bpmn-react/dmn';
import { domainExamplePlugin } from '@bpmn-react/domain-example';
import { healthcarePlugin } from '@bpmn-react/healthcare';
import { callActivityBindingRule, VersionRegistry } from '@bpmn-react/registry';
import { soundnessPromotionRule, soundnessRules } from '@bpmn-react/soundness';
import { simulationSessionEntry } from '@bpmn-react/adapters-bpmn';
import {
  buildClosedDiagram,
  buildDeadlockDiagram,
  buildHealthcareDiagram,
  buildDrdDiagram,
  buildSampleDiagram,
  buildSimulationDiagram,
  buildStressDiagram,
  DEMO_DECISION_TABLE,
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

const PLUGINS = [domainExamplePlugin, dmnDemoPlugin, healthcarePlugin, observabilityPlugin, soundnessPlugin, bindingPlugin];

/** In-memory ledger the `?simulate` demo registers sessions into (Handoff 7A-3). */
const simulationDemoLedger = new AuditLedger();

export function App() {
  const [diagram, setDiagram] = useState<BpmnDiagram>(() => {
    // `?stress=350` loads the synthetic perf grid (see perf.spec.ts / NFR);
    // `?deadlock=1` loads the XOR-split → AND-join trap (soundness e2e).
    const params = new URLSearchParams(window.location.search);
    const stress = params.get('stress');
    if (stress) return buildStressDiagram(Number(stress) || 350, Number(params.get('closed')) || 0);
    if (params.get('deadlock')) return buildDeadlockDiagram();
    if (params.get('drd')) return buildDrdDiagram();
    if (params.get('closed')) return buildClosedDiagram();
    if (params.get('hc')) return buildHealthcareDiagram();
    return buildSampleDiagram();
  });
  const [editorKey, setEditorKey] = useState(0);
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
  if (studioMode) return <StudioSurface />;
  if (libraryMode) return <LibrarySurface />;
  if (simulateMode) {
    return (
      <BpmnSimulator
        diagram={buildSimulationDiagram()}
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
        // Observability (§2): import warnings are a product KPI.
        config.emitEditorEvent('import.warning', { count: warnings.length, warnings });

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
      </header>

      <main className="demo-main">
        <BpmnEditor
          key={editorKey}
          diagram={diagram}
          plugins={PLUGINS}
          onChange={(next) => {
            latestRef.current = next;
          }}
        >
          <SidePanels />
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
