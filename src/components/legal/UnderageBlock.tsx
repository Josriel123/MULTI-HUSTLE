'use client';

import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';
import { useUnderage } from './underage';

/**
 * Wraps the sign-up form: on a device where someone said they are under 18,
 * the form is replaced by a plain explanation (their account was deleted when
 * they said so). A shared device's adult can write in, or use another browser.
 */
export function UnderageBlock({ children }: { children: ReactNode }) {
  const underage = useUnderage();
  if (!underage) return <>{children}</>;
  return (
    <div role="status" className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
      <h2 className="text-lg font-semibold">{LEGAL.appName} is for people {LEGAL.minimumAge} and older</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Someone on this device told us they are under {LEGAL.minimumAge}, so the account was deleted and sign-up is closed here. If that was a
        mistake, write to{' '}
        <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
          {LEGAL.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
