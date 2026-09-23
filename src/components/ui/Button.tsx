'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'info' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  /** The one action on a screen that saves or moves things forward. */
  primary: 'bg-accent text-on-accent shadow-card hover:bg-accent/90',
  /** Everything else. */
  secondary: 'border border-border bg-card text-fg shadow-card hover:border-border-strong hover:bg-surface',
  /** Bank connections (Plaid). */
  info: 'bg-info text-on-info shadow-card hover:bg-info/90',
  /** Delete and anything else that cannot be undone. */
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15',
  /** Icon-only and inline actions. */
  ghost: 'text-fg-muted hover:bg-surface hover:text-fg',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-[background-color,border-color,color,opacity] duration-150',
    'disabled:pointer-events-none disabled:opacity-55',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. Keep the label so the width does not jump. */
  loading?: boolean;
  /** Leading icon, e.g. `<Save size={16} />`. Hidden while loading. */
  icon?: ReactNode;
}

/**
 * The only button. Pick a variant for meaning, not colour. `forwardRef` and
 * prop spreading are what let Clerk's `<SignInButton>` and other wrappers
 * attach their handlers.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, loading = false, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  /** Trailing icon, e.g. an arrow. */
  trailingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A Next.js link that looks like a Button. For navigation, never for actions. */
export function LinkButton({ href, variant, size, fullWidth, icon, trailingIcon, className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })}>
      {icon}
      {children}
      {trailingIcon}
    </Link>
  );
}
