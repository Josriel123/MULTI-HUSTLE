'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * The cookie notice. Honest about what there is: essential sign-in cookies
 * and a few remembered choices in the browser's storage. There are no
 * analytics, advertising or tracking cookies, so there is nothing to opt in
 * to or out of, and the notice offers no fake "choices". Anything
 * non-essential added later must ask first (AGENTS.md) and give this notice a
 * real accept / reject pair at equal prominence.
 *
 * Bump NOTICE_VERSION when the cookies in use change, so everyone sees the
 * notice again.
 */
export const NOTICE_VERSION = '2026-09-23';
const KEY = 'multi-hustle:cookie-notice';

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function acknowledged(): boolean {
  try {
    return window.localStorage.getItem(KEY) === NOTICE_VERSION;
  } catch {
    return false;
  }
}
function setAcknowledged(value: boolean) {
  try {
    if (value) window.localStorage.setItem(KEY, NOTICE_VERSION);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the notice simply shows again next time.
  }
  listeners.forEach((l) => l());
}

/** Shows the notice again (the account page's "Show the cookie notice"). */
export function reopenCookieNotice() {
  setAcknowledged(false);
}

export function CookieNotice() {
  // The server render and the hydrating client render agree (hidden: the
  // server cannot read localStorage), so it never flashes for someone who
  // already said OK; a first-time visitor sees it slide in just after.
  const done = useSyncExternalStore(subscribe, acknowledged, () => true);
  if (done) return null;
  return (
    <section
      aria-label="Cookie notice"
      // Clears the phone's bottom tab bar (globals.css sets --mh-bottom-nav while it shows) and the home indicator.
      className="fixed inset-x-3 bottom-[calc(0.75rem+var(--mh-bottom-nav,0px)+env(safe-area-inset-bottom,0px))] z-40 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-pop sm:left-auto sm:right-4 sm:w-[26rem] print:hidden"
    >
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-fg-muted" aria-hidden>
          <Cookie size={18} />
        </span>
        <div className="min-w-0 text-sm leading-relaxed">
          <p className="font-semibold text-fg">Only essential cookies</p>
          <p className="mt-0.5 text-fg-muted">
            We use cookies to keep you signed in, and your browser&rsquo;s storage to remember a few choices, like finishing the tour. No analytics, no ads, no
            tracking.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => setAcknowledged(true)}>
              OK
            </Button>
            <Link href="/legal/cookies" className="text-sm font-medium text-accent underline-offset-2 hover:underline">
              Cookie policy
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
