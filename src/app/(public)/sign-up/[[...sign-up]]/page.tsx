import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { AuthLegalNote } from '@/components/legal/AuthLegalNote';
import { UnderageBlock } from '@/components/legal/UnderageBlock';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Create your free account' };

/**
 * Sign-up. The account cannot be used until the person has ticked "I am 18 or
 * older" and agreed to the Terms in the app (AgreementGate), which records
 * it; the age question is not answered for them here. On a device where
 * someone said they are under 18, the form is replaced (UnderageBlock).
 * Clerk's card carries the page's heading, so this page adds only a line.
 */
export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="max-w-md text-center text-sm leading-relaxed text-fg-muted">
        {LEGAL.appName} is free, has no ads, and never sells your data.
      </p>
      <UnderageBlock>
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      </UnderageBlock>
      <AuthLegalNote />
    </div>
  );
}
