import type { ReactNode } from 'react';
import { Card, type CardAccent } from './Card';
import { cn } from '../cn';

export interface StatCardProps {
  /** Sentence case: "Total income". May be a `<Term>` so the label explains itself. */
  label: ReactNode;
  /** Already formatted: pass `formatCurrency(x)`, never a number. */
  value: ReactNode;
  /** What the number is, in one plain line. */
  caption?: ReactNode;
  /** A small icon in a tinted square beside the label. */
  icon?: ReactNode;
  accent?: CardAccent;
  /** Colour of the big number. `accent` for money in the user's favour. */
  tone?: 'default' | 'accent' | 'danger' | 'warning';
  /** Extra content under the caption: a progress bar, a link. */
  footer?: ReactNode;
  className?: string;
  /** E.g. "hidden sm:block" where cards sit side by side on a phone. */
  captionClassName?: string;
}

const ICON_TONE = {
  default: 'bg-surface text-fg-muted',
  accent: 'bg-accent/10 text-accent',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
} as const;

/**
 * One headline figure. A page that shows a tax liability in one of these
 * MUST render an `<EstimateNotice>` on the same screen (see EstimateNotice.tsx).
 */
export function StatCard({ label, value, caption, icon, accent = 'none', tone = 'default', footer, className, captionClassName }: StatCardProps) {
  const toneClass = { default: 'text-fg', accent: 'text-accent', danger: 'text-danger', warning: 'text-warning' }[tone];
  return (
    <Card accent={accent} className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_TONE[tone])} aria-hidden>
            {icon}
          </span>
        )}
        <h3 className="text-sm font-medium text-fg-muted">{label}</h3>
      </div>
      <div className={cn('text-[1.75rem] font-bold leading-tight tracking-tight tabular-nums md:text-[2rem]', toneClass)}>{value}</div>
      {caption && <p className={cn('text-sm leading-snug text-fg-muted', captionClassName)}>{caption}</p>}
      {footer}
    </Card>
  );
}
