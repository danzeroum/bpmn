import {
  DATA_CLASSIFICATIONS,
  RESERVED_FIELD_KEY,
  type FormField,
  type FormSchema,
} from './types.js';

/** Problema estrutural do SCHEMA (autoria) — não confundir com erro de submissão. */
export interface SchemaIssue {
  code:
    | 'SCHEMA_FORM_ID'
    | 'SCHEMA_VERSION'
    | 'SCHEMA_TITLE'
    | 'SCHEMA_NO_FIELDS'
    | 'FIELD_KEY_INVALID'
    | 'FIELD_KEY_RESERVED'
    | 'FIELD_KEY_DUPLICATE'
    | 'FIELD_LABEL'
    | 'FIELD_CLASSIFICATION'
    | 'FIELD_OPTIONS_EMPTY'
    | 'FIELD_OPTIONS_DUPLICATE'
    | 'FIELD_DEFAULT_TYPE'
    | 'FIELD_DEFAULT_NOT_OPTION'
    | 'FIELD_EXPRESSION_EMPTY';
  message: string;
  /** key do campo (ausente em problemas do schema como um todo). */
  fieldKey?: string;
}

const KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox']);

/**
 * Valida a ESTRUTURA de um schema (total — nunca lança): identidade, chaves
 * (`value` reservada — ADENDO-01 §4.2), classificação LGPD obrigatória,
 * options e compatibilidade do defaultValue. O editor da F3 e o deploy no
 * registry consomem a MESMA função.
 */
export function validateFormSchema(schema: FormSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (typeof schema.formId !== 'string' || !KEY_PATTERN.test(schema.formId.replace(/-/g, '_'))) {
    issues.push({ code: 'SCHEMA_FORM_ID', message: `formId inválido: ${JSON.stringify(schema.formId)}` });
  }
  if (!Number.isInteger(schema.version) || schema.version < 1) {
    issues.push({ code: 'SCHEMA_VERSION', message: `version deve ser inteiro >= 1 (recebido ${schema.version})` });
  }
  if (typeof schema.title !== 'string' || schema.title.trim() === '') {
    issues.push({ code: 'SCHEMA_TITLE', message: 'title é obrigatório' });
  }
  if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
    issues.push({ code: 'SCHEMA_NO_FIELDS', message: 'o formulário precisa de pelo menos 1 campo' });
    return issues;
  }

  const seen = new Set<string>();
  for (const field of schema.fields) {
    const key = field.key;
    if (typeof key !== 'string' || !KEY_PATTERN.test(key) || !FIELD_TYPES.has(field.type)) {
      issues.push({
        code: 'FIELD_KEY_INVALID',
        message: `campo com key/type inválidos: ${JSON.stringify(key)} (${String(field.type)})`,
        fieldKey: typeof key === 'string' ? key : undefined,
      });
      continue;
    }
    if (key === RESERVED_FIELD_KEY) {
      issues.push({
        code: 'FIELD_KEY_RESERVED',
        message: `"${RESERVED_FIELD_KEY}" é palavra reservada da convenção de expressões — escolha outra key`,
        fieldKey: key,
      });
    }
    if (seen.has(key)) {
      issues.push({ code: 'FIELD_KEY_DUPLICATE', message: `key duplicada: ${key}`, fieldKey: key });
    }
    seen.add(key);
    if (typeof field.label !== 'string' || field.label.trim() === '') {
      issues.push({ code: 'FIELD_LABEL', message: `campo ${key} sem label`, fieldKey: key });
    }
    if (!DATA_CLASSIFICATIONS.includes(field.dataClassification)) {
      issues.push({
        code: 'FIELD_CLASSIFICATION',
        message: `campo ${key}: dataClassification é OBRIGATÓRIA (public|internal|personal|sensitive)`,
        fieldKey: key,
      });
    }
    for (const expr of ['validation', 'visibleWhen'] as const) {
      if (field[expr] !== undefined && (typeof field[expr] !== 'string' || field[expr].trim() === '')) {
        issues.push({ code: 'FIELD_EXPRESSION_EMPTY', message: `campo ${key}: ${expr} vazio`, fieldKey: key });
      }
    }
    issues.push(...validateOptionsAndDefault(field));
  }
  return issues;
}

function validateOptionsAndDefault(field: FormField): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const key = field.key;
  if (field.type === 'select' || field.type === 'radio') {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      issues.push({ code: 'FIELD_OPTIONS_EMPTY', message: `campo ${key}: options vazio`, fieldKey: key });
      return issues;
    }
    const values = field.options.map((o) => o.value);
    if (new Set(values).size !== values.length) {
      issues.push({ code: 'FIELD_OPTIONS_DUPLICATE', message: `campo ${key}: options com value duplicado`, fieldKey: key });
    }
    if (field.defaultValue !== undefined && !values.includes(field.defaultValue)) {
      issues.push({
        code: 'FIELD_DEFAULT_NOT_OPTION',
        message: `campo ${key}: defaultValue "${field.defaultValue}" não é uma option`,
        fieldKey: key,
      });
    }
    return issues;
  }
  if (field.defaultValue === undefined) return issues;
  const bad = (expected: string) =>
    issues.push({
      code: 'FIELD_DEFAULT_TYPE',
      message: `campo ${key}: defaultValue deve ser ${expected}`,
      fieldKey: key,
    });
  if (field.type === 'number' && typeof field.defaultValue !== 'number') bad('number');
  if ((field.type === 'text' || field.type === 'textarea') && typeof field.defaultValue !== 'string') bad('string');
  if (field.type === 'checkbox' && typeof field.defaultValue !== 'boolean') bad('boolean');
  if (field.type === 'date' && (typeof field.defaultValue !== 'string' || !DATE_PATTERN.test(field.defaultValue))) {
    bad('data ISO YYYY-MM-DD');
  }
  return issues;
}
