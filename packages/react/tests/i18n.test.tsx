import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EN, I18nProvider, PT_BR, mergeMessages, translate, useT, type Messages } from '../src/index.js';

/**
 * Handoff 11 N-6 — i18n engine: English is the complete embedded fallback, the
 * host injects a dictionary by prop (no auto locale detection), interpolation is
 * a single `{token}` pass, and plurals use explicit `_one` / `_other` siblings.
 */
describe('translate() — fallback', () => {
  it('a key missing from the injected dictionary falls back to English, per key', () => {
    const partial: Messages = { 'toolbar.undo': 'Desfazer' };
    // Present in the injected dict → injected value.
    expect(translate(partial, EN, 'toolbar.undo')).toBe('Desfazer');
    // Absent from the injected dict → English fallback (never a raw key).
    expect(translate(partial, EN, 'toolbar.redo')).toBe(EN['toolbar.redo']);
    expect(translate(partial, EN, 'toolbar.redo')).toBe('Redo');
  });

  it('a key absent from BOTH dictionaries resolves to the key itself (dev signal)', () => {
    expect(translate({}, EN, 'does.not.exist')).toBe('does.not.exist');
  });
});

describe('translate() — interpolation', () => {
  it('replaces {token} from params and leaves unknown tokens verbatim', () => {
    const dict: Messages = { greet: 'Hello {name}, you have {n} left', keep: 'A {missing} token' };
    expect(translate(dict, dict, 'greet', { name: 'Ada', n: 3 })).toBe('Hello Ada, you have 3 left');
    expect(translate(dict, dict, 'keep', {})).toBe('A {missing} token');
  });
});

describe('translate() — plural via _one/_other', () => {
  const dict: Messages = {
    'items_one': '{count} item',
    'items_other': '{count} items',
  };
  it('count === 1 selects _one; any other count selects _other', () => {
    expect(translate(dict, dict, 'items', { count: 1 })).toBe('1 item');
    expect(translate(dict, dict, 'items', { count: 5 })).toBe('5 items');
    expect(translate(dict, dict, 'items', { count: 0 })).toBe('0 items');
  });
  it('the caller passes the base key; the engine picks the sibling', () => {
    // No bare `items` key exists — resolution must go through the plural sibling.
    expect('items' in dict).toBe(false);
    expect(translate(dict, dict, 'items', { count: 2 })).toBe('2 items');
  });
});

describe('mergeMessages', () => {
  it('later dictionaries win, missing keys still fall back at lookup time', () => {
    const merged = mergeMessages({ a: '1', b: '2' }, { b: '3' });
    expect(merged).toEqual({ a: '1', b: '3' });
  });
});

describe('useT / I18nProvider — prop injection', () => {
  function Probe() {
    const t = useT();
    return <span data-testid="probe">{t('toolbar.undo')}</span>;
  }

  it('no provider → English default', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('probe').textContent).toBe('Undo');
  });

  it('injected PT_BR dictionary switches the rendered string', () => {
    const { getByTestId } = render(
      <I18nProvider messages={PT_BR}>
        <Probe />
      </I18nProvider>,
    );
    expect(getByTestId('probe').textContent).toBe('Desfazer');
  });

  it('PT_BR is a real second dictionary — it covers the same keys as EN', () => {
    // The official pt-BR dictionary must not silently lag: every EN key has a
    // pt-BR string (fallback still protects partial host dictionaries).
    const missing = Object.keys(EN).filter((key) => !(key in PT_BR));
    expect(missing).toEqual([]);
  });
});
