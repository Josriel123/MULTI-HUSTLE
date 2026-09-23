import Link from 'next/link';
import { LEGAL, LEGAL_PAGES } from '@/lib/legal';
import { cn } from '../cn';

/**
 * Links to every policy, on every public page and, compactly, inside the app.
 * CalOPPA asks for the privacy policy to be linked conspicuously from the
 * home page; this puts it one tap away everywhere.
 */
export function SiteFooter({ compact = false, className }: { compact?: boolean; className?: string }) {
  const year = LEGAL.effectiveDate.slice(0, 4);
  if (compact) {
    return (
      <footer className={cn('border-t border-border pt-5 text-xs text-fg-faint print:hidden', className)}>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/legal/privacy" className="hover:text-fg hover:underline">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-fg hover:underline">Terms</Link>
          <Link href="/legal/cookies" className="hover:text-fg hover:underline">Cookies</Link>
          <Link href="/legal/accessibility" className="hover:text-fg hover:underline">Accessibility</Link>
          <Link href="/legal" className="hover:text-fg hover:underline">All policies</Link>
          <Link href="/about" className="hover:text-fg hover:underline">Contact</Link>
        </nav>
        <p className="mt-2 leading-relaxed">
          © {year} {LEGAL.operatorName}. Estimates for planning, not tax, legal or financial advice. Not affiliated with the IRS.
        </p>
      </footer>
    );
  }
  return (
    <footer className={cn('border-t border-border bg-card print:hidden', className)}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm md:grid-cols-3 md:px-8">
        <div>
          <p className="font-semibold text-fg">{LEGAL.appName}</p>
          <p className="mt-2 leading-relaxed text-fg-muted">
            A free planning tool that estimates the federal tax on your side hustles. Not tax, legal or financial advice, and not affiliated with the IRS.
          </p>
        </div>
        <nav aria-label="Policies">
          <p className="font-semibold text-fg">Policies</p>
          <ul className="mt-2 grid gap-1.5">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="text-fg-muted hover:text-fg hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="font-semibold text-fg">Contact</p>
          <p className="mt-2 leading-relaxed text-fg-muted">
            {LEGAL.appName} is run by {LEGAL.operatorName}, {LEGAL.operatorKind} in the {LEGAL.country}.
          </p>
          <p className="mt-2">
            <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
              {LEGAL.contactEmail}
            </a>
          </p>
          <p className="mt-2">
            <Link href="/about" className="text-fg-muted hover:text-fg hover:underline">
              About and contact
            </Link>
          </p>
        </div>
      </div>
      <p className="border-t border-border px-4 py-4 text-center text-xs text-fg-faint md:px-8">© {year} {LEGAL.operatorName}. All rights reserved.</p>
    </footer>
  );
}
