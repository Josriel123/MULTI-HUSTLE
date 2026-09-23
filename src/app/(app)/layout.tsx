import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { AgreementGate } from '@/components/legal/AgreementGate';
import { GuidedTour } from '@/components/tour/GuidedTour';

/**
 * The signed-in app. The agreement step (Terms, Privacy Policy, 18 or older)
 * comes first and replaces the whole app until it is done; then the frame
 * (AppShell: sidebar, header, bottom tabs on phones) and, on a first visit,
 * the guided tour. Every page in this group sits behind sign-in in
 * src/proxy.ts.
 */
// The Overview's title; every other page's layout sets its own.
export const metadata: Metadata = { title: 'Overview' };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgreementGate>
      <AppShell>
        {children}
        <GuidedTour />
      </AppShell>
    </AgreementGate>
  );
}
