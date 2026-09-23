'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, Briefcase, Car, Check, GraduationCap, Home, Landmark } from 'lucide-react';
import type { SummaryResponse } from '../api';
import { cn } from '../cn';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

const DISMISS_KEY = 'multi-hustle:setup-hidden';

// localStorage as an external store, so the server render and the first
// client render agree (nothing hidden) and the stored choice applies after.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readHidden(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
function setHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(DISMISS_KEY, '1');
    else window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  listeners.forEach((l) => l());
}

interface Step {
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
}

/**
 * Getting started, on the overview until the three steps that change every
 * estimate are done: filing status, income, and a category for everything.
 * The optional extras underneath each apply to some people only.
 */
export function SetupChecklist({ data, yearHref }: { data: SummaryResponse; yearHref: (path: string) => string }) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const { counts, transactions, incomeBySource } = data;
  const uncategorised = transactions.uncategorised.incomeCount + transactions.uncategorised.expenseCount;

  const steps: Step[] = [
    {
      title: 'Tell us how you file',
      body: 'Your filing status sets the tax brackets and the standard deduction. Until you choose, the estimate assumes single.',
      href: '/profile',
      cta: 'Set filing status',
      done: data.filingStatusSource === 'profile',
    },
    {
      title: 'Add your hustle income',
      body: 'Connect a bank to bring in deposits automatically, or add income by hand.',
      href: '/transactions',
      cta: 'Add income',
      done: incomeBySource.length > 0,
    },
    {
      title: 'Give every transaction a category',
      body:
        uncategorised > 0
          ? `${uncategorised} ${uncategorised === 1 ? 'transaction needs' : 'transactions need'} one. The category decides whether money counts as income and whether a cost is deducted.`
          : 'The category decides whether money counts as income and whether a cost is deducted.',
      href: uncategorised > 0 ? '/transactions?show=uncategorised' : '/transactions',
      cta: uncategorised > 0 ? 'Review them' : 'Open transactions',
      done: counts.transactions > 0 && uncategorised === 0,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done);

  const extras = [
    { label: 'A W-2 job', href: '/jobs', icon: Briefcase, done: counts.w2Forms > 0 },
    { label: 'Business miles', href: '/mileage', icon: Car, done: counts.mileageTrips > 0 },
    { label: 'Tax payments made', href: '/payments', icon: Landmark, done: counts.estimatedPayments > 0 },
    { label: 'A home office', href: '/office', icon: Home, done: counts.hasHomeOffice },
    { label: 'School forms', href: '/education', icon: GraduationCap, done: counts.has1098T || counts.has1098E },
  ];

  return (
    <Card padding="lg" className="animate-slide-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{doneCount === 0 ? 'Welcome! Three steps to your first estimate' : 'Finish setting up'}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Multi-Hustle estimates the federal tax on your side hustles, so you know how much to set aside. {doneCount} of {steps.length} done.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
          Hide for now
        </Button>
      </div>
      <ProgressBar value={doneCount / steps.length} label={`${doneCount} of ${steps.length} setup steps done`} className="mt-4" />

      <ol className="mt-5 flex flex-col gap-2">
        {steps.map((step, i) => {
          const current = step === next;
          return (
            <li
              key={step.title}
              className={cn('flex items-start gap-3 rounded-xl border p-4 sm:items-center', current ? 'border-accent/40 bg-accent/5' : 'border-border')}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  step.done ? 'bg-accent text-on-accent' : current ? 'border-2 border-accent text-accent' : 'border border-border-strong text-fg-faint',
                )}
                aria-hidden
              >
                {step.done ? <Check size={16} strokeWidth={3} /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className={cn('font-semibold', step.done && 'text-fg-muted line-through decoration-fg-faint')}>
                    {step.title}
                    <span className="sr-only">{step.done ? ' (done)' : ''}</span>
                  </p>
                  {!step.done && <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{step.body}</p>}
                </div>
                {!step.done && (
                  <Link
                    href={yearHref(step.href)}
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg px-3 text-sm font-semibold sm:self-center',
                      current ? 'bg-accent text-on-accent hover:bg-accent/90' : 'border border-border bg-card hover:bg-surface',
                    )}
                  >
                    {step.cta}
                    <ArrowRight size={14} aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm font-medium text-fg">Does any of this apply to you? Add it and the estimate gets more accurate.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {extras.map(({ label, href, icon: Icon, done }) => (
            <li key={href}>
              <Link
                href={yearHref(href)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
                  done ? 'border-accent/30 bg-accent/5 text-accent' : 'border-border bg-card text-fg-muted hover:border-border-strong hover:text-fg',
                )}
              >
                {done ? <Check size={14} aria-hidden /> : <Icon size={14} aria-hidden />}
                {label}
                {done && <span className="sr-only"> (added)</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** Brings the checklist back after "Hide for now". */
export function ShowSetupLink() {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  if (!hidden) return null;
  return (
    <button type="button" onClick={() => setHidden(false)} className="text-sm font-medium text-accent hover:underline">
      Show the setup checklist
    </button>
  );
}
