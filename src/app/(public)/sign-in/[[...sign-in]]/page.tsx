import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { AuthLegalNote } from '@/components/legal/AuthLegalNote';

export const metadata: Metadata = { title: 'Sign in' };

/** Clerk's sign-in form on our own page, so the legal notice sits right under it. */
export default function SignInPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
      <AuthLegalNote />
    </div>
  );
}
