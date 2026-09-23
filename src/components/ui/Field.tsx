'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '../cn';

/**
 * Form primitives. A page composes `<Field label=...><Input /></Field>`; the
 * field owns the label/hint layout and the input owns its own look, so the
 * two can also be used apart (a bare `<Select>` in a toolbar, for instance).
 */

export function Label({ className, children, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-sm font-medium text-fg', className)} {...rest}>
      {children}
    </label>
  );
}

export const CONTROL =
  'h-11 w-full rounded-lg border border-field-border bg-card px-3 text-[0.95rem] text-fg placeholder:text-fg-faint ' +
  'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 ' +
  'disabled:cursor-not-allowed disabled:bg-surface disabled:text-fg-muted aria-invalid:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(CONTROL, className)} {...rest} />;
});

/**
 * A dollar amount: "$" shown in the box, a decimal keypad on phones, and
 * plain text rather than type="number" (which silently changes value on a
 * scroll and accepts "1e5"). Send the text through `normalizeMoneyText`; the
 * server refuses anything that is not a plain amount.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function MoneyInput(
  { className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-faint" aria-hidden>
        $
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className={cn(CONTROL, 'pl-7 tabular-nums', className)}
        {...rest}
      />
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, 'appearance-auto pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export interface FieldProps {
  /** Ties the label to the control; pass the same value as the control's `id`. */
  htmlFor: string;
  label: ReactNode;
  /** One line under the control: units, an example, or which form box this is. */
  hint?: ReactNode;
  /** Shown after the label, lighter: "Optional", "Box 2". */
  aside?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}

export function Field({ htmlFor, label, hint, aside, error, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {aside && <span className="ml-1.5 font-normal text-fg-faint">{aside}</span>}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-fg-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Two fields side by side on tablets and up, stacked on phones. */
export function FieldGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

/** A checkbox with its label and an optional line of explanation, the whole row clickable. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3.5 hover:border-border-strong', className)}>
      <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-accent" {...rest} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-fg-muted">{description}</span>}
      </span>
    </label>
  );
});

export interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

/** One choice of several, as a card. Group them in a `<fieldset>` with a `<legend>`. */
export const RadioCard = forwardRef<HTMLInputElement, RadioCardProps>(function RadioCard({ label, description, className, id, ...rest }, ref) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong',
        'has-[:checked]:border-accent has-[:checked]:bg-accent/5 has-[:checked]:ring-1 has-[:checked]:ring-accent',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
        className,
      )}
    >
      <input ref={ref} id={id} type="radio" className="mt-0.5 h-4 w-4 shrink-0 accent-accent" {...rest} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        {description && <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{description}</span>}
      </span>
    </label>
  );
});
