import { useRef, useState } from 'react';
import { BpmnXmlConverter, type BpmnDiagram } from '@bpmn-react/core';
import { BpmnEditor, resolveEditorConfig, useDiagram } from '@bpmn-react/react';
import { domainExamplePlugin } from '@bpmn-react/domain-example';
import { buildSampleDiagram } from './sampleDiagram.js';
import { LifecyclePanel } from './LifecyclePanel.js';
import { AuditPanel } from './AuditPanel.js';
import './demo.css';

const PLUGINS = [domainExamplePlugin];

export function App() {
  const [diagram, setDiagram] = useState<BpmnDiagram>(() => buildSampleDiagram());
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
        // eslint-disable-next-line no-alert
        alert(`Imported with warnings:\n${warnings.join('\n')}`);
      }
      replaceFromOutside(imported);
    } catch (error) {
      // eslint-disable-next-line no-alert
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
  return (
    <div className="demo-side">
      <LifecyclePanel />
      <AuditPanel />
    </div>
  );
}
