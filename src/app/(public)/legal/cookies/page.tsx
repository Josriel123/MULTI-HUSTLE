import type { Metadata } from 'next';
import { LegalDocument, PolicyLink, PolicyList } from '@/components/legal/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: `The cookies and browser storage ${LEGAL.appName} uses: only what keeps you signed in and remembers your choices.`,
};

const STORAGE = [
  { name: 'multi-hustle:cookie-notice', purpose: 'Remembers that you have seen the cookie notice, so it does not keep appearing.' },
  { name: 'multi-hustle:tour', purpose: 'Remembers that you have finished or skipped the guided tour.' },
  { name: 'multi-hustle:setup-hidden', purpose: 'Remembers that you hid the setup checklist on the Overview.' },
  { name: 'multi-hustle:underage', purpose: 'Remembers, on this device, an answer that someone is under 18, so sign-up stays closed here. It holds no name or account.' },
];

/**
 * The Cookie Policy. Kept in step with the code: a new cookie or storage key
 * is added to this page, and NOTICE_VERSION in CookieNotice is bumped so
 * everyone sees the notice again.
 */
export default function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      shortVersion={[
        'We use only essential cookies, to keep you signed in and secure.',
        'Your browser also stores a few of your choices, like having finished the tour. They never leave your device.',
        'No analytics, advertising, social media or tracking cookies, so there is nothing to opt out of.',
      ]}
      sections={[
        {
          id: 'what',
          title: 'What cookies and browser storage are',
          body: (
            <p>
              Cookies are small files a website asks your browser to keep and send back on later visits. Browser storage (&ldquo;local storage&rdquo;) is
              similar, but its contents stay on your device and are not sent to the website.
            </p>
          ),
        },
        {
          id: 'essential',
          title: 'Essential cookies',
          body: (
            <>
              <p>
                These are strictly necessary: without them you cannot sign in or stay signed in. They are set by Clerk, our sign-in provider, and include{' '}
                <code className="rounded bg-surface px-1 text-sm">__session</code> and{' '}
                <code className="rounded bg-surface px-1 text-sm">__client_uat</code> on this site, and a cookie on Clerk&rsquo;s own sign-in domain that
                keeps your session secure. Clerk may also use short-lived security cookies to block automated abuse. Exact names can change as Clerk updates
                its service; see <PolicyLink href="https://clerk.com/legal/privacy">Clerk&rsquo;s privacy policy</PolicyLink>.
              </p>
              <p>
                If you connect a bank, Plaid&rsquo;s connection window runs Plaid&rsquo;s own code, which may use cookies on Plaid&rsquo;s domain for
                security and fraud prevention, under{' '}
                <PolicyLink href="https://plaid.com/legal/#end-user-privacy-policy">Plaid&rsquo;s End User Privacy Policy</PolicyLink>. Nothing from Plaid
                is loaded, and Plaid is not contacted, until you press &ldquo;Connect a bank&rdquo;.
              </p>
            </>
          ),
        },
        {
          id: 'storage',
          title: 'Choices remembered in your browser',
          body: (
            <>
              <p>These are kept in your browser&rsquo;s local storage and never sent to us:</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-xs uppercase tracking-[0.06em] text-fg-faint">
                      <th scope="col" className="px-4 py-2 font-semibold">Name</th>
                      <th scope="col" className="px-4 py-2 font-semibold">What it does</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {STORAGE.map((s) => (
                      <tr key={s.name}>
                        <td className="px-4 py-2.5">
                          <code className="text-sm text-fg">{s.name}</code>
                        </td>
                        <td className="px-4 py-2.5">{s.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Each exists only because you did something (dismissed a notice, finished the tour); clearing your browser&rsquo;s site data removes them.</p>
            </>
          ),
        },
        {
          id: 'none',
          title: 'What we do not use',
          body: (
            <PolicyList
              items={[
                'No analytics or statistics cookies.',
                'No advertising, retargeting or social media cookies or pixels.',
                'No cookies that follow you across other websites.',
                'The font is served from our own site, so loading a page does not contact Google or any other font service.',
              ]}
            />
          ),
        },
        {
          id: 'control',
          title: 'Your choices',
          body: (
            <p>
              Because every cookie we use is essential, there is no setting to switch any of them off inside the app. You can block or delete cookies in
              your browser&rsquo;s settings, but blocking the essential ones will stop sign-in from working. If we ever want to use a cookie that is not
              essential, we will ask first, with a clear way to say no, and update this policy.
            </p>
          ),
        },
      ]}
    />
  );
}
