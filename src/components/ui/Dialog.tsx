'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../cn';

/**
 * A modal panel for editing one thing (a transaction, a W-2).
 *
 * Native `<dialog>` opened with `showModal()`, for the same reasons as
 * ConfirmDialog: the browser traps focus, makes the page behind it inert and
 * closes on Escape, and no JavaScript is frozen while it is open. On phones
 * it becomes a sheet anchored to the bottom of the screen.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** The action buttons. */
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'mb-0 mt-auto w-full max-w-none rounded-t-2xl border border-border bg-card p-0 text-fg shadow-pop backdrop:bg-scrim sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-2xl print:hidden',
        size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="-mr-2 px-2">
              <X size={18} aria-hidden />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-5 md:px-6">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end md:px-6">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
