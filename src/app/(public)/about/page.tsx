import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'About and contact',
  description: `Who runs ${LEGAL.appName}, what it is, and how to get in touch.`,
};

/** Business details: who is responsible for the service and how to reach them. */
export default function AboutPage() {
  const rows: [string, React.ReactNode][] = [
    ['Service', `${LEGAL.appName}, a free web app that estimates US federal tax on side-hustle income`],
    ['Run by', `${LEGAL.operatorName}, ${LEGAL.operatorKind}`],
    ['Based in', `${LEGAL.location}, ${LEGAL.country}`],
    [
      'Email',
      <a key="e" href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
        {LEGAL.contactEmail}
      </a>,
    ],
    ['Postal address', LEGAL.mailingAddress ?? 'Available on request by email'],
    ['Price', 'Free: no fees, subscriptions or ads'],
    ['Replies', `Within ${LEGAL.responseDays} days for privacy requests; we aim for five business days on accessibility`],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">About {LEGAL.appName}</h1>
      <div className="mt-4 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-fg-muted">
        <p>
          {LEGAL.appName} helps people with gig, freelance and side income see what they are likely to owe in federal tax, how much of it is already
          paid, and how much of their money is safe to spend. It applies the IRS&rsquo;s published figures for each tax year to what you enter, and the
          tax report shows the form line each figure belongs on.
        </p>
        <p>
          It is a planning tool made by one person. It is not a tax preparer, does not file returns or send payments, and is not affiliated with or
          endorsed by the IRS or any government agency. Nothing in it is tax, legal or financial advice.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <dl className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium text-fg">{k}</dt>
            <dd className="text-fg-muted">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <Mail size={16} aria-hidden />
        For your data, see{' '}
        <Link href="/legal/data-deletion" className="font-medium text-accent hover:underline">
          delete or download your data
        </Link>
        ; for everything else, the{' '}
        <Link href="/legal" className="font-medium text-accent hover:underline">
          policies
        </Link>
        .
      </p>
    </div>
  );
}
