import { useState } from 'react';
import {
  validateSubmission,
  type ExpressionEvaluator,
  type FormSchema,
} from '@buildtovalue/forms';
import { FormRenderer } from './FormRenderer.js';

/**
 * Stories do renderer (F0b.6: Storybook desde o primeiro componente).
 * Formato CSF3 — compatível com Storybook 8/9 react-vite. Enquanto o shell
 * do Storybook não entra no monorepo (pendências §2.5 da plataforma), estas
 * stories são executáveis por qualquer host CSF e servem de documentação
 * viva do contrato.
 */
const evaluator: ExpressionEvaluator = {
  evaluate: (expression, context) =>
    expression === 'tipo = "pj"' ? { value: context.tipo === 'pj' } : { value: true },
};

const schema: FormSchema = {
  formId: 'aprovacao-compra',
  version: 1,
  title: 'Aprovação de compra',
  fields: [
    { key: 'tipo', type: 'radio', label: 'Tipo de fornecedor', dataClassification: 'internal',
      required: true,
      options: [{ value: 'pf', label: 'Pessoa física' }, { value: 'pj', label: 'Pessoa jurídica' }] },
    { key: 'cnpj', type: 'text', label: 'CNPJ', dataClassification: 'personal',
      required: true, visibleWhen: 'tipo = "pj"', maxLength: 18 },
    { key: 'valor', type: 'number', label: 'Valor (R$)', dataClassification: 'internal',
      required: true, min: 0 },
    { key: 'salario', type: 'number', label: 'Salário do aprovador', dataClassification: 'sensitive',
      helpText: 'Cifrado no servidor; mascarado por padrão; não buscável.' },
    { key: 'inicio', type: 'date', label: 'Início do contrato', dataClassification: 'internal' },
    { key: 'justificativa', type: 'textarea', label: 'Justificativa', dataClassification: 'internal',
      maxLength: 500 },
    { key: 'aceite', type: 'checkbox', label: 'Li e aceito a política de compras',
      dataClassification: 'public', required: true },
  ],
};

export default {
  title: 'Forms/FormRenderer',
  component: FormRenderer,
};

function PreenchimentoDemo() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <FormRenderer
      schema={schema}
      values={values}
      evaluator={evaluator}
      onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
    />
  );
}

export const Preenchimento = {
  render: () => <PreenchimentoDemo />,
};

export const ComErrosDeSubmissao = {
  render: () => {
    const values = { tipo: 'pj', valor: -10 };
    const result = validateSubmission(schema, values, evaluator);
    return (
      <FormRenderer
        schema={schema}
        values={values}
        evaluator={evaluator}
        onChange={() => {}}
        errors={result.ok ? {} : result.errors}
      />
    );
  },
};

export const SomenteLeitura = {
  render: () => (
    <FormRenderer
      schema={schema}
      values={{ tipo: 'pj', cnpj: '12.345.678/0001-00', valor: 1500 }}
      evaluator={evaluator}
      onChange={() => {}}
      disabled
    />
  ),
};
