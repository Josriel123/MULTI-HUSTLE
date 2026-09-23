import { PublicShell } from '@/components/legal/PublicShell';

/** Pages anyone can read without an account: the welcome page, sign-in and sign-up, and every policy. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
