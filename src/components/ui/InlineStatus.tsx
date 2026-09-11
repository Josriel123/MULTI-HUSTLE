import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../cn';

export type StatusKind = 'ok' | 'error' | 'info';

const KIND: Record<StatusKind, { icon: typeof Info; className: string; role: 'status' | 'alert' }> = {
  ok: { icon: CheckCircle2, className: 'text-accent', role: 'status' },
  error: { icon: AlertCircle, className: 'text-danger', role: 'alert' },
  info: { icon: Info, className: 'text-info', role: 'status' },
};

/** The result of an action, inline where it happened. Replaces `alert()`. */
export function InlineStatus({ kind, className, children }: { kind: StatusKind; className?: string; children: ReactNode }) {
  const { icon: Icon, className: tone, role } = KIND[kind];
  return (
    <div role={role} className={cn('flex items-start gap-2 text-sm', tone, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
