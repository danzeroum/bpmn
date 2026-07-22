import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ExpressionEvaluator, FormSchema } from '@buildtovalue/forms';
import { FormRenderer } from '../src/index.js';

const evaluator: ExpressionEvaluator = {
  evaluate: (expression, context) =>
    expression === 'tipo = "pj"' ? { value: context.tipo === 'pj' } : { value: true },
};

const schema: FormSchema = {
  formId: 'demo',
  version: 1,
  title: 'Demo',
  fields: [
    { key: 'tipo', type: 'radio', label: 'Tipo', dataClassification: 'internal', required: true,
      options: [{ value: 'pf', label: 'Pessoa física' }, { value: 'pj', label: 'Pessoa jurídica' }] },
    { key: 'cnpj', type: 'text', label: 'CNPJ', dataClassification: 'personal',
      visibleWhen: 'tipo = "pj"' },
    { key: 'valor', type: 'number', label: 'Valor', dataClassification: 'internal', required: true },
    { key: 'salario', type: 'number', label: 'Salário', dataClassification: 'sensitive' },
    { key: 'aceite', type: 'checkbox', label: 'Aceito os termos', dataClassification: 'public' },
  ],
};

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  return (
    <FormRenderer
      schema={schema}
      values={values}
      evaluator={evaluator}
      onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
    />
  );
}

describe('FormRenderer — renderer puro controlado', () => {
  it('renderiza campos com label ligada e obrigatório marcado', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Valor/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Demo' })).toBeInTheDocument();
  });

  it('visibleWhen esconde e mostra conforme o avaliador (igual ao servidor)', () => {
    render(<Harness />);
    expect(screen.queryByLabelText(/CNPJ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Pessoa jurídica'));
    expect(screen.getByLabelText(/CNPJ/)).toBeInTheDocument();
  });

  it('onChange entrega valores TIPADOS (number, boolean)', () => {
    const changes: Array<[string, unknown]> = [];
    render(
      <FormRenderer
        schema={schema}
        values={{}}
        evaluator={evaluator}
        onChange={(k, v) => changes.push([k, v])}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Valor/), { target: { value: '150' } });
    fireEvent.click(screen.getByLabelText(/Aceito os termos/));
    expect(changes).toContainEqual(['valor', 150]);
    expect(changes).toContainEqual(['aceite', true]);
  });

  it('classificação personal/sensitive ganha tag visível (cor + RÓTULO)', () => {
    render(<Harness initial={{ tipo: 'pj' }} />);
    expect(screen.getByText('PESSOAL')).toBeInTheDocument();
    expect(screen.getByText('SENSÍVEL')).toBeInTheDocument();
  });

  it('erros aparecem com role=alert e aria-invalid no campo', () => {
    render(
      <FormRenderer
        schema={schema}
        values={{}}
        evaluator={evaluator}
        onChange={() => {}}
        errors={{ valor: ['campo obrigatório'] }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('campo obrigatório');
    expect(screen.getByLabelText(/Valor/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('disabled desabilita todos os controles', () => {
    render(
      <FormRenderer schema={schema} values={{}} evaluator={evaluator} onChange={() => {}} disabled />,
    );
    expect(screen.getByLabelText(/Valor/)).toBeDisabled();
    expect(screen.getByLabelText('Pessoa física')).toBeDisabled();
  });
});
