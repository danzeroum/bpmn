import { describe, expect, it } from 'vitest';
import {
  applyDefaults,
  validateFormSchema,
  validateSubmission,
  type ExpressionEvaluator,
  type FormSchema,
} from '../src/index.js';

/** Avaliador fake determinístico para os testes (o real é S-FEEL injetado). */
const evaluator: ExpressionEvaluator = {
  evaluate(expression, context) {
    switch (expression) {
      case 'value > 0':
        return { value: typeof context.value === 'number' && context.value > 0 };
      case 'tipo = "pj"':
        return { value: context.tipo === 'pj' };
      case 'quebrada(':
        return { error: 'parse error' };
      default:
        return { value: true };
    }
  },
};

const schema = (): FormSchema => ({
  formId: 'aprovacao-compra',
  version: 1,
  title: 'Aprovação de compra',
  fields: [
    { key: 'tipo', type: 'radio', label: 'Tipo', dataClassification: 'internal', required: true,
      options: [{ value: 'pf', label: 'PF' }, { value: 'pj', label: 'PJ' }] },
    { key: 'cnpj', type: 'text', label: 'CNPJ', dataClassification: 'personal',
      required: true, visibleWhen: 'tipo = "pj"', maxLength: 18 },
    { key: 'valor', type: 'number', label: 'Valor', dataClassification: 'internal',
      required: true, validation: 'value > 0', validationMessage: 'valor deve ser positivo' },
    { key: 'salario', type: 'number', label: 'Salário', dataClassification: 'sensitive' },
    { key: 'aceite', type: 'checkbox', label: 'Aceito', dataClassification: 'public',
      defaultValue: false },
  ],
});

describe('validateFormSchema — formato definitivo (D3)', () => {
  it('schema válido passa limpo', () => {
    expect(validateFormSchema(schema())).toEqual([]);
  });

  it('`value` é palavra RESERVADA como key (ADENDO-01 §4.2)', () => {
    const bad = schema();
    bad.fields.push({ key: 'value', type: 'text', label: 'X', dataClassification: 'public' });
    const issues = validateFormSchema(bad);
    expect(issues.some((i) => i.code === 'FIELD_KEY_RESERVED' && i.fieldKey === 'value')).toBe(true);
  });

  it('dataClassification é obrigatória', () => {
    const bad = schema();
    // @ts-expect-error — simulando JSON externo sem classificação
    delete bad.fields[0].dataClassification;
    expect(validateFormSchema(bad).some((i) => i.code === 'FIELD_CLASSIFICATION')).toBe(true);
  });

  it('keys duplicadas, options vazias e default incompatível são acusados', () => {
    const bad = schema();
    bad.fields.push({ key: 'tipo', type: 'text', label: 'dup', dataClassification: 'public' });
    bad.fields.push({ key: 'uf', type: 'select', label: 'UF', dataClassification: 'public', options: [] });
    // default incompatível como chegaria de JSON externo (sem tipagem)
    bad.fields.push({ key: 'idade', type: 'number', label: 'Idade', dataClassification: 'public',
      defaultValue: 'dezoito' } as unknown as (typeof bad.fields)[number]);
    const codes = validateFormSchema(bad).map((i) => i.code);
    expect(codes).toContain('FIELD_KEY_DUPLICATE');
    expect(codes).toContain('FIELD_OPTIONS_EMPTY');
    expect(codes).toContain('FIELD_DEFAULT_TYPE');
  });

  it('default de select precisa ser uma option', () => {
    const bad = schema();
    bad.fields.push({ key: 'uf', type: 'select', label: 'UF', dataClassification: 'public',
      options: [{ value: 'sp', label: 'SP' }], defaultValue: 'rj' });
    expect(validateFormSchema(bad).some((i) => i.code === 'FIELD_DEFAULT_NOT_OPTION')).toBe(true);
  });
});

describe('validateSubmission — mesma função no cliente e no servidor (F3.4)', () => {
  it('submissão válida normaliza e aceita', () => {
    const result = validateSubmission(
      schema(),
      { tipo: 'pj', cnpj: '12.345.678/0001-00', valor: 150, aceite: true },
      evaluator,
    );
    expect(result).toEqual({
      ok: true,
      values: { tipo: 'pj', cnpj: '12.345.678/0001-00', valor: 150, aceite: true },
    });
  });

  it('visibleWhen false: campo oculto é IGNORADO e nunca exigido', () => {
    const result = validateSubmission(schema(), { tipo: 'pf', valor: 10 }, evaluator);
    expect(result.ok).toBe(true);
    if (result.ok) expect('cnpj' in result.values).toBe(false);
    // mesmo que o cliente mande cnpj com tipo=pf, ele NÃO persiste
    const sneaky = validateSubmission(schema(), { tipo: 'pf', valor: 10, cnpj: 'x' }, evaluator);
    expect(sneaky.ok).toBe(true);
    if (sneaky.ok) expect('cnpj' in sneaky.values).toBe(false);
  });

  it('required visível ausente, tipo errado e validation reprovada acusam por campo', () => {
    const result = validateSubmission(
      schema(),
      { tipo: 'pj', valor: -5, salario: 'muito' },
      evaluator,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.cnpj).toContain('campo obrigatório');
      expect(result.errors.valor).toContain('valor deve ser positivo');
      expect(result.errors.salario).toContain('esperado número');
    }
  });

  it('chave fora do schema é rejeitada (nunca persiste dado desconhecido)', () => {
    const result = validateSubmission(schema(), { tipo: 'pf', valor: 1, hack: true }, evaluator);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors._form[0]).toContain('hack');
  });

  it('expressão inválida é erro DECLARADO, nunca aprovação silenciosa', () => {
    const s = schema();
    s.fields[2].validation = 'quebrada(';
    const result = validateSubmission(s, { tipo: 'pf', valor: 3 }, evaluator);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.valor[0]).toContain('parse error');
  });

  it('expressões sem avaliador injetado = erro de configuração do host', () => {
    const result = validateSubmission(schema(), { tipo: 'pf', valor: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors._form[0]).toContain('avaliador');
  });

  it('option inválida em radio/select é recusada', () => {
    const result = validateSubmission(schema(), { tipo: 'px', valor: 1 }, evaluator);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.tipo).toContain('opção inválida');
  });
});

describe('applyDefaults', () => {
  it('preenche ausentes sem sobrescrever fornecidos', () => {
    expect(applyDefaults(schema(), { valor: 9 })).toEqual({ valor: 9, aceite: false });
  });
});
