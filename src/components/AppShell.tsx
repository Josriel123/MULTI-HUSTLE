'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock, Menu, Sprout, X } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import SidebarNav from './SidebarNav';
import { TaxYearSelect } from './TaxYearSelect';
import { Button } from './ui/Button';

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
    <div className="mx-3 mb-4 rounded-xl border border-border bg-surface/70 p-3.5 text-xs leading-relaxed text-fg-muted">
      <p className="font-semibold text-fg">A planning estimate</p>
      <p className="mt-0.5">Federal tax only, from what you enter. Not tax advice and not a tax return.</p>
      <p className="mt-2 flex items-center gap-1.5 text-fg-faint">
        <Lock size={12} aria-hidden />
        Bank connections are encrypted.
      </p>
    </div>
  );
}

function SidebarContent({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Brand />
        {onClose && (
          <Button variant="ghost" size="sm" aria-label="Close navigation" onClick={onClose} className="-mr-2 px-2">
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

/**
 * Responsive application frame.
 *
 * Desktop (lg and up): a fixed sidebar and a sticky header over the content.
 * Tablet and phone: the sidebar becomes a drawer opened from the header's menu
 * button, closed by the overlay, the close button, Escape, or choosing a link.
 * The header carries the tax year picker, so every page shares one year.
 *
 * Everything here is `print:hidden`: a printed report only wants the content.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The dev-only sample-data preview has no session, but should look signed in.
  const pathname = usePathname();
  const preview = process.env.NODE_ENV !== 'production' && (pathname === '/preview' || pathname.startsWith('/preview/'));

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex print:hidden">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 animate-fade-in bg-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col border-r border-border bg-card shadow-pop">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-8 print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 px-2 lg:hidden"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={22} aria-hidden />
            </Button>
            <div className="lg:hidden">
              <Brand />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {preview && (
              <>
                <span className="hidden rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning sm:inline">Sample data</span>
                <Suspense fallback={null}>
                  <TaxYearSelect />
                </Suspense>
              </>
            )}
            <Show when="signed-in">
              <Suspense fallback={<div className="h-10 w-28 rounded-lg bg-card" />}>
                <TaxYearSelect />
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

        <main className="flex-1 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
