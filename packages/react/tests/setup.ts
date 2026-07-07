import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom does not implement `PointerEvent` (`window.PointerEvent` is
 * `undefined`), so `fireEvent.pointerDown/Move/Up(el, { clientX, clientY })`
 * silently falls back to a plain `Event` that carries no coordinates —
 * every gesture test that depends on real clientX/clientY (drag, resize,
 * connect) would otherwise see `undefined` and compute `NaN`. `MouseEvent`
 * *is* implemented and already supports clientX/clientY, so we extend it
 * with the extra Pointer Events fields our code touches
 * (`pointerId`, `setPointerCapture`/friends are stubbed separately below).
 */
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public readonly pointerId: number;
    public readonly pointerType: string;
    public readonly isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfilling a DOM global jsdom doesn't implement.
  window.PointerEvent = PointerEventPolyfill;
}

if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = function (): void {};
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = function (): void {};
}
if (typeof Element.prototype.hasPointerCapture !== 'function') {
  Element.prototype.hasPointerCapture = function (): boolean {
    return false;
  };
}

afterEach(() => cleanup());
