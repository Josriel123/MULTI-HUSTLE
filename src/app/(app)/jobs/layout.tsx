import type { Metadata } from 'next';

// The page is a client component, so its browser-tab title (which screen readers announce on each navigation) is set here.
export const metadata: Metadata = { title: 'W-2 jobs' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
