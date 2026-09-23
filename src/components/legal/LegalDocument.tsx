import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { LEGAL, formatLegalDate } from '@/lib/legal';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * The layout every policy shares: title, effective date, the short version
 * in plain words, a table of contents, then the sections. Readable on a
 * phone and printable.
 */
export function LegalDocument({
  title,
  shortVersion,
  sections,
}: {
  title: string;
  /** The key points in a few bullets, before the full text. */
  shortVersion?: ReactNode[];
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-fg-muted print:hidden">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/legal" className="hover:text-fg hover:underline">
              Policies
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight size={14} />
          </li>
          <li aria-current="page" className="text-fg">
            {title}
          </li>
        </ol>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Effective {formatLegalDate(LEGAL.effectiveDate)}. {LEGAL.appName} is run by {LEGAL.operatorName}.
      </p>

      {shortVersion && shortVersion.length > 0 && (
        <section aria-labelledby="short-version" className="mt-6 rounded-2xl border border-accent/25 bg-accent/5 p-5">
          <h2 id="short-version" className="text-base font-semibold">
            The short version
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[0.95rem] leading-relaxed text-fg-muted">
            {shortVersion.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-faint">This summary helps you read the full text below; the full text is what applies.</p>
        </section>
      )}

      <nav aria-label="Contents" className="mt-6 rounded-2xl border border-border bg-card p-5 print:hidden">
        <h2 className="text-sm font-semibold">Contents</h2>
        <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm text-fg-muted sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-fg hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="legal-prose mt-8 flex flex-col gap-8">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
            <h2 id={`${s.id}-title`} className="text-xl font-semibold tracking-tight">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-fg-muted">{s.body}</div>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-border pt-6 text-sm text-fg-muted">
        Questions about this policy? Write to{' '}
        <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
          {LEGAL.contactEmail}
        </a>
        . We answer within {LEGAL.responseDays} days.
      </p>
    </article>
  );
}

/** A link inside policy text. External links open in a new tab and say so to screen readers. */
export function PolicyLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:\/\//.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2 hover:no-underline">
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={href} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
      {children}
    </Link>
  );
}

/** A bulleted list inside policy text. */
export function PolicyList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Text the law wants conspicuous (warranty disclaimers, liability limits): set apart and in capitals. */
export function Conspicuous({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-border-strong bg-surface p-4 font-semibold uppercase tracking-wide text-fg">{children}</p>;
}
