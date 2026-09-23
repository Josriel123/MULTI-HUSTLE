import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { cn } from '../cn';

export type CalloutTone = 'info' | 'warning' | 'success' | 'tip';

const TONE: Record<CalloutTone, { icon: typeof Info; box: string; icon_: string }> = {
  info: { icon: Info, box: 'border-info/25 bg-info/5', icon_: 'text-info' },
  warning: { icon: AlertTriangle, box: 'border-warning/30 bg-warning/5', icon_: 'text-warning' },
  success: { icon: CheckCircle2, box: 'border-accent/25 bg-accent/5', icon_: 'text-accent' },
  tip: { icon: Lightbulb, box: 'border-border bg-surface', icon_: 'text-fg-muted' },
};

/** A tinted note inside a page: what to do next, why a number looks the way it does. */
export function Callout({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  /** A button or link, placed at the end (below on phones). */
  action?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, box, icon_ } = TONE[tone];
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center', box, className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon size={18} className={cn('mt-0.5 shrink-0', icon_)} aria-hidden />
        <div className="min-w-0 text-sm leading-relaxed">
          {title && <p className="font-semibold text-fg">{title}</p>}
          {children && <div className={cn('text-fg-muted', title ? 'mt-0.5' : undefined)}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 pl-7 sm:pl-0 print:hidden">{action}</div>}
    </div>
  );
}
