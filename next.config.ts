import type { NextConfig } from "next";

/**
 * Security headers on every response. Deliberately no full Content Security
 * Policy: Clerk and Plaid load scripts, frames and workers from their own
 * domains, and a policy that missed one would break sign-in or bank linking
 * in production where it cannot be seen in development. The CSP here only
 * stops other sites from framing the app (clickjacking) and pins <base> and
 * plugins, none of which Clerk or Plaid use.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browsers ignore this over plain http, so it is harmless on localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Plaid Link's OAuth flow can open a bank's page in a popup that must be able to report back.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The pages were renamed in plain English in the 2026-09 redesign. Old
  // bookmarks keep working; the query string (?taxYear=) is passed through.
  async redirects() {
    return [
      { source: "/deductions", destination: "/transactions", permanent: false },
      { source: "/student", destination: "/education", permanent: false },
      { source: "/export", destination: "/report", permanent: false },
    ];
  },
};

export default nextConfig;
