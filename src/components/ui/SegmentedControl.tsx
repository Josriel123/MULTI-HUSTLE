'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '../cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown after the label in a small pill, e.g. a count. */
  count?: number;
}

/**
 * A small set of mutually exclusive choices shown side by side: Money in /
 * Money out, or a list filter. Native radio buttons underneath, so arrow keys,
 * forms and screen readers work without extra code.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className,
}: {
  /** Read by screen readers; not shown. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1 [scrollbar-width:none]', fullWidth && 'flex w-full', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors',
              size === 'sm' ? 'h-8 px-2 text-sm sm:px-3' : 'h-10 px-3 text-sm sm:px-4',
              fullWidth && 'flex-1',
              checked ? 'bg-card text-fg shadow-card' : 'text-fg-muted hover:text-fg',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
            {option.count !== undefined && (
              // Counts are dropped on phones, where four labels and four counts do not fit.
              <span className={cn('hidden rounded-full px-1.5 text-xs tabular-nums sm:inline', checked ? 'bg-surface text-fg-muted' : 'bg-card/60 text-fg-faint')}>
                {option.count}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
