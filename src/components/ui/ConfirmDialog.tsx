'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for anything that deletes. */
  tone?: 'danger' | 'default';
}

/**
 * The in-app replacement for `window.confirm()`. Use this, never the browser's.
 *
 * `window.confirm()` freezes the page's JavaScript until it is answered. Clerk
 * keeps a session alive by refreshing a short-lived token on a background
 * timer, and that timer cannot run while the page is frozen. The second e2e
 * pass (docs/audits/e2e-2026-09-18) recorded one unexplained auth error on a
 * delete whose confirmation had been left open for a long time — consistent
 * with the request going out on an expired token. That cause is a hypothesis,
 * but the fix stands on its own: a `<dialog>` opened with `showModal()` is
 * modal to the user without stopping JavaScript, and the browser supplies
 * focus trapping, Escape-to-cancel and an inert page behind it.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: 'Delete this trip?', tone: 'danger' }))) return;
 *   …
 *   return <>{…}{confirmDialog}</>;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Unique per use: several pages hold more than one confirm (the bank card, the list, the hustles).
  const titleId = useId();

  const confirm = useCallback((opts: ConfirmOptions) => {
    // A second request while one is open answers the first one "no".
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  // Open and close the native dialog to follow state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (options && !dialog.open) dialog.showModal();
    if (!options && dialog.open) dialog.close();
  }, [options]);

  // Never leave a caller awaiting a promise that can no longer be answered.
  useEffect(() => () => resolver.current?.(false), []);

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Escape fires `cancel`. Handle it here so state and the promise follow.
      onCancel={(e) => {
        e.preventDefault();
        settle(false);
      }}
      // A click whose target is the <dialog> itself landed on the backdrop:
      // the content box below has no padding of its own on the element.
      onClick={(e) => {
        if (e.target === e.currentTarget) settle(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-fg shadow-pop backdrop:bg-scrim print:hidden"
    >
      {options && (
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <h2 id={titleId} className="text-lg font-semibold">
            {options.title}
          </h2>
          {options.body && <div className="text-sm leading-relaxed text-fg-muted">{options.body}</div>}
          {/* Cancel comes first so it takes focus when the dialog opens: the
              safe default for a destructive action. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => settle(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={options.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {options.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );

  return [confirm, dialog];
}
