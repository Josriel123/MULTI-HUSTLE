import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type CardAccent = 'none' | 'accent' | 'danger' | 'info' | 'neutral';

const ACCENT_TOP: Record<CardAccent, string> = {
  none: '',
  accent: 'border-t-4 border-t-accent',
  danger: 'border-t-4 border-t-danger',
  info: 'border-t-4 border-t-info',
  neutral: 'border-t-4 border-t-border-strong',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** A 4px top rule in a semantic colour. Use for stat cards; leave off for forms and tables. */
  accent?: CardAccent;
  /** Lift on hover. Only for cards that are themselves a target (stat cards, source cards). */
  hover?: boolean;
  /** `sm` for dense list items, `md` (default) for most content, `lg` for forms. */
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING = {
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-5 md:p-8',
} as const;

/** The surface everything sits on. Same look as the legacy `.card` class, so mixed pages stay consistent. */
export function Card({ accent = 'none', hover = false, padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]',
        PADDING[padding],
        ACCENT_TOP[accent],
        hover && 'transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, as: Tag = 'h2', ...rest }: HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' }) {
  return (
    <Tag className={cn('text-lg font-semibold leading-tight', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm text-fg-muted', className)} {...rest}>
      {children}
    </p>
  );
}

/** A row inside a card: label on the left, value on the right, with the dark inset background. */
export function DataRow({ label, hint, value, tone = 'default' }: { label: ReactNode; hint?: ReactNode; value: ReactNode; tone?: 'default' | 'accent' | 'danger' | 'muted' }) {
  const toneClass = { default: 'text-fg', accent: 'text-accent', danger: 'text-danger', muted: 'text-fg-muted' }[tone];
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-bg px-4 py-3">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-sm text-fg-muted">{hint}</div>}
      </div>
      <div className={cn('shrink-0 font-semibold tabular-nums', toneClass)}>{value}</div>
    </div>
  );
}
