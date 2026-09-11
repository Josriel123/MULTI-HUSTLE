import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export type BadgeTone = 'neutral' | 'muted' | 'accent' | 'info' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-border bg-bg text-fg-muted',
  muted: 'border-border bg-bg text-fg-faint',
  accent: 'border-accent bg-accent/10 text-accent',
  info: 'border-info bg-info/10 text-info',
  danger: 'border-danger bg-danger/10 text-danger',
};

/** Small status pill: "Deductible", "Plaid", a category label. Text only; never a raw slug (use `categoryLabel`). */
export function Badge({ tone = 'neutral', className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs leading-tight', TONE[tone], className)} {...rest}>
      {children}
    </span>
  );
}
