import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { LEGAL, LEGAL_PAGES, formatLegalDate } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Policies',
  description: `Every ${LEGAL.appName} policy in one place: privacy, terms, cookies, refunds, your data, accessibility and licenses.`,
};

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Policies</h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-fg-muted">
        How {LEGAL.appName} treats you and your data, in plain English. All effective {formatLegalDate(LEGAL.effectiveDate)}.
      </p>
      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {LEGAL_PAGES.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="flex items-center gap-3 px-5 py-4 hover:bg-surface">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-fg">{p.title}</span>
                <span className="mt-0.5 block text-sm text-fg-muted">{p.summary}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-fg-faint" aria-hidden />
            </Link>
          </li>
        ))}
        <li>
          <Link href="/about" className="flex items-center gap-3 px-5 py-4 hover:bg-surface">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-fg">About and contact</span>
              <span className="mt-0.5 block text-sm text-fg-muted">Who runs {LEGAL.appName}, and how to reach them.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-fg-faint" aria-hidden />
          </Link>
        </li>
      </ul>
    </div>
  );
}
