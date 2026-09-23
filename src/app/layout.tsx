import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import AppShell from '@/components/AppShell';
import './globals.css';

// Self-hosted by next/font: no request to Google at runtime, no layout shift.
// The CSS variable is what `--font-sans` in globals.css resolves to.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Multi-Hustle: side-hustle tax estimator',
  description: 'See what your side hustles owe in federal tax, what is already paid, and what is safe to spend. A cited planning estimate, not tax advice.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={outfit.variable} suppressHydrationWarning>
        <body className="min-h-screen bg-bg text-fg antialiased">
          <AppShell>{children}</AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
