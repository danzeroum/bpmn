import { useRef, useState } from 'react';
import { AuditLedger, BpmnXmlConverter, type BpmnDiagram } from '@bpmn-react/core';
import { BpmnEditor, resolveEditorConfig, useDiagram, type BpmnPlugin } from '@bpmn-react/react';
import { domainExamplePlugin } from '@bpmn-react/domain-example';
import { buildSampleDiagram, buildStressDiagram } from './sampleDiagram.js';
import { LifecyclePanel } from './LifecyclePanel.js';
import { AuditPanel } from './AuditPanel.js';
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

const PLUGINS = [domainExamplePlugin, observabilityPlugin];

export function App() {
  const [diagram, setDiagram] = useState<BpmnDiagram>(() => {
    // `?stress=350` loads the synthetic perf grid (see perf.spec.ts / NFR).
    const stress = new URLSearchParams(window.location.search).get('stress');
    return stress ? buildStressDiagram(Number(stress) || 350) : buildSampleDiagram();
  });
  const [editorKey, setEditorKey] = useState(0);
  const latestRef = useRef(diagram);

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
        </BpmnEditor>
      </main>
    </div>
  );
}

/** Right-hand governance/audit column rendered inside the editor context. */
function SidePanels() {
  const { diagram } = useDiagram();
  void diagram; // subscribe so the panels stay in sync
  // One ledger for the whole demo: command auditing (AuditPanel) and the
  // promotion toast (PromotionPanel) share the same hash chain.
  const ledgerRef = useRef<AuditLedger | null>(null);
  if (ledgerRef.current === null) ledgerRef.current = new AuditLedger();
  return (
    <div className="demo-side">
      <LifecyclePanel ledger={ledgerRef.current} />
      <AuditPanel ledger={ledgerRef.current} />
    </div>
  );
}
