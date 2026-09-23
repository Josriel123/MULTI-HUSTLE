import type { ReactNode } from 'react';
import { cn } from '../cn';

export type IconTone = 'accent' | 'info' | 'warning' | 'neutral';

const ICON_TONE: Record<IconTone, string> = {
  accent: 'bg-accent/10 text-accent',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  neutral: 'bg-surface text-fg-muted',
};

export interface PageHeaderProps {
  title: string;
  /** One or two plain sentences: what this page is for and what to do here. */
  description?: ReactNode;
  /** A lucide icon, e.g. `<Home size={22} />`. */
  icon?: ReactNode;
  iconTone?: IconTone;
  /** Right-aligned on wide screens, below the title on phones: the page's main action. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, iconTone = 'neutral', actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <div className={cn('hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:flex print:hidden', ICON_TONE[iconTone])} aria-hidden>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-[1.75rem] md:leading-tight">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[0.95rem] leading-relaxed text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5 print:hidden">{actions}</div>}
    </header>
  );
}

/** A heading between groups of cards on a page. */
export function SectionHeading({ title, description, action, className }: { title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-2', className)}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
