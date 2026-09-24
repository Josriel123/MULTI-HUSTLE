import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import AppShell from '@/components/AppShell';
import { AgreementGate } from '@/components/legal/AgreementGate';
import { SignedOutRedirect } from '@/components/SignedOutRedirect';
import { GuidedTour } from '@/components/tour/GuidedTour';

/**
 * The signed-in app. Signed out, a page load goes to sign-in: auth.protect()
 * here on the server, and SignedOutRedirect in the browser for a session that
 * ends mid-visit (D53); the proxy checks nothing. The pages hold no data of
 * their own: everything comes from API routes that authenticate each request.
 * Then the agreement step (Terms, Privacy Policy, 18 or older) replaces the
 * whole app until it is done, then the frame (AppShell: sidebar, header,
 * bottom tabs on phones) and, on a first visit, the guided tour.
 */
// The Overview's title; every other page's layout sets its own.
export const metadata: Metadata = { title: 'Overview' };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await auth.protect();
  return (
    <>
      <SignedOutRedirect />
      <AgreementGate>
        <AppShell>
          {children}
          <GuidedTour />
        </AppShell>
      </AgreementGate>
    </>
  );
}
