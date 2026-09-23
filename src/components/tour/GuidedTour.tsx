'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Sprout, X } from 'lucide-react';
import { cn } from '../cn';
import { useYearHref } from '../useTaxYear';
import { Button } from '../ui/Button';
import { START_TOUR_EVENT, TOUR_DRAWER_EVENT, TOUR_STEPS, TOUR_STORAGE_KEY } from './tourSteps';

/**
 * The first-visit tutorial, the way a game teaches its screens: a guide
 * character ("Sprout") in a speech bubble that points at one tab at a time,
 * with the rest of the screen dimmed. Back, Next and Skip at every step;
 * arrow keys and Escape work too. It starts by itself once per browser, and
 * `startTour()` (Account & privacy, the sidebar) replays it.
 *
 * On phones most tabs live in the slide-out menu, so the tour asks AppShell to
 * open it for those steps (TOUR_DRAWER_EVENT) and closes it at the end.
 */

const PAD = 6;
const GAP = 14;
const BUBBLE_W = 340;

type Rect = { top: number; left: number; width: number; height: number };

/** Starts (or restarts) the tour from anywhere. */
export function startTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}

function markDone() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
  } catch {
    // Storage blocked: the tour may show again next visit, which is harmless.
  }
}

function tourDone(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === 'done';
  } catch {
    return true;
  }
}

/** The first element with this data-tour name that is actually on screen. */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return el;
  }
  return null;
}

const setDrawer = (open: boolean) => window.dispatchEvent(new CustomEvent(TOUR_DRAWER_EVENT, { detail: { open } }));

export function GuidedTour() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const yearHref = useYearHref();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleH, setBubbleH] = useState(180);

  // Start once per browser. Not over the dev-only preview's screenshots,
  // unless it asks with ?tour=1.
  useEffect(() => {
    const preview = pathname.startsWith('/preview');
    if (preview ? params.get('tour') !== '1' : tourDone()) return;
    const id = window.setTimeout(() => setStep(0), 600);
    return () => window.clearTimeout(id);
  }, [pathname, params]);

  useEffect(() => {
    const onStart = () => setStep(0);
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, []);

  const current = step === null ? null : TOUR_STEPS[step];

  const finish = useCallback(() => {
    markDone();
    setDrawer(false);
    setStep(null);
    setRect(null);
  }, []);

  // Find and measure the target; open the phone menu when the tab lives there.
  useLayoutEffect(() => {
    if (!current) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      if (!current.target) return setRect(null);
      const el = findTarget(current.target);
      if (!el) return setRect(null);
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      setRect((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    const needsDrawer = Boolean(current.target && !findTarget(current.target) && current.drawer);
    setDrawer(needsDrawer || (Boolean(current.drawer) && window.innerWidth < 1024));
    // Let the drawer render (and slide) before measuring, and measure again
    // when its slide-in animation ends: a fixed delay alone once caught the
    // menu mid-slide and put the highlight off the left edge of the screen.
    const id = window.setTimeout(measure, needsDrawer ? 320 : 0);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('animationend', measure, true);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('animationend', measure, true);
    };
  }, [current]);

  useLayoutEffect(() => {
    if (bubbleRef.current) setBubbleH(bubbleRef.current.offsetHeight);
    bubbleRef.current?.focus();
  }, [step, rect]);

  const next = useCallback(() => setStep((s) => (s === null ? s : s + 1 < TOUR_STEPS.length ? s + 1 : s)), []);
  const back = useCallback(() => setStep((s) => (s === null || s === 0 ? s : s - 1)), []);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (step === TOUR_STEPS.length - 1) finish();
        else next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Tab' && bubbleRef.current) {
        // Keep focus inside the bubble while the tour is open.
        const focusables = bubbleRef.current.querySelectorAll<HTMLElement>('button, a[href]');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [step, next, back, finish]);

  if (step === null || !current) return null;

  const last = step === TOUR_STEPS.length - 1;
  const width = Math.min(BUBBLE_W, viewport.w - 24);

  // Beside the target when there is room (the sidebar), else below, else above.
  let pos: { top: number; left: number; arrow: 'left' | 'top' | 'bottom' | null };
  if (!rect) {
    pos = { top: Math.max(24, viewport.h / 2 - bubbleH / 2), left: viewport.w / 2 - width / 2, arrow: null };
  } else if (rect.left + rect.width + GAP + width <= viewport.w - 12) {
    const top = Math.min(Math.max(12, rect.top + rect.height / 2 - 40), viewport.h - bubbleH - 12);
    pos = { top, left: rect.left + rect.width + GAP, arrow: 'left' };
  } else if (rect.top + rect.height + GAP + bubbleH <= viewport.h - 12) {
    pos = { top: rect.top + rect.height + GAP, left: Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), viewport.w - width - 12), arrow: 'top' };
  } else {
    pos = { top: Math.max(12, rect.top - GAP - bubbleH), left: Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), viewport.w - width - 12), arrow: 'bottom' };
  }
  // Where along the bubble's edge the arrow points at the target's middle.
  const arrowOffset =
    rect && pos.arrow === 'left'
      ? Math.min(Math.max(16, rect.top + rect.height / 2 - pos.top - 8), bubbleH - 32)
      : rect
        ? Math.min(Math.max(16, rect.left + rect.width / 2 - pos.left - 8), width - 32)
        : 0;

  return (
    <div className="fixed inset-0 z-[70] print:hidden" role="presentation">
      {/* The dimmed screen, with a lit window over the target. Clicks outside
          the bubble are absorbed: the tour is driven by its own buttons. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-accent transition-all duration-300 [box-shadow:0_0_0_9999px_var(--c-tour-dim)]"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[var(--c-tour-dim)]" />
      )}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="fixed flex animate-fade-in flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-fg shadow-pop focus:outline-none"
        style={{ top: pos.top, left: pos.left, width }}
      >
        {pos.arrow && (
          <span
            aria-hidden
            className={cn(
              'absolute h-4 w-4 rotate-45 border-border bg-card',
              pos.arrow === 'left' && '-left-2 border-b border-l',
              pos.arrow === 'top' && '-top-2 border-l border-t',
              pos.arrow === 'bottom' && '-bottom-2 border-b border-r',
            )}
            style={pos.arrow === 'left' ? { top: arrowOffset } : { left: arrowOffset }}
          />
        )}
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-card" aria-hidden>
            <Sprout size={22} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
              Sprout · {step + 1} of {TOUR_STEPS.length}
            </p>
            <h2 id="tour-title" className="mt-0.5 text-base font-bold leading-snug">
              {current.title}
            </h2>
          </div>
          <button type="button" onClick={finish} aria-label="Skip the tour" className="-mr-1 -mt-1 rounded-lg p-1.5 text-fg-faint hover:bg-surface hover:text-fg">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p id="tour-body" className="text-sm leading-relaxed text-fg-muted" aria-live="polite">
          {current.body}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-accent' : 'w-1.5 bg-border-strong')} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          {step === 0 ? (
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip tour
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={back} icon={<ArrowLeft size={14} aria-hidden />}>
              Back
            </Button>
          )}
          {last ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={finish}>
                I&rsquo;ll explore
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  finish();
                  router.push(yearHref('/profile'));
                }}
              >
                Set my filing status
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={next}>
              {step === 0 ? "Let's go" : 'Next'}
              <ArrowRight size={14} aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
