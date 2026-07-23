export {
  DATA_CLASSIFICATIONS,
  RESERVED_FIELD_KEY,
  type CheckboxField,
  type DataClassification,
  type DateField,
  type ExpressionEvaluator,
  type FieldType,
  type FormField,
  type FormFieldBase,
  type FormSchema,
  type NumberField,
  type RadioField,
  type SelectField,
  type SelectOption,
  type TextField,
  type TextareaField,
} from './types.js';
export { validateFormSchema, type SchemaIssue } from './validateSchema.js';
export { formExpressionEvaluator } from './evaluator.js';
// O CORPUS de conformidade é fixture de teste, não superfície de runtime — vive
// no subpath dedicado `@buildtovalue/forms/corpus` (não polui o bundle de quem
// só usa o avaliador). É a FONTE ÚNICA que o teste de equivalência da plataforma
// importa no colapso da coexistência transitória (buildtovalue-platform §2.7).
export {
  applyDefaults,
  validateSubmission,
  type SubmissionErrors,
  type SubmissionResult,
} from './submission.js';
