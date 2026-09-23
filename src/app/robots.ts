import type { MetadataRoute } from 'next';

/** The public pages may be indexed; the app itself sits behind sign-in and the API is for the app. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/welcome', '/about', '/legal'], disallow: ['/api/', '/preview'] },
  };
}
