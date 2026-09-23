import Link from 'next/link';
import { Show } from '@clerk/nextjs';
import { Sprout } from 'lucide-react';
import { LinkButton } from '../ui/Button';
import { SkipLink } from '../ui/SkipLink';
import { SiteFooter } from './SiteFooter';

/**
 * The frame for pages anyone can read: the welcome page, sign-in and
 * sign-up, and the policies. No sidebar, no data; a way in and the footer.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <Link href="/welcome" className="flex items-center gap-2.5 rounded-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent shadow-card" aria-hidden>
              <Sprout size={18} strokeWidth={2.5} />
            </span>
            <span className="whitespace-nowrap text-[1.05rem] font-bold tracking-tight">Multi-Hustle</span>
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <Show when="signed-in">
              <LinkButton href="/" variant="primary" size="sm">
                Open the app
              </LinkButton>
            </Show>
            <Show when="signed-out">
              <LinkButton href="/sign-in" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/sign-up" variant="primary" size="sm">
                Create free account
              </LinkButton>
            </Show>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 px-4 pb-16 pt-8 focus:outline-none md:px-8 md:pt-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
