import { describe, expect, it } from 'vitest';
import { formExpressionEvaluator, validateSubmission, type FormSchema } from '../src/index.js';

/**
 * Avaliador CANÔNICO (etapa AG-2.1): a MESMA função consumida pelo preview do
 * cliente e pela validação do servidor. Este corpus é o contrato de comportamento
 * — se o servidor e o cliente importam `formExpressionEvaluator`, a equivalência
 * "toda expressão aceita pelo preview é aceita pelo servidor e vice-versa" é por
 * CONSTRUÇÃO. Cobre a grade rica que antes divergia (comparações + and/or).
 */
const ev = formExpressionEvaluator;

describe('formExpressionEvaluator — corpus canônico', () => {
  const cases: Array<{ expr: string; ctx: Record<string, unknown>; expect: boolean | 'error' }> = [
    // igualdade (o que o servidor já fazia)
    { expr: 'value = "aprovar"', ctx: { value: 'aprovar' }, expect: true },
    { expr: 'value = "aprovar"', ctx: { value: 'reprovar' }, expect: false },
    { expr: 'tipo = "pj"', ctx: { tipo: 'pj' }, expect: true },
    { expr: 'ativo = true', ctx: { ativo: true }, expect: true },
    { expr: 'n = 3', ctx: { n: 3 }, expect: true },
    // desigualdade
    { expr: 'value != "x"', ctx: { value: 'y' }, expect: true },
    // comparações de ordem (o que o servidor RECUSAVA — a divergência)
    { expr: 'value > 5000', ctx: { value: 6000 }, expect: true },
    { expr: 'value > 5000', ctx: { value: 4000 }, expect: false },
    { expr: 'value <= 50000', ctx: { value: 50000 }, expect: true },
    { expr: 'value >= 10', ctx: { value: 9 }, expect: false },
    // ordem com operando não-numérico → falso (não-erro): honesto
    { expr: 'value > 5', ctx: { value: undefined }, expect: false },
    // conjunção / disjunção
    { expr: 'value > 0 and value <= 50000', ctx: { value: 25000 }, expect: true },
    { expr: 'value > 0 and value <= 50000', ctx: { value: 60000 }, expect: false },
    { expr: 'value = "a" or value = "b"', ctx: { value: 'b' }, expect: true },
    { expr: 'value = "a" or value = "b"', ctx: { value: 'c' }, expect: false },
    // erros DECLARADOS (nunca booleano silencioso)
    { expr: '', ctx: {}, expect: 'error' },
    { expr: 'value ~ 3', ctx: { value: 3 }, expect: 'error' },
    { expr: 'funcao(value)', ctx: { value: 1 }, expect: 'error' },
  ];

  for (const c of cases) {
    it(`${c.expr || '(vazia)'} @ ${JSON.stringify(c.ctx)} → ${c.expect}`, () => {
      const r = ev.evaluate(c.expr, c.ctx);
      if (c.expect === 'error') {
        expect('error' in r).toBe(true);
      } else {
        expect(r).toEqual({ value: c.expect });
      }
    });
  }
});

describe('validateSubmission usa o avaliador canônico por PADRÃO (sem injeção)', () => {
  const schema: FormSchema = {
    formId: 'reembolso',
    version: 1,
    title: 'Reembolso',
    fields: [
      { key: 'valor', type: 'number', label: 'Valor', dataClassification: 'internal', required: true, validation: 'value > 0 and value <= 50000', validationMessage: 'fora da faixa' },
      { key: 'justificativa', type: 'textarea', label: 'Justificativa', dataClassification: 'internal', visibleWhen: 'valor > 10000' },
    ],
  } as unknown as FormSchema;

  it('validation rica (comparação + and) passa SEM avaliador injetado', () => {
    const ok = validateSubmission(schema, { valor: 25000 });
    expect(ok.ok).toBe(true);
  });

  it('validation rica reprova fora da faixa, por padrão', () => {
    const bad = validateSubmission(schema, { valor: 60000 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.valor?.[0]).toBe('fora da faixa');
  });

  it('visibleWhen com comparação: campo oculto é ignorado (não exigido)', () => {
    // valor <= 10000 → justificativa oculta → não exigida mesmo ausente
    const ok = validateSubmission(schema, { valor: 5000 });
    expect(ok.ok).toBe(true);
  });
});
