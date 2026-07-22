/**
 * Schema de formulário da plataforma BuildToValue (D3) — FORMATO DEFINITIVO
 * desde o início: este artefato é persistido e versionado no registry
 * (`formId@versão`); instância antiga exibe o formulário pinado. Extensões
 * entram por MINOR (campos novos opcionais); formato provisório persistido é
 * rejeitado (Anexo C.3).
 *
 * Convenção de expressões (ADENDO-01 §4, aceita):
 * - Em `validation`/`visibleWhen`, `value` refere-se AO PRÓPRIO campo;
 *   outras chaves referenciam outros campos pelo `key`.
 * - Por consequência, **`value` é palavra RESERVADA**: nunca pode ser `key`
 *   de campo (validado por {@link validateFormSchema} e pelo editor da F3).
 * - As expressões são S-FEEL; a avaliação é INJETADA (o pacote não importa
 *   `sfeel` — mesmo padrão do engine), então cliente e SERVIDOR validam a
 *   submissão com o MESMO schema e o mesmo avaliador (F3.4).
 */

/** Classificação LGPD OBRIGATÓRIA por campo (G-LGPD-3, D20). */
export type DataClassification = 'public' | 'internal' | 'personal' | 'sensitive';

export const DATA_CLASSIFICATIONS: readonly DataClassification[] = [
  'public',
  'internal',
  'personal',
  'sensitive',
];

/** Palavra reservada da convenção de expressões (ADENDO-01 §4.2). */
export const RESERVED_FIELD_KEY = 'value';

export interface FormFieldBase {
  /** Identificador do campo ([a-zA-Z_][a-zA-Z0-9_]*); NUNCA `value`. */
  key: string;
  label: string;
  /**
   * OBRIGATÓRIA (G-LGPD-3). `sensitive` implica no servidor (D20): cifrado
   * via KeyProvider, mascarado por padrão (inclusive na API), fora de
   * logs/exports e NÃO buscável por conteúdo.
   */
  dataClassification: DataClassification;
  required?: boolean;
  helpText?: string;
  /** S-FEEL booleana; `value` = este campo, outras chaves = outros campos. */
  validation?: string;
  /** Mensagem exibida quando `validation` reprova (default genérico se ausente). */
  validationMessage?: string;
  /** S-FEEL booleana; quando avalia false o campo fica oculto e é IGNORADO
   * na submissão (não entra nos values persistidos). */
  visibleWhen?: string;
}

export interface TextField extends FormFieldBase {
  type: 'text';
  maxLength?: number;
  defaultValue?: string;
}
export interface TextareaField extends FormFieldBase {
  type: 'textarea';
  maxLength?: number;
  defaultValue?: string;
}
export interface NumberField extends FormFieldBase {
  type: 'number';
  min?: number;
  max?: number;
  defaultValue?: number;
}
/** Data-calendário ISO `YYYY-MM-DD` (sem hora/fuso — decisão de formato). */
export interface DateField extends FormFieldBase {
  type: 'date';
  defaultValue?: string;
}
export interface SelectOption {
  value: string;
  label: string;
}
export interface SelectField extends FormFieldBase {
  type: 'select';
  options: SelectOption[];
  defaultValue?: string;
}
export interface RadioField extends FormFieldBase {
  type: 'radio';
  options: SelectOption[];
  defaultValue?: string;
}
export interface CheckboxField extends FormFieldBase {
  type: 'checkbox';
  defaultValue?: boolean;
}

export type FormField =
  | TextField
  | TextareaField
  | NumberField
  | DateField
  | SelectField
  | RadioField
  | CheckboxField;

export type FieldType = FormField['type'];

export interface FormSchema {
  /** Identidade no registry; a referência de user task é `formId@version`. */
  formId: string;
  /** Versão inteira >= 1; imutável depois de publicada. */
  version: number;
  title: string;
  fields: FormField[];
}

/**
 * Avaliador de expressão INJETADO pelo host (S-FEEL via @buildtovalue/sfeel
 * na prática). Puro e determinístico; nunca lança — expressão inválida
 * retorna { error }.
 */
export interface ExpressionEvaluator {
  evaluate(
    expression: string,
    context: Readonly<Record<string, unknown>>,
  ): { value: boolean } | { error: string };
}
