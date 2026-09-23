'use client';

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Car, FileText, Landmark, LayoutDashboard, Lock, Menu, Plus, Sprout, X } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import SidebarNav from './SidebarNav';
import { TaxYearSelect } from './TaxYearSelect';
import { SiteFooter } from './legal/SiteFooter';
import { startTour } from './tour/GuidedTour';
import { TOUR_DRAWER_EVENT } from './tour/tourSteps';
import { useYearHref } from './useTaxYear';
import { cn } from './cn';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { SkipLink } from './ui/SkipLink';

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent shadow-card" aria-hidden>
        <Sprout size={18} strokeWidth={2.5} />
      </span>
      <span className="whitespace-nowrap text-[1.05rem] font-bold tracking-tight">Multi-Hustle</span>
    </Link>
  );
}

function SidebarFooter() {
  return (
    <div className="mx-3 mb-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => startTour()}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-fg-muted hover:bg-surface hover:text-fg"
      >
        <Sprout size={16} className="text-accent" aria-hidden />
        Take the tour
      </button>
      <div className="rounded-xl border border-border bg-surface/70 p-3.5 text-xs leading-relaxed text-fg-muted">
        <p className="font-semibold text-fg">A planning estimate</p>
        <p className="mt-0.5">Federal tax only, from what you enter. Not tax advice, not a tax return, and not affiliated with the IRS.</p>
        <p className="mt-2 flex items-center gap-1.5 text-fg-faint">
          <Lock size={12} aria-hidden />
          Bank access tokens are encrypted at rest.
        </p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate, onClose, closeRef }: { onNavigate?: () => void; onClose?: () => void; closeRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Brand />
        {onClose && (
          <Button ref={closeRef} variant="ghost" size="sm" aria-label="Close menu" onClick={onClose} className="-mr-2 px-2">
            <X size={20} aria-hidden />
          </Button>
        )}
      </div>
      <Suspense fallback={<nav aria-label="Primary" className="flex-1" />}>
        <SidebarNav onNavigate={onNavigate} />
      </Suspense>
      <SidebarFooter />
    </>
  );
}

/** The phone's bottom tabs: the four places people go most, plus the rest in the menu. */
function BottomNav({ onMore, onAdd, moreOpen }: { onMore: () => void; onAdd: () => void; moreOpen: boolean }) {
  const pathname = usePathname().replace(/^\/preview(?=\/|$)/, '').replace(/^\/overview$/, '') || '/';
  const yearHref = useYearHref();
  const tab = (href: string, label: string, Icon: typeof LayoutDashboard) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
      <Link
        href={yearHref(href)}
        data-tour={`nav-${href}`}
        aria-current={active ? 'page' : undefined}
        className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[0.7rem] font-medium', active ? 'text-accent' : 'text-fg-muted')}
      >
        <Icon size={22} aria-hidden />
        <span className="truncate">{label}</span>
      </Link>
    );
  };
  return (
    <nav
      aria-label="Main"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-2">
        {tab('/', 'Overview', LayoutDashboard)}
        {tab('/transactions', 'Money', ArrowLeftRight)}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add something"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-pop ring-4 ring-bg active:scale-95"
          >
            <Plus size={26} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        {tab('/report', 'Report', FileText)}
        <button
          type="button"
          onClick={onMore}
          data-tour="more"
          aria-expanded={moreOpen}
          aria-controls="app-menu"
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[0.7rem] font-medium text-fg-muted"
        >
          <Menu size={22} aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

/** What the "+" offers: the four things people add most. */
function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const yearHref = useYearHref();
  const items = [
    { href: '/transactions?add=income', label: 'Money in', hint: 'A payout, an invoice paid', icon: ArrowDownLeft },
    { href: '/transactions?add=expense', label: 'Money out', hint: 'A cost for your hustle', icon: ArrowUpRight },
    { href: '/mileage', label: 'A business trip', hint: 'Miles driven for work', icon: Car },
    { href: '/payments', label: 'A tax payment', hint: 'Money sent to the IRS', icon: Landmark },
  ];
  return (
    <Dialog open={open} onClose={onClose} title="What would you like to add?">
      <ul className="grid grid-cols-2 gap-3">
        {items.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link
              href={yearHref(href)}
              onClick={onClose}
              className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 hover:border-accent hover:bg-accent/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent" aria-hidden>
                <Icon size={20} />
              </span>
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-fg-muted">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/**
 * Responsive application frame.
 *
 * Desktop (lg and up): a fixed sidebar and a sticky header over the content.
 * Phones and tablets: a bottom tab bar (Overview, Money, add, Report, More),
 * with every other page in the slide-out menu behind "More". The header
 * carries the tax year picker, so every page shares one year.
 *
 * The menu is an accessible modal: focus moves into it and stays there,
 * Escape and the overlay close it, the page behind is inert, and focus
 * returns to "More" afterwards. It is not a native <dialog>, because the
 * guided tour has to draw above it and nothing can sit above the top layer.
 *
 * Everything here is `print:hidden`: a printed report only wants the content.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // The dev-only sample-data preview has no session, but should look signed in.
  const pathname = usePathname();
  const preview = process.env.NODE_ENV !== 'production' && (pathname === '/preview' || pathname.startsWith('/preview/'));

  // The guided tour opens and closes the menu for tabs that live in it.
  useEffect(() => {
    const onTour = (e: Event) => setDrawerOpen(Boolean((e as CustomEvent<{ open: boolean }>).detail?.open));
    window.addEventListener(TOUR_DRAWER_EVENT, onTour);
    return () => window.removeEventListener(TOUR_DRAWER_EVENT, onTour);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      returnFocus.current?.focus?.();
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      <SkipLink />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex print:hidden">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <button type="button" tabIndex={-1} className="absolute inset-0 animate-fade-in bg-scrim" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <aside
            ref={drawerRef}
            id="app-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col overflow-y-auto border-r border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-pop"
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} closeRef={closeRef} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col" inert={drawerOpen || undefined}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-8 print:hidden">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Brand />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            {preview && (
              <>
                <span className="hidden rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning sm:inline">Sample data</span>
                <Suspense fallback={null}>
                  <div data-tour="tax-year">
                    <TaxYearSelect />
                  </div>
                </Suspense>
              </>
            )}
            <Show when="signed-in">
              <Suspense fallback={<div className="h-10 w-28 rounded-lg bg-card" />}>
                <div data-tour="tax-year">
                  <TaxYearSelect />
                </div>
              </Suspense>
              <UserButton />
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="primary" size="sm">
                  Sign in
                </Button>
              </SignInButton>
            </Show>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 focus:outline-none md:px-8 md:pt-8 lg:pb-12">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={null}>{children}</Suspense>
            <SiteFooter compact className="mt-12" />
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        <BottomNav onMore={() => setDrawerOpen(true)} onAdd={() => setAddOpen(true)} moreOpen={drawerOpen} />
        <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} />
        <FocusMainOnNavigate />
      </Suspense>
    </div>
  );
}

/**
 * Moves focus to the page's main landmark after client-side navigation to
 * another page, so a screen reader user hears the new page rather than
 * staying on the old link. Only the path counts: changing the tax year keeps
 * focus on the year picker.
 */
function FocusMainOnNavigate() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
