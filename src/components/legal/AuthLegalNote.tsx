import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/**
 * The notice under the sign-in and sign-up forms. A notice, not the
 * agreement itself: the explicit, recorded agreement (and the age
 * confirmation) happens in the app before any data is entered.
 */
export function AuthLegalNote({ action }: { action: string }) {
  return (
    <p className="max-w-md text-center text-xs leading-relaxed text-fg-muted">
      By {action} you confirm you are {LEGAL.minimumAge} or older and agree to the{' '}
      <Link href="/legal/terms" className="font-medium text-accent underline-offset-2 hover:underline">
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link href="/legal/privacy" className="font-medium text-accent underline-offset-2 hover:underline">
        Privacy Policy
      </Link>
      . Your email and sign-in are handled by Clerk.
    </p>
  );
}
