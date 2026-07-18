import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDiagram,
  createNode,
  parseTimerExpression,
  timerPropertyOf,
  type BpmnDiagram,
} from '../src/index.js';

/**
 * Handoff 16 E-5 — parser ISO 8601 headless (§3d, critério 1) + prop
 * canônica `properties.timer` no converter (critério 2, emenda da E-0) +
 * reforço 10 (timer em nó NÃO-timer fica no soup bpmnr:, nunca filho OMG).
 */
describe('parseTimerExpression', () => {
  it('PEGADINHA VINCULANTE — P1M é 1 MÊS, PT1M é 1 MINUTO', () => {
    const month = parseTimerExpression('duration', 'P1M');
    expect(month).toEqual({
      valid: true,
      kind: 'duration',
      parts: { years: 0, months: 1, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
    });
    const minute = parseTimerExpression('duration', 'PT1M');
    expect(minute).toEqual({
      valid: true,
      kind: 'duration',
      parts: { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 1, seconds: 0 },
    });
  });

  it('duration: componentes combinados, frações de segundo, e os malformados clássicos', () => {
    const full = parseTimerExpression('duration', 'P1Y2M3DT4H5M6.5S');
    expect(full).toEqual({
      valid: true,
      kind: 'duration',
      parts: { years: 1, months: 2, weeks: 0, days: 3, hours: 4, minutes: 5, seconds: 6.5 },
    });
    for (const bad of ['P', 'PT', 'P1DT', '1M', 'P1H', 'PT1D', 'P1M2Y', 'p1m', 'P1,5D']) {
      expect(parseTimerExpression('duration', bad).valid, bad).toBe(false);
    }
  });

  it('date: dateTime ISO com offset; datas soltas e lixo são inválidos', () => {
    expect(parseTimerExpression('date', '2026-08-01T09:00:00Z')).toEqual({
      valid: true,
      kind: 'date',
      date: '2026-08-01T09:00:00Z',
    });
    expect(parseTimerExpression('date', '2026-08-01T09:00-03:00').valid).toBe(true);
    for (const bad of ['2026-08-01', '09:00', 'amanhã', '2026-13-01T09:00Z', '']) {
      expect(parseTimerExpression('date', bad).valid, bad).toBe(false);
    }
  });

  it('cycle: Rn/duração, R infinito e Rn/início/duração; malformados rejeitados', () => {
    expect(parseTimerExpression('cycle', 'R3/PT10M')).toEqual({
      valid: true,
      kind: 'cycle',
      repetitions: 3,
      parts: { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 10, seconds: 0 },
    });
    expect(parseTimerExpression('cycle', 'R/P1D')).toMatchObject({ valid: true, repetitions: null });
    expect(parseTimerExpression('cycle', 'R5/2026-01-01T00:00:00Z/P1D')).toMatchObject({
      valid: true,
      repetitions: 5,
      start: '2026-01-01T00:00:00Z',
    });
    for (const bad of ['R3', 'R3/', 'PT10M', 'R-1/PT10M', 'R3/foo/P1D', 'R3/P1D/P1D/P1D']) {
      expect(parseTimerExpression('cycle', bad).valid, bad).toBe(false);
    }
  });

  it('fuzzing: nenhuma entrada — por mais quebrada — lança exceção', () => {
    // LCG determinístico: reprodutível em CI, sem Math.random.
    let seed = 42;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const alphabet = 'PRT0123456789YMWDHS/:-.Z+é§ ';
    const kinds = ['date', 'duration', 'cycle'] as const;
    for (let i = 0; i < 500; i++) {
      const length = next() % 24;
      let input = '';
      for (let j = 0; j < length; j++) input += alphabet[next() % alphabet.length];
      const kind = kinds[next() % 3];
      const result = parseTimerExpression(kind, input);
      expect(typeof result.valid).toBe('boolean');
    }
  });
});

function timerDiagram(nodeProperties: Record<string, unknown>): BpmnDiagram {
  const diagram = createDiagram({ name: 'Timers', id: 'tm' });
  diagram.nodes = {
    t: createNode({
      id: 't',
      type: 'intermediateCatchEvent',
      label: 'Esperar',
      x: 40,
      y: 40,
      properties: nodeProperties,
    }),
  };
  return diagram;
}

describe('canonical timer in the converter (critério 2 + reforço 10)', () => {
  const converter = new BpmnXmlConverter();

  it('timer event exporta o filho OMG por kind e round-tripa byte-estável', () => {
    for (const [kind, tag, expression] of [
      ['duration', 'bpmn:timeDuration', 'PT15M'],
      ['date', 'bpmn:timeDate', '2026-08-01T09:00:00Z'],
      ['cycle', 'bpmn:timeCycle', 'R3/PT10M'],
    ] as const) {
      const diagram = timerDiagram({
        eventDefinition: 'timer',
        timer: { kind, expression },
      });
      const xml = converter.toXml(diagram);
      expect(xml).toContain(`<${tag}>${expression}</${tag}>`);
      expect(xml).not.toContain('bpmnr:property name="timer"');
      const reimported = converter.fromXml(xml).diagram;
      expect(timerPropertyOf(reimported.nodes.t)).toEqual({ kind, expression });
      expect(converter.toXml(reimported)).toBe(xml);
    }
  });

  it('reforço 10 — properties.timer em nó NÃO-timer fica no soup bpmnr:, nunca filho OMG órfão', () => {
    const diagram = timerDiagram({
      eventDefinition: 'message',
      timer: { kind: 'duration', expression: 'PT15M' },
    });
    const xml = converter.toXml(diagram);
    expect(xml).not.toContain('timeDate');
    expect(xml).not.toContain('timeDuration');
    expect(xml).not.toContain('timeCycle');
    expect(xml).toContain('bpmnr:property name="timer"');
    // Round-trip preserva a prop como qualquer outra do soup.
    const reimported = converter.fromXml(xml).diagram;
    expect(reimported.nodes.t.properties.timer).toEqual({ kind: 'duration', expression: 'PT15M' });
    expect(converter.toXml(reimported)).toBe(xml);
  });

  it('timerPropertyOf: só formas bem-tipadas contam', () => {
    expect(
      timerPropertyOf(timerDiagram({ timer: { kind: 'duration', expression: 'PT1M' } }).nodes.t),
    ).toEqual({ kind: 'duration', expression: 'PT1M' });
    for (const bad of [undefined, 'PT1M', { kind: 'weekly', expression: 'x' }, { kind: 'date' }]) {
      expect(timerPropertyOf(timerDiagram({ timer: bad }).nodes.t)).toBeUndefined();
    }
  });
});
