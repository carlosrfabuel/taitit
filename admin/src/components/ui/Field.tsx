import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const control =
  'w-full rounded-lg border-[1.5px] bg-surface px-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-accent aria-[invalid=true]:border-danger';

type FieldProps = {
  label?: string;
  error?: string | null;
  hint?: string;
  children: (id: string, describedBy?: string) => ReactNode;
};

// Label + control + error/hint, wired for accessibility.
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-ink">
          {label}
        </label>
      )}
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label?: string; error?: string | null; hint?: string };

export function Input({
  label,
  error,
  hint,
  className = '',
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input
          {...rest}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${control} h-10 border-line ${className}`}
        />
      )}
    </Field>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <textarea
          {...rest}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${control} min-h-24 border-line py-2 ${className}`}
        />
      )}
    </Field>
  );
}

export function Select({
  label,
  error,
  hint,
  options,
  className = '',
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <select
          {...rest}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${control} h-10 border-line ${className}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
