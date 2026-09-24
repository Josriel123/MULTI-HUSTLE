'use client';

import { RedirectToSignIn, Show } from '@clerk/nextjs';

/**
 * The browser half of protecting the app (D53). The (app) layout's
 * auth.protect() stops a signed-out page load on the server, but a layout
 * does not run again on every client-side navigation, so a session that ends
 * mid-visit (signing out in another tab, an expired session) would otherwise
 * leave an empty frame answering 401s. This sends the person to sign in,
 * coming back to where they were. Rendered beside the page, not around it,
 * so nothing waits for Clerk to load.
 */
export function SignedOutRedirect() {
  return (
    <Show when="signed-out">
      <RedirectToSignIn />
    </Show>
  );
}
