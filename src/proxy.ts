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

// Public routes. The Clerk webhook must stay unauthenticated: Clerk calls it
// with no session, and the Svix signature is what authenticates it.
const isPublicRoute = createRouteMatcher([
  '/api/webhooks/clerk',
])

const isApiRoute = createRouteMatcher(['/api/(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return

  // API routes authenticate themselves — every handler calls auth() or
  // requireUser() and returns a JSON 401. Calling auth.protect() here instead
  // sends a 307 to Clerk's hosted sign-in, so a fetch() whose session has
  // expired receives an HTML page and throws on res.json() rather than seeing
  // a clean 401. Let them through and answer in their own format.
  if (isApiRoute(request)) return

  // Page navigations: redirect to sign-in. This is an optimistic gate only —
  // the Next docs are explicit that Proxy is not a full authorization
  // solution, which is why the handlers above do their own checking.
  await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
