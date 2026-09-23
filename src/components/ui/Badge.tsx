import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export type BadgeTone = 'neutral' | 'muted' | 'accent' | 'info' | 'warning' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-fg-muted ring-border',
  muted: 'bg-transparent text-fg-faint ring-border',
  accent: 'bg-accent/10 text-accent ring-accent/25',
  info: 'bg-info/10 text-info ring-info/25',
  warning: 'bg-warning/10 text-warning ring-warning/30',
  danger: 'bg-danger/10 text-danger ring-danger/25',
};

/** Small status pill: "Deductible", "From your bank", a hustle name. Text only; never a raw slug (use `categoryLabel`). */
export function Badge({ tone = 'neutral', className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}
