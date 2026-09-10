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

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
