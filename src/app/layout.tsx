import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { CookieNotice } from '@/components/legal/CookieNotice';
import { BRAND } from '@/lib/brand';
import './globals.css';

// Self-hosted by next/font: fetched once at build time, so visitors' browsers
// never contact Google. Outfit is licensed under the SIL Open Font License 1.1
// (see THIRD_PARTY_NOTICES.md and /legal/licenses).
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: ${BRAND.tagline.toLowerCase()}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the bottom tab bar sit above the home indicator on notched phones
  // (it pads itself with env(safe-area-inset-bottom)).
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND.pageLight },
    { media: '(prefers-color-scheme: dark)', color: BRAND.pageDark },
  ],
};

/**
 * The frame every page shares: fonts, Clerk, and the cookie notice. The
 * signed-in app adds its sidebar in (app)/layout.tsx; the public pages
 * (welcome, sign-in, legal) add theirs in (public)/layout.tsx.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/welcome"
    >
      <html lang="en" className={outfit.variable} suppressHydrationWarning>
        <body className="min-h-screen bg-bg text-fg antialiased">
          {children}
          <CookieNotice />
        </body>
      </html>
    </ClerkProvider>
  );
}
