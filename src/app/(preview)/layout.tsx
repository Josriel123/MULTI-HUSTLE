import AppShell from '@/components/AppShell';
import { GuidedTour } from '@/components/tour/GuidedTour';

/**
 * Dev-only: the app frame around the sample-data preview, without the
 * agreement step (the preview has no account to have agreed with; the
 * agreement screen itself is at /preview/agreement). See
 * preview/[[...page]]/page.tsx.
 */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <GuidedTour />
    </AppShell>
  );
}
