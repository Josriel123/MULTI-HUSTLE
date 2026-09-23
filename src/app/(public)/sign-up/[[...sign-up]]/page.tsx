import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { AuthLegalNote } from '@/components/legal/AuthLegalNote';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Create your free account' };

/**
 * Sign-up. The age requirement is stated before the form, not after, and the
 * account itself cannot be used until the person has ticked "I am 18 or older"
 * and agreed to the Terms in the app (AgreementGate), which records it.
 */
export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create your free account</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {LEGAL.appName} is free, has no ads, and never sells your data. You must be {LEGAL.minimumAge} or older to use it.
        </p>
      </div>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      <AuthLegalNote action="creating an account" />
    </div>
  );
}
