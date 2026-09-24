import { notFound } from 'next/navigation';
import { PreviewHarness } from './PreviewHarness';

/**
 * Dev-only preview of every page with sample data: /preview/<page>, where
 * <page> is overview, transactions, mileage, jobs, payments, education,
 * office, report, profile, account or agreement, and `?scenario=new` shows an
 * empty account. `?tour=1` starts the guided tour.
 *
 * Exists so the UI can be checked (and screenshotted) without signing in or
 * touching the database. It 404s in production, which is the guard: the
 * proxy checks nothing (D53), and the page holds no real data. Its layout,
 * src/app/(preview)/layout.tsx, is the app frame without the agreement step
 * or sign-in.
 */
export default async function PreviewPage({ params }: { params: Promise<{ page?: string[] }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page } = await params;
  return <PreviewHarness page={page?.[0] ?? 'overview'} />;
}
