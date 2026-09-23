import type { ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Wraps content that is loading or refreshing. Keeps the layout in place and
 * dims it instead of swapping in a spinner, so figures never jump when the
 * tax year changes. Sets `aria-busy` for assistive tech.
 */
export function Busy({ busy, className, children }: { busy: boolean; className?: string; children: ReactNode }) {
  return (
    <div aria-busy={busy || undefined} className={cn('transition-opacity duration-300', busy && 'pointer-events-none select-none opacity-50', className)}>
      {children}
    </div>
  );
}

/** A grey placeholder bar for a figure that has not loaded yet. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block animate-pulse rounded-md bg-surface', className)} />;
}
