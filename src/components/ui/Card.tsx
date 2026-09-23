import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type CardAccent = 'none' | 'accent' | 'danger' | 'info' | 'warning' | 'neutral';

const ACCENT_TOP: Record<CardAccent, string> = {
  none: '',
  accent: 'border-t-[3px] border-t-accent',
  danger: 'border-t-[3px] border-t-danger',
  info: 'border-t-[3px] border-t-info',
  warning: 'border-t-[3px] border-t-warning',
  neutral: 'border-t-[3px] border-t-border-strong',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** A thin top rule in a semantic colour. Sparingly: one or two per screen. */
  accent?: CardAccent;
  /** Lift on hover. Only for cards that are themselves a link or button. */
  hover?: boolean;
  /** `none` when the content (a table) brings its own; `sm` for dense items; `md` default; `lg` for forms. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-5 md:p-7',
} as const;

/** The surface everything sits on. */
export function Card({ accent = 'none', hover = false, padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card shadow-card',
        PADDING[padding],
        ACCENT_TOP[accent],
        hover && 'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop',
        'print:break-inside-avoid print:shadow-none',
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
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, as: Tag = 'h2', ...rest }: HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' }) {
  return (
    <Tag className={cn('text-base font-semibold leading-tight md:text-lg', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm leading-relaxed text-fg-muted', className)} {...rest}>
      {children}
    </p>
  );
}

/** A row inside a card: label and hint on the left, value on the right. */
export function DataRow({
  label,
  hint,
  value,
  tone = 'default',
  emphasis = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'accent' | 'danger' | 'muted';
  /** A total: bold, with a rule above. */
  emphasis?: boolean;
}) {
  const toneClass = { default: 'text-fg', accent: 'text-accent', danger: 'text-danger', muted: 'text-fg-muted' }[tone];
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', emphasis && 'mt-1 border-t border-border pt-3.5')}>
      <div className="min-w-0">
        <div className={cn('text-sm', emphasis ? 'font-semibold text-fg' : 'text-fg')}>{label}</div>
        {hint && <div className="mt-0.5 text-xs text-fg-faint">{hint}</div>}
      </div>
      <div className={cn('shrink-0 tabular-nums', emphasis ? 'text-base font-bold' : 'text-sm font-semibold', toneClass)}>{value}</div>
    </div>
  );
}
