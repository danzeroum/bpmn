import type {
  ExpressionEvaluator,
  FormField,
  FormSchema,
  SubmissionErrors,
} from '@buildtovalue/forms';

/**
 * Renderer PURO (F0b.6): componente controlado — o host é dono dos values e
 * recebe cada mudança tipada por onChange; nenhum fetch, nenhum estado
 * interno de dados. O MESMO schema que valida a submissão no servidor
 * (`validateSubmission`) desenha a tela aqui — três camadas do D3.
 *
 * - `visibleWhen` esconde o campo via avaliador injetado (igual ao servidor:
 *   campo oculto não participa).
 * - Classificação `personal`/`sensitive` ganha tag visível (protótipo tela
 *   01/02: comunicação no momento certo; piso de 11px via styles.css).
 * - A11y: label ligada por htmlFor/id, erros via aria-describedby +
 *   aria-invalid, grupo de radio com fieldset/legend.
 */
export interface FormRendererProps {
  schema: FormSchema;
  values: Readonly<Record<string, unknown>>;
  onChange: (key: string, value: unknown) => void;
  errors?: SubmissionErrors;
  evaluator?: ExpressionEvaluator;
  disabled?: boolean;
}

export function FormRenderer({
  schema,
  values,
  onChange,
  errors = {},
  evaluator,
  disabled = false,
}: FormRendererProps) {
  return (
    <div className="btvf-form" role="group" aria-label={schema.title}>
      {schema.fields.map((field) => {
        if (field.visibleWhen && evaluator) {
          const visible = evaluator.evaluate(field.visibleWhen, {
            ...values,
            value: values[field.key],
          });
          if (!('error' in visible) && !visible.value) return null;
        }
        return (
          <FieldRow
            key={field.key}
            field={field}
            value={values[field.key]}
            errors={errors[field.key] ?? []}
            onChange={onChange}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}

const CLASSIFICATION_TAGS: Record<string, string | undefined> = {
  personal: 'PESSOAL',
  sensitive: 'SENSÍVEL',
};

interface FieldRowProps {
  field: FormField;
  value: unknown;
  errors: string[];
  onChange: (key: string, value: unknown) => void;
  disabled: boolean;
}

function FieldRow({ field, value, errors, onChange, disabled }: FieldRowProps) {
  const inputId = `btvf-${field.key}`;
  const errorId = `${inputId}-errors`;
  const tag = CLASSIFICATION_TAGS[field.dataClassification];
  const invalid = errors.length > 0;
  const describedBy = invalid ? errorId : undefined;

  const labelContent = (
    <>
      <span className="btvf-label-text">{field.label}</span>
      {field.required ? (
        <span className="btvf-required" aria-hidden="true">
          *
        </span>
      ) : null}
      {tag ? <span className={`btvf-tag btvf-tag--${field.dataClassification}`}>{tag}</span> : null}
    </>
  );

  const control = renderControl(field, value, inputId, describedBy, invalid, disabled, onChange);

  return (
    <div className={`btvf-field btvf-field--${field.type}`} data-field-key={field.key}>
      {field.type === 'radio' ? (
        <fieldset className="btvf-fieldset" aria-describedby={describedBy}>
          <legend className="btvf-label">{labelContent}</legend>
          {control}
        </fieldset>
      ) : (
        <>
          <label className="btvf-label" htmlFor={inputId}>
            {labelContent}
          </label>
          {control}
        </>
      )}
      {field.helpText ? <p className="btvf-help">{field.helpText}</p> : null}
      {invalid ? (
        <ul id={errorId} className="btvf-errors" role="alert">
          {errors.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function renderControl(
  field: FormField,
  value: unknown,
  inputId: string,
  describedBy: string | undefined,
  invalid: boolean,
  disabled: boolean,
  onChange: (key: string, value: unknown) => void,
) {
  const common = {
    id: inputId,
    name: field.key,
    disabled,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
  };
  switch (field.type) {
    case 'text':
      return (
        <input
          {...common}
          type="text"
          className="btvf-input"
          maxLength={field.maxLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          {...common}
          className="btvf-input btvf-textarea"
          maxLength={field.maxLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          {...common}
          type="number"
          className="btvf-input"
          min={field.min}
          max={field.max}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) =>
            onChange(field.key, e.target.value === '' ? undefined : Number(e.target.value))
          }
        />
      );
    case 'date':
      return (
        <input
          {...common}
          type="date"
          className="btvf-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    case 'select':
      return (
        <select
          {...common}
          className="btvf-input btvf-select"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case 'radio':
      return (
        <div className="btvf-radio-group" role="radiogroup" aria-labelledby={undefined}>
          {field.options.map((option) => (
            <label key={option.value} className="btvf-radio">
              <input
                type="radio"
                name={field.key}
                value={option.value}
                disabled={disabled}
                checked={value === option.value}
                onChange={() => onChange(field.key, option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <input
          {...common}
          type="checkbox"
          className="btvf-checkbox"
          checked={value === true}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
      );
  }
}
