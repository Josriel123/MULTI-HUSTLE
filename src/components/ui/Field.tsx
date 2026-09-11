'use client';

import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../cn';

/**
 * Form primitives. A page composes `<Field label=...><Input /></Field>`; the
 * field owns the label/hint layout and the input owns its own look, so the
 * two can also be used apart (a bare `<Select>` in a toolbar, for instance).
 */

export function Label({ className, children, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-2 block text-sm font-semibold text-fg-muted', className)} {...rest}>
      {children}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-fg placeholder:text-fg-faint ' +
  'transition-[border-color,box-shadow] duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(CONTROL, className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, 'appearance-auto', className)} {...rest}>
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
  error?: string | null;
  className?: string;
  children: ReactNode;
}

export function Field({ htmlFor, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-fg-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Two fields side by side on tablets and up, stacked on phones. */
export function FieldGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}
