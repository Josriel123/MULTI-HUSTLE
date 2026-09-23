'use client';

import EducationPage from '@/app/education/page';
import JobsPage from '@/app/jobs/page';
import MileagePage from '@/app/mileage/page';
import HomeOfficePage from '@/app/office/page';
import Overview from '@/app/page';
import PaymentsPage from '@/app/payments/page';
import ProfilePage from '@/app/profile/page';
import ReportPage from '@/app/report/page';
import TransactionsPage from '@/app/transactions/page';
import { previewData, previewResponse, type Scenario } from './fixtures';

/**
 * Dev-only: the real pages, fed sample data instead of the API.
 *
 * `window.fetch` is replaced when this module first loads in the browser,
 * which is before any page component renders, so the pages' own requests
 * (issued from effects, children first) all see the fixtures. Only same-origin
 * `/api/` calls are answered; Clerk and everything else pass through. Writes
 * succeed without storing anything, so forms can be tried but nothing sticks.
 */

const PAGES = {
  overview: Overview,
  transactions: TransactionsPage,
  mileage: MileagePage,
  jobs: JobsPage,
  payments: PaymentsPage,
  education: EducationPage,
  office: HomeOfficePage,
  report: ReportPage,
  profile: ProfilePage,
} as const;

function scenarioFromUrl(): Scenario {
  return new URLSearchParams(window.location.search).get('scenario') === 'new' ? 'new' : 'demo';
}

if (typeof window !== 'undefined' && !(window as { __previewFetch?: boolean }).__previewFetch) {
  (window as { __previewFetch?: boolean }).__previewFetch = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    // Only while on a preview page: after navigating to a real page, real data.
    const onPreview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
    if (!onPreview || url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    // A short delay, so loading states are visible the way they are for real.
    await new Promise((r) => setTimeout(r, 120));
    if (method !== 'GET' && url.pathname !== '/api/plaid/create_link_token') return json({ success: true, merged: false, count: 0, removed: 0 });
    const body = previewResponse(previewData(scenarioFromUrl()), url.pathname);
    return body === null ? json({ error: `No preview fixture for ${url.pathname}` }, 404) : json(body);
  };
}

export function PreviewHarness({ page }: { page: string }) {
  const Page = PAGES[page as keyof typeof PAGES] ?? Overview;
  return <Page />;
}
