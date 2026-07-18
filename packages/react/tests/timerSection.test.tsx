import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createNode, parseTimerExpression, type BpmnDiagram } from '@buildtovalue/core';
import {
  BpmnDesigner,
  BpmnEditor,
  formatTimerPreview,
  TimerSection,
  PT_BR,
  translate,
  EN,
} from '../src/index.js';

/**
 * Handoff 16 E-5 — editor de timer (§3d, critério 6) + reforço 10 (preview
 * AUSENTE quando a expressão é inválida — só o aviso glifo+texto).
 */
function timerDiagram(timer?: { kind: string; expression: string }): BpmnDiagram {
  const diagram = createDiagram({ name: 'Timer', id: 'tm' });
  diagram.nodes = {
    t: createNode({
      id: 't',
      type: 'intermediateCatchEvent',
      label: 'Esperar',
      x: 60,
      y: 60,
      properties: { eventDefinition: 'timer', ...(timer ? { timer } : {}) },
    }),
  };
  return diagram;
}

const select = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

const undo = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
const tPt = (key: string, params?: Record<string, string | number>) =>
  translate(PT_BR, EN, key, params);

describe('TimerSection (E-5 critério 6)', () => {
  it('PEGADINHA no preview humano: P1M → "1 mês", PT1M → "1 minuto" (via resultado estruturado)', () => {
    expect(formatTimerPreview(parseTimerExpression('duration', 'P1M'), tPt)).toBe('em 1 mês');
    expect(formatTimerPreview(parseTimerExpression('duration', 'PT1M'), tPt)).toBe('em 1 minuto');
    expect(formatTimerPreview(parseTimerExpression('duration', 'P2DT3H30M'), tPt)).toBe(
      'em 2 dias, 3 horas e 30 minutos',
    );
    expect(formatTimerPreview(parseTimerExpression('cycle', 'R3/PT10M'), tPt)).toBe(
      '3× a cada 10 minutos',
    );
    expect(formatTimerPreview(parseTimerExpression('cycle', 'R/P1D'), tPt)).toBe('a cada 1 dia');
    expect(
      formatTimerPreview(parseTimerExpression('cycle', 'R2/2026-01-01T00:00:00Z/P1D'), tPt),
    ).toBe('2× a cada 1 dia, a partir de 2026-01-01T00:00:00Z');
  });

  it('edição commita UM comando undoável; expressão vazia REMOVE a prop (modelo limpo)', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={timerDiagram()}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    select(container, 't');
    const input = () => screen.getByTestId('timer-expression') as HTMLInputElement;
    fireEvent.change(input(), { target: { value: 'PT15M' } });
    fireEvent.blur(input());
    expect(latest!.nodes.t.properties.timer).toEqual({ kind: 'duration', expression: 'PT15M' });
    expect(screen.getByTestId('timer-preview').textContent).toBe('em 15 minutos');
    // 1 undo remove a prop inteira.
    undo();
    expect('timer' in latest!.nodes.t.properties).toBe(false);
    // Vazio explícito também limpa (campo ausente = bytes de antes).
    fireEvent.change(input(), { target: { value: 'PT5M' } });
    fireEvent.blur(input());
    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.blur(input());
    expect('timer' in latest!.nodes.t.properties).toBe(false);
  });

  it('reforço 10 — expressão inválida: SÓ o aviso glifo+texto, preview AUSENTE (nunca palpite)', () => {
    const { container } = render(
      <BpmnEditor diagram={timerDiagram({ kind: 'duration', expression: 'P1H' })} messages={PT_BR} />,
    );
    select(container, 't');
    const invalid = screen.getByTestId('timer-invalid');
    expect(invalid.textContent).toContain('⚠');
    expect(invalid.textContent).toContain('Expressão inválida para este tipo de timer.');
    expect(screen.queryByTestId('timer-preview')).toBeNull();
    // Trocar o TIPO para um em que a expressão é válida limpa o aviso.
    fireEvent.change(screen.getByTestId('timer-kind'), { target: { value: 'cycle' } });
    // P1H segue inválida como ciclo — o aviso permanece honesto.
    expect(screen.queryByTestId('timer-preview')).toBeNull();
  });

  it('kind select persiste no modelo e o preview segue o kind', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={timerDiagram({ kind: 'duration', expression: 'PT10M' })}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    select(container, 't');
    expect(screen.getByTestId('timer-preview').textContent).toBe('em 10 minutos');
    fireEvent.change(screen.getByTestId('timer-kind'), { target: { value: 'date' } });
    expect(latest!.nodes.t.properties.timer).toEqual({ kind: 'date', expression: 'PT10M' });
    // PT10M não é dateTime → aviso, sem preview (reforço 10 de novo).
    expect(screen.queryByTestId('timer-preview')).toBeNull();
    expect(screen.getByTestId('timer-invalid')).toBeDefined();
  });

  it('read-only desabilita os campos; nó não-timer não mostra a seção', () => {
    // Harness da E-2: seleção por ponteiro é inerte em readOnly, então a
    // seção renderiza direto como filha do designer.
    const diagram = timerDiagram({ kind: 'duration', expression: 'PT1M' });
    const readOnlyRender = render(
      <BpmnDesigner diagram={diagram} messages={PT_BR} readOnly>
        <TimerSection node={diagram.nodes.t} readOnly />
      </BpmnDesigner>,
    );
    expect((screen.getByTestId('timer-expression') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('timer-kind') as HTMLSelectElement).disabled).toBe(true);
    readOnlyRender.unmount();
    // Nó message (não-timer) não ganha a seção; timer ganha.
    const messageDiagram = timerDiagram();
    messageDiagram.nodes.t = {
      ...messageDiagram.nodes.t,
      properties: { eventDefinition: 'message' },
    };
    const other = render(<BpmnEditor diagram={messageDiagram} messages={PT_BR} />);
    select(other.container, 't');
    expect(other.container.querySelector('[data-testid="timer-section"]')).toBeNull();
    other.unmount();
    const { container } = render(<BpmnEditor diagram={timerDiagram()} messages={PT_BR} />);
    select(container, 't');
    expect(container.querySelector('[data-testid="timer-section"]')).not.toBeNull();
  });
});
