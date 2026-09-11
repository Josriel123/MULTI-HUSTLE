import type { ReactNode } from 'react';
import { cn } from '../cn';

export type IconTone = 'accent' | 'info' | 'danger' | 'neutral';

const ICON_TONE: Record<IconTone, string> = {
  accent: 'border-accent text-accent',
  info: 'border-info text-info',
  danger: 'border-danger text-danger',
  neutral: 'border-border text-fg-muted',
};

export interface PageHeaderProps {
  title: string;
  /** One sentence saying what the page does. No sales language. */
  description?: ReactNode;
  /** A lucide icon, e.g. `<Home size={26} />`. */
  icon?: ReactNode;
  iconTone?: IconTone;
  /** Right-aligned on wide screens, below the title on phones: a year picker, a primary action. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, iconTone = 'neutral', actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <div className={cn('flex shrink-0 rounded-card border bg-card p-3', ICON_TONE[iconTone])} aria-hidden>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold md:text-[2rem] md:leading-tight">{title}</h1>
          {description && <p className="mt-1 text-base text-fg-muted md:text-lg">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
