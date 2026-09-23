'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary';
import { cn } from '../cn';

const PANEL_WIDTH = 288;
const GAP = 8;

/**
 * A tax word that explains itself: dotted underline, and a short definition
 * on hover, focus or tap.
 *
 * The panel is a native popover (`popover="auto"`), so it renders above
 * everything, closes on Escape or a tap elsewhere, and needs no z-index
 * bookkeeping. It is placed with fixed coordinates measured from the word and
 * kept inside the viewport, which matters on a 375px phone.
 */
export function Term({ k, children, className }: { k: GlossaryKey; children?: ReactNode; className?: string }) {
  const entry = GLOSSARY[k];
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinned, setPinned] = useState(false);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - GAP * 2);
    const left = Math.min(Math.max(GAP, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - GAP);
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    // Below the word unless that would run off the bottom.
    const below = rect.bottom + GAP;
    const height = panel.offsetHeight;
    panel.style.top = `${below + height > window.innerHeight - GAP ? Math.max(GAP, rect.top - GAP - height) : below}px`;
  }, []);

  const show = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || panel.matches(':popover-open')) return;
    panel.showPopover();
    place();
  }, [place]);

  const hide = useCallback(() => {
    const panel = panelRef.current;
    if (panel?.matches(':popover-open')) panel.hidePopover();
  }, []);

  // Keep state in step when the browser light-dismisses the popover.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'closed') setPinned(false);
    };
    panel.addEventListener('toggle', onToggle);
    const close = () => hide();
    window.addEventListener('scroll', close, { passive: true, capture: true });
    window.addEventListener('resize', close);
    return () => {
      panel.removeEventListener('toggle', onToggle);
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [hide]);

  const hoverable = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={id}
        aria-expanded={pinned}
        className={cn(
          'cursor-help rounded-sm text-left underline decoration-fg-faint decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-fg-muted',
          className,
        )}
        onClick={() => {
          if (pinned) {
            hide();
            setPinned(false);
          } else {
            show();
            setPinned(true);
          }
        }}
        onMouseEnter={() => {
          if (!hoverable()) return;
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(show, 150);
        }}
        onMouseLeave={() => {
          if (!hoverable()) return;
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          if (!pinned) hoverTimer.current = setTimeout(hide, 120);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) show();
        }}
        onBlur={() => {
          if (!pinned) hide();
        }}
      >
        {children ?? entry.term}
      </button>
      {/* A span, not a div: a Term often sits inside a <p>. No display class:
          the browser hides a closed popover, and position: fixed makes an open
          one a block. */}
      <span
        ref={panelRef}
        id={id}
        role="tooltip"
        popover="auto"
        className="fixed m-0 rounded-xl border border-border bg-card p-3.5 text-left text-sm font-normal normal-case leading-relaxed tracking-normal text-fg-muted shadow-pop [inset:unset] print:hidden"
      >
        <span className="mb-1 block font-semibold text-fg">{entry.term}</span>
        {entry.text}
      </span>
    </>
  );
}
