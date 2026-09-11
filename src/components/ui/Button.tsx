'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'info' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  /** The one action that moves money or saves: green on black, like the active nav item. */
  primary: 'bg-accent text-black hover:brightness-110 focus-visible:ring-accent/40',
  /** Everything else on a card. */
  secondary: 'border border-border bg-surface text-fg hover:border-border-strong hover:bg-card focus-visible:ring-border-strong',
  /** Plaid and other connections. */
  info: 'bg-info text-black hover:brightness-110 focus-visible:ring-info/40',
  /** Delete and other things you cannot undo. */
  danger: 'border border-danger bg-danger/10 text-danger hover:bg-danger/20 focus-visible:ring-danger/40',
  /** Icon-only and inline actions. */
  ghost: 'text-fg-muted hover:bg-card hover:text-fg focus-visible:ring-border-strong',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
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
    'inline-flex items-center justify-center rounded-lg font-semibold transition-[background-color,border-color,filter,opacity] duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:pointer-events-none disabled:opacity-60',
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
