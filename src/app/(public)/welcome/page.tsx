import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookCheck, Calculator, CheckCircle2, Lock, PiggyBank, Receipt, ShieldCheck, Smartphone } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { LEGAL } from '@/lib/legal';
import { plaidEnv } from '@/lib/plaid';
import { SUPPORTED_TAX_YEARS } from '@/lib/tax/parameters';

export const metadata: Metadata = {
  title: 'Know what your side hustles owe',
  description: `${LEGAL.appName} estimates the federal tax on gig, freelance and side income, and shows how much is safe to spend. Free.`,
};

/**
 * The public front door: what the app is, how it works, and its limits,
 * before anyone signs up. Every claim here is true of the code; no
 * testimonials, ratings or user counts (the FTC's rule on reviews, 16 CFR 465,
 * and its dark-patterns report), no urgency, and the limits are as visible as
 * the features.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const years = `${SUPPORTED_TAX_YEARS[0]}–${SUPPORTED_TAX_YEARS[SUPPORTED_TAX_YEARS.length - 1]}`;
  return (
    <div className="flex flex-col gap-16">
      {deleted === '1' && (
        <p role="status" className="mx-auto max-w-2xl rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm text-fg">
          Your account and all of your data have been deleted. Thank you for trying {LEGAL.appName}.
        </p>
      )}

      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-accent">Free federal tax estimator</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">Know what your side hustles owe, before tax day does.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-fg-muted">
            Driving, delivering, freelancing, selling online? {LEGAL.appName} estimates the federal tax on all of it together, shows what you have
            already paid, and tells you how much of your hustle money is safe to spend.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/sign-up" variant="primary" size="lg" trailingIcon={<ArrowRight size={18} aria-hidden />}>
              Create free account
            </LinkButton>
            <LinkButton href="/sign-in" variant="secondary" size="lg">
              Sign in
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-fg-faint">
            Free. No ads. We never sell your data. For people {LEGAL.minimumAge} and older in the {LEGAL.country}.
          </p>
        </div>

        {/* An illustration of the overview, drawn with the app's own components' look. Decorative: the figures are an example, not real data. */}
        <div aria-hidden className="rounded-3xl border border-border bg-card p-6 shadow-pop">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">Example figures</p>
          <p className="mt-3 text-sm text-fg-muted">Estimated federal tax for {SUPPORTED_TAX_YEARS[SUPPORTED_TAX_YEARS.length - 1]}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">$3,420</p>
          <div className="mt-5 rounded-xl bg-surface p-4">
            <div className="flex justify-between text-sm">
              <span className="text-fg-muted">Paid so far</span>
              <span className="font-semibold tabular-nums">$2,800</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-border">
              <div className="h-2 w-4/5 rounded-full bg-accent" />
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-fg-muted">Left to pay</span>
              <span className="font-bold tabular-nums">$620</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
            <PiggyBank size={18} className="text-accent" />
            <span>
              <span className="font-semibold text-accent">$17,330</span> <span className="text-fg-muted">safe to spend</span>
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: Receipt, title: 'Add your money in and out', body: 'Type in payouts and costs, or connect a bank through Plaid to bring them in. Pick a category for each.' },
            { icon: BookCheck, title: 'Add what else applies', body: 'A W-2 job, business miles, tax payments you made, a home office, student forms. Skip anything that does not apply.' },
            { icon: Calculator, title: 'See your estimate', body: 'What the year comes to, what is paid, what is left, and a printable report for you or a tax preparer.' },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent" aria-hidden>
                <Icon size={20} />
              </span>
              <h3 className="mt-3 font-semibold">
                <span className="sr-only">Step {i + 1}: </span>
                {title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why" className="grid gap-4 md:grid-cols-2">
        <h2 id="why" className="sr-only">
          Why people use it
        </h2>
        {[
          { icon: CheckCircle2, title: 'Shows its working', body: `Built on the IRS's published figures for tax years ${years}. The tax report goes step by step, with the form line each figure belongs on, and every estimate lists the rules it leaves out.` },
          { icon: ShieldCheck, title: 'Private by design', body: 'No ads and no analytics. We never sell your data or share it for advertising. Download everything, or delete your account and all of its data, from the Account page.' },
          { icon: Lock, title: 'Careful with your bank', body: 'Bank connections go through Plaid; we never see your bank login, and bank access tokens are encrypted before they are stored.' },
          { icon: Smartphone, title: 'Works on your phone', body: 'Add a payout or a trip from anywhere, and add it to your home screen like an app.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
            <Icon size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{body}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="limits" className="rounded-2xl border border-border bg-surface p-6">
        <h2 id="limits" className="text-lg font-semibold">
          Good to know before you start
        </h2>
        <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-fg-muted md:grid-cols-2">
          <li>It is an estimate for planning, not tax advice and not a tax return. It does not file anything.</li>
          <li>Federal income and self-employment tax only. It leaves out state tax and tax credits, among other things, and lists what it leaves out. Your actual tax may be higher or lower.</li>
          <li>Not affiliated with or endorsed by the IRS or any government agency.</li>
          {plaidEnv === 'sandbox' && (
            <li>Bank connections are in Plaid&rsquo;s test mode for now: they work with Plaid&rsquo;s test bank, not a real one. Typing entries in works for everyone.</li>
          )}
          <li>
            Read the{' '}
            <Link href="/legal/terms" className="font-medium text-accent hover:underline">
              Terms
            </Link>{' '}
            and the{' '}
            <Link href="/legal/privacy" className="font-medium text-accent hover:underline">
              Privacy Policy
            </Link>{' '}
            before you sign up. Each starts with a short summary.
          </li>
        </ul>
      </section>
    </div>
  );
}
