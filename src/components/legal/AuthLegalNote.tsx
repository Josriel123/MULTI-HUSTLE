import Link from 'next/link';

/**
 * The notice under the sign-in and sign-up forms: where the account details
 * go (notice at collection) and what comes next. It is not the agreement
 * itself, and says so: the explicit, recorded agreement and the age question
 * happen in the app before anything is entered (AgreementGate), which is
 * where the Terms say the agreement forms.
 */
export function AuthLegalNote() {
  return (
    <p className="max-w-md text-center text-xs leading-relaxed text-fg-muted">
      Your email and sign-in are handled by Clerk, as our{' '}
      <Link href="/legal/privacy" className="font-medium text-accent underline-offset-2 hover:underline">
        Privacy Policy
      </Link>{' '}
      explains. Before you use the app, a new account is asked to confirm its age and to agree to the{' '}
      <Link href="/legal/terms" className="font-medium text-accent underline-offset-2 hover:underline">
        Terms of Service
      </Link>
      .
    </p>
  );
}
