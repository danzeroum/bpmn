import { describe, expect, it } from 'vitest';
import { formExpressionEvaluator, validateSubmission, type FormSchema } from '../src/index.js';
// corpus pelo subpath público `@buildtovalue/forms/corpus` (aqui via a fonte).
import { SFEEL_FORM_CORPUS } from '../src/conformance.js';

/**
 * Avaliador CANÔNICO (etapa AG-2.1): a MESMA função consumida pelo preview do
 * cliente e pela validação do servidor. Dirigido pelo CORPUS COMPARTILHADO
 * (SFEEL_FORM_CORPUS) — o mesmo artefato que o teste de equivalência da
 * plataforma roda contra as cópias transitórias, garantindo que a canônica
 * não diverge das duas que vai substituir.
 */
const ev = formExpressionEvaluator;

describe('formExpressionEvaluator — corpus compartilhado (SFEEL_FORM_CORPUS)', () => {
  for (const c of SFEEL_FORM_CORPUS) {
    it(`${c.expr || '(vazia)'} @ ${JSON.stringify(c.ctx)}`, () => {
      const r = ev.evaluate(c.expr, c.ctx);
      if ('error' in c.expect) {
        expect('error' in r).toBe(true);
      } else {
        expect(r).toEqual({ value: c.expect.value });
      }
    });
  }

  it('o corpus exercita a grade rica (ordem + and/or) e os erros', () => {
    expect(SFEEL_FORM_CORPUS.some((c) => />|<|>=|<=/.test(c.expr))).toBe(true);
    expect(SFEEL_FORM_CORPUS.some((c) => /\band\b|\bor\b/.test(c.expr))).toBe(true);
    expect(SFEEL_FORM_CORPUS.some((c) => 'error' in c.expect)).toBe(true);
  });
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
