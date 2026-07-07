import type { ReactNode } from 'react';
import { BpmnDesigner, type BpmnDesignerProps } from './BpmnDesigner.js';
import { Palette } from './ui/Palette.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { Toolbar } from './ui/Toolbar.js';
import { MiniMap } from './ui/MiniMap.js';
import { StatusBadge } from './ui/StatusBadge.js';

export interface BpmnEditorProps extends BpmnDesignerProps {
  /** Extra toolbar content. */
  toolbarExtra?: ReactNode;
  /** Hide individual chrome pieces. */
  hidePalette?: boolean;
  hideInspector?: boolean;
  hideMiniMap?: boolean;
}

/**
 * Batteries-included editor: BpmnDesigner + Toolbar + Palette +
 * PropertiesPanel + MiniMap + StatusBadge, arranged with the default layout.
 * Import `@bpmn-react/react/styles.css` for the default styling.
 */
export function BpmnEditor({
  toolbarExtra,
  hidePalette,
  hideInspector,
  hideMiniMap,
  children,
  ...designerProps
}: BpmnEditorProps) {
  return (
    <BpmnDesigner {...designerProps}>
      <div className="bpmnr-chrome-top">
        <Toolbar extra={toolbarExtra} />
        <StatusBadge />
      </div>
      {!hidePalette && !designerProps.readOnly && (
        <div className="bpmnr-chrome-left">
          <Palette />
        </div>
      )}
      {!hideInspector && (
        <div className="bpmnr-chrome-right">
          <PropertiesPanel />
        </div>
      )}
      {!hideMiniMap && (
        <div className="bpmnr-chrome-minimap">
          <MiniMap />
        </div>
      )}
      {children}
    </BpmnDesigner>
  );
}
