import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
