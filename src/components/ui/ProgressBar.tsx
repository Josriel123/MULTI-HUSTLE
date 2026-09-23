import { cn } from '../cn';

/**
 * A horizontal bar filled to `value` (0 to 1). The fraction comes from the
 * server or from counting list items; this component only draws it.
 */
export function ProgressBar({
  value,
  label,
  tone = 'accent',
  className,
}: {
  value: number;
  /** Read by screen readers: "3 of 5 steps done". */
  label: string;
  tone?: 'accent' | 'info' | 'neutral';
  className?: string;
}) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const fill = { accent: 'bg-accent', info: 'bg-info', neutral: 'bg-fg-faint' }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
