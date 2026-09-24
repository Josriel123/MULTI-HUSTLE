import { NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Next.js 16 renamed Middleware to Proxy. Same behaviour, new filename.
 *
 * The proxy makes the Clerk session available to every request and does no
 * auth checks (D53). Protection lives with what it protects: the app's pages
 * in src/app/(app)/layout.tsx (auth.protect() on the server, a signed-out
 * redirect in the browser), and every API route calls auth() or requireUser()
 * and answers 401 itself. A list of paths here could drift from how Next
 * actually routes a request and leave something reachable, which is why Clerk
 * deprecated createRouteMatcher; src/app/__tests__/auth-boundaries.test.ts
 * keeps the checks where they belong.
 */
export default clerkMiddleware(
  async (auth, request) => {
    // Not protection, a front door: a signed-out visitor to the home page
    // learns what this is instead of meeting a sign-in form. The Overview is
    // protected by its layout either way.
    if (request.nextUrl.pathname === '/') {
      const { userId } = await auth()
      if (!userId) return NextResponse.redirect(new URL('/welcome', request.url))
    }
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
