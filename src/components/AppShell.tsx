'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Menu, Shield, TrendingUp, X } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import SidebarNav from './SidebarNav';
import { Button } from './ui/Button';

const SIDEBAR_WIDTH = 'w-[260px]';

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent" aria-hidden>
        <TrendingUp size={20} color="#000" strokeWidth={3} />
      </div>
      <span className="text-lg font-semibold tracking-tight">Multi-Hustle</span>
    </div>
  );
}

function SecurityNote() {
  return (
    <div className="border-t border-border px-6 py-6 text-sm text-fg-muted">
      <div className="mb-1 flex items-center gap-2 text-fg">
        <Shield size={16} className="text-accent" aria-hidden />
        <span className="font-medium">Encrypted at rest</span>
      </div>
      <p>Bank connection tokens are stored with AES-256 encryption.</p>
    </div>
  );
}

function SidebarContent({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between p-6 md:p-8">
        <Brand />
        {onClose && (
          <Button variant="ghost" size="sm" aria-label="Close navigation" onClick={onClose} className="-mr-2 px-2">
            <X size={20} aria-hidden />
          </Button>
        )}
      </div>
      <Suspense fallback={<nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-4" />}>
        <SidebarNav onNavigate={onNavigate} />
      </Suspense>
      <SecurityNote />
    </>
  );
}

/**
 * Responsive application frame.
 *
 * Desktop (md and up): fixed 260px sidebar, header, scrolling content.
 * Phone: the sidebar becomes a drawer opened from the header's menu button,
 * closed by the overlay, the close button, Escape, or choosing a nav link.
 *
 * Everything here is `print:hidden`; the export page's print layout only wants
 * the content.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigating closes the drawer via SidebarNav's onNavigate (see SidebarContent).
  // Escape closes it too; scrolling the page behind it is disabled while open.
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
      {/* Desktop sidebar */}
      <aside className={`hidden shrink-0 flex-col border-r border-border bg-bg md:flex ${SIDEBAR_WIDTH} print:hidden`}>
        <SidebarContent />
      </aside>

      {/* Phone drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] animate-slide-in flex-col border-r border-border bg-bg shadow-2xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:h-[70px] md:px-8 print:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 px-2 md:hidden"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={22} aria-hidden />
            </Button>
            <div className="md:hidden">
              <Brand />
            </div>
            <p className="hidden text-sm text-fg-muted md:block">Federal estimate. Not tax advice.</p>
          </div>

          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="primary" size="sm">
                  Sign in
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
