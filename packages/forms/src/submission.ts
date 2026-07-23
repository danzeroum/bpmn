import { formExpressionEvaluator } from './evaluator.js';
import type { ExpressionEvaluator, FormField, FormSchema } from './types.js';

/** Erro de SUBMISSÃO, por campo (chave `_form` para problemas gerais). */
export type SubmissionErrors = Record<string, string[]>;

export type SubmissionResult =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: SubmissionErrors };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addError(errors: SubmissionErrors, key: string, message: string): void {
  (errors[key] ??= []).push(message);
}

/** Aplica defaultValue aos campos ausentes (pré-preenchimento do renderer). */
export function applyDefaults(
  schema: FormSchema,
  values: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const field of schema.fields) {
    if (out[field.key] === undefined && field.defaultValue !== undefined) {
      out[field.key] = field.defaultValue;
    }
  }
  return out;
}

/**
 * Valida uma submissão contra o schema — a MESMA função no cliente e no
 * SERVIDOR (F3.4: submissão validada no servidor com o mesmo schema).
 *
 * Regras:
 * - chave desconhecida → rejeitada (nunca persiste dado fora do schema);
 * - `visibleWhen` false → campo IGNORADO (removido dos values), nunca exigido;
 * - `required` só vale para campo visível;
 * - tipo por campo (number finito, checkbox boolean, date ISO, option válida);
 * - `validation` avaliada com contexto `{ ...todosOsCampos, value: esteCampo }`
 *   (convenção ADENDO-01 §4); expressão inválida é erro DECLARADO, nunca pass.
 * - o avaliador é o `formExpressionEvaluator` CANÔNICO por padrão (cliente e
 *   servidor idênticos); `evaluator` só é injetado em testes/casos especiais.
 */
export function validateSubmission(
  schema: FormSchema,
  values: Readonly<Record<string, unknown>>,
  evaluator: ExpressionEvaluator = formExpressionEvaluator,
): SubmissionResult {
  const errors: SubmissionErrors = {};
  const known = new Map(schema.fields.map((f) => [f.key, f]));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) addError(errors, '_form', `campo desconhecido: ${key}`);
  }

  const accepted: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const raw = values[field.key];
    if (field.visibleWhen) {
      const visible = evaluator.evaluate(field.visibleWhen, { ...values, value: raw });
      if ('error' in visible) {
        addError(errors, field.key, `visibleWhen inválida: ${visible.error}`);
        continue;
      }
      if (!visible.value) continue; // oculto: ignorado, nunca exigido/persistido
    }
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) addError(errors, field.key, 'campo obrigatório');
      continue;
    }
    if (!checkType(field, raw, errors)) continue;
    if (field.validation) {
      const outcome = evaluator.evaluate(field.validation, { ...values, value: raw });
      if ('error' in outcome) {
        addError(errors, field.key, `validation inválida: ${outcome.error}`);
        continue;
      }
      if (!outcome.value) {
        addError(errors, field.key, field.validationMessage ?? 'valor não atende à validação');
        continue;
      }
    }
    accepted[field.key] = raw;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values: accepted };
}

function checkType(field: FormField, raw: unknown, errors: SubmissionErrors): boolean {
  const fail = (message: string): false => {
    addError(errors, field.key, message);
    return false;
  };
  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') return fail('esperado texto');
      if (field.maxLength !== undefined && raw.length > field.maxLength) {
        return fail(`máximo de ${field.maxLength} caracteres`);
      }
      return true;
    }
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return fail('esperado número');
      if (field.min !== undefined && raw < field.min) return fail(`mínimo ${field.min}`);
      if (field.max !== undefined && raw > field.max) return fail(`máximo ${field.max}`);
      return true;
    }
    case 'date': {
      if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
        return fail('esperada data ISO YYYY-MM-DD');
      }
      return true;
    }
    case 'select':
    case 'radio': {
      if (typeof raw !== 'string' || !field.options.some((o) => o.value === raw)) {
        return fail('opção inválida');
      }
      return true;
    }
    case 'checkbox': {
      if (typeof raw !== 'boolean') return fail('esperado booleano');
      return true;
    }
  }
}
