import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * Next.js 16 renamed Middleware to Proxy. Same behaviour, new filename.
 *
 * This is an *optimistic* gate only. Per the Next docs, Proxy "should not be
 * used as a full session management or authorization solution" — so every route
 * handler still calls `auth()` / `requireUser()` itself. This layer just keeps
 * signed-out users from loading a dashboard that can only render empty and
 * fire 401s.
 */

// Public: anyone may read these without an account. The policies must be
// readable before signing up (and CalOPPA wants the privacy policy linked from
// the home page), sign-in and sign-up are the way in, and the Clerk webhook is
// authenticated by its Svix signature, not a session. security.txt and
// robots.txt are for machines; the matcher below does not skip .txt files.
const isPublicRoute = createRouteMatcher([
  '/welcome',
  '/about',
  '/legal',
  '/legal/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
  '/.well-known/(.*)',
  '/robots.txt',
  '/third-party-notices.txt',
])

const isApiRoute = createRouteMatcher(['/api/(.*)'])

// The sample-data preview of the pages (src/app/(app)/preview). Outside
// production only; the page itself also 404s in production.
const isDevPreview = createRouteMatcher(['/preview', '/preview/(.*)'])

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request)) return
    if (process.env.NODE_ENV !== 'production' && isDevPreview(request)) return

    // API routes authenticate themselves — every handler calls auth() or
    // requireUser() and returns a JSON 401. Calling auth.protect() here instead
    // sends a 307 to the sign-in page, so a fetch() whose session has expired
    // receives an HTML page and throws on res.json() rather than seeing a clean
    // 401. Let them through and answer in their own format.
    if (isApiRoute(request)) return

    // A first-time visitor to the home page should learn what this is, not
    // meet a bare sign-in form.
    if (request.nextUrl.pathname === '/') {
      const { userId } = await auth()
      if (!userId) return NextResponse.redirect(new URL('/welcome', request.url))
      return
    }

    // Other page navigations: redirect to sign-in. Optimistic only — the
    // handlers above do their own checking.
    await auth.protect()
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
