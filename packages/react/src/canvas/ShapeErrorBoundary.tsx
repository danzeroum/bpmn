import { Component, type ReactNode } from 'react';
import type { BpmnNode } from '@buildtovalue/core';

export interface ShapeErrorBoundaryProps {
  node: BpmnNode;
  /** Observability sink — receives `shape.render.error`. */
  onError: (meta: { nodeId: string; nodeType: string; message: string }) => void;
  children: ReactNode;
}

interface ShapeErrorBoundaryState {
  error: Error | null;
  /** The node reference the error was caught for — a new reference retries. */
  failedFor: BpmnNode | null;
}

/**
 * Editor resilience (Handoff 4 §D1): a shape that throws is replaced by an
 * error placeholder sized to the node bounds — the canvas, the sibling nodes
 * and the toolbar all survive. Because the model is immutable, any edit
 * produces a new `node` object, which resets the boundary and retries the
 * real shape automatically.
 */
export class ShapeErrorBoundary extends Component<ShapeErrorBoundaryProps, ShapeErrorBoundaryState> {
  override state: ShapeErrorBoundaryState = { error: null, failedFor: null };

  static getDerivedStateFromError(error: Error): Partial<ShapeErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error) {
    this.setState({ failedFor: this.props.node });
    this.props.onError({
      nodeId: this.props.node.id,
      nodeType: this.props.node.type,
      message: error.message,
    });
  }

  override componentDidUpdate() {
    // Retry when the node (or its properties) changed since the failure.
    if (this.state.error && this.state.failedFor && this.state.failedFor !== this.props.node) {
      this.setState({ error: null, failedFor: null });
    }
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const { node } = this.props;
    return (
      <g data-shape-error>
        <rect
          width={node.width}
          height={node.height}
          rx={8}
          fill="var(--bpmnr-canvas-bg, #faf9f6)"
          stroke="var(--bpmnr-danger, #b3372f)"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
        <text
          x={node.width / 2}
          y={node.height / 2 - 2}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill="var(--bpmnr-danger, #b3372f)"
          pointerEvents="none"
        >
          !
        </text>
        <text
          x={node.width / 2}
          y={node.height / 2 + 12}
          textAnchor="middle"
          fontSize={9}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="var(--bpmnr-text-muted, #6f675a)"
          pointerEvents="none"
        >
          {node.type}
        </text>
      </g>
    );
  }
}
