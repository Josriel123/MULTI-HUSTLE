import type { Metadata } from 'next';
import { Conspicuous, LegalDocument, PolicyLink, PolicyList } from '@/components/legal/LegalDocument';
import { LEGAL, SERVICE_PROVIDERS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `What ${LEGAL.appName} collects, why, who helps run it, and your rights.`,
};

/**
 * The Privacy Policy. Every statement here must stay true of the code: when a
 * data flow changes (a new field, a new service, a new cookie), this page and
 * src/lib/legal.ts change in the same commit (AGENTS.md). It covers what
 * CalOPPA asks for (categories collected and shared, how to review and change
 * data, how changes are announced, the effective date, Do Not Track, and
 * whether third parties track across sites), and states the CCPA-style rights
 * even though the law's thresholds are not met.
 */
export default function PrivacyPolicyPage() {
  const email = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
      {LEGAL.contactEmail}
    </a>
  );
  return (
    <LegalDocument
      title="Privacy Policy"
      shortVersion={[
        'We collect what you type into the app, what your bank sends if you connect one, and your name and email address for signing in.',
        'We use it for one thing: showing you your own tax estimate. No advertising, no analytics, no profiling, and no training of AI models.',
        'We never sell your personal information or share it for advertising. A few service providers (sign-in, bank connection, hosting) handle it only to run the service.',
        'You can download all of your data, or delete your account and everything in it, from Account & privacy at any time.',
        `${LEGAL.appName} is only for adults (${LEGAL.minimumAge} or older) in the ${LEGAL.country}.`,
      ]}
      sections={[
        {
          id: 'who',
          title: 'Who we are',
          body: (
            <>
              <p>
                {LEGAL.appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a free web app that estimates the United States federal tax on income from side
                hustles. It is run by {LEGAL.operatorName}, {LEGAL.operatorKind} in the {LEGAL.country}, who decides how and why your personal
                information is used and is responsible for it.
              </p>
              <p>
                Contact: {email}. {LEGAL.mailingAddress ? `Postal address: ${LEGAL.mailingAddress}.` : 'A postal address for legal notices is available on request by email.'}
              </p>
              <p>This policy applies to the {LEGAL.appName} website and app. It does not cover other companies&rsquo; websites we link to.</p>
            </>
          ),
        },
        {
          id: 'collect',
          title: 'What we collect',
          body: (
            <>
              <p>
                <strong className="text-fg">Your account.</strong> Your name and email address, and the identifier our sign-in provider, Clerk, gives your
                account. Your password, sign-in codes and sessions are held by Clerk, not by us.
              </p>
              <p>
                <strong className="text-fg">What you enter.</strong> Everything you type into the app to build your estimate:
              </p>
              <PolicyList
                items={[
                  'your filing status, whether someone can claim you as a dependent, and (if married filing separately) whether your spouse itemizes;',
                  'income and expenses: the amount, date, description, category and which of your hustles it belongs to;',
                  'business trips: the date, miles and purpose;',
                  'W-2 amounts from an employer (wages, tax withheld and similar boxes) and the name you give the job;',
                  'estimated tax payments: the date, amount and an optional note;',
                  'amounts from Forms 1098-T and 1098-E (tuition, scholarships, student loan interest);',
                  'home office size and your rent and utilities.',
                ]}
              />
              <p>
                We do not ask for, and you should not enter, your Social Security number, taxpayer identification numbers, bank account numbers or card
                numbers.
              </p>
              <p>
                <strong className="text-fg">From your bank, only if you connect one.</strong> Through Plaid, for each transaction: the date, the amount and
                the description your bank shows. We also keep the access token Plaid issues for the connection, encrypted, and Plaid&rsquo;s identifier for
                it. We never see or store your bank login, and we do not store account numbers or balances.
              </p>
              <p>
                <strong className="text-fg">Your agreement.</strong> Which version of the Terms of Service and this policy you agreed to, when, and that you
                confirmed you are {LEGAL.minimumAge} or older.
              </p>
              <p>
                <strong className="text-fg">Technical information.</strong> Like every website, our host (see below) receives your IP address and basic
                browser details when you visit and keeps short-lived request logs to run and protect the service. We do not use them to identify or follow
                you.
              </p>
              <p>
                <strong className="text-fg">Cookies and browser storage.</strong> Only what is needed to keep you signed in and to remember a few choices.
                There are no analytics, advertising or tracking cookies. The <PolicyLink href="/legal/cookies">Cookie Policy</PolicyLink> lists them.
              </p>
            </>
          ),
        },
        {
          id: 'use',
          title: 'How we use it',
          body: (
            <>
              <p>Only to provide {LEGAL.appName} to you:</p>
              <PolicyList
                items={[
                  'to work out and show your federal tax estimate and the tax report;',
                  'to keep you signed in and your account secure;',
                  'to bring in your bank transactions when you connect a bank or ask to sync;',
                  'to answer you when you write to us;',
                  'to protect the service and its users from misuse, and to comply with the law.',
                ]}
              />
              <p>
                We do not use your information for advertising, marketing, profiling, or training artificial intelligence, and we do not sell it. We treat
                the tax information you enter as confidential and use it only to produce your own estimate, which is the standard federal law sets for tax
                return preparers, even though {LEGAL.appName} does not prepare or file returns.
              </p>
              <p>
                If you are in the European Economic Area or the United Kingdom (the service is not offered there, see below), we rely on the need to
                provide the service you asked for, our legitimate interest in keeping it secure, and our legal obligations.
              </p>
            </>
          ),
        },
        {
          id: 'share',
          title: 'Who we share it with',
          body: (
            <>
              <p>
                We do not sell your personal information, and we do not share it for advertising (&ldquo;sell&rdquo; and &ldquo;share&rdquo; as California
                law uses those words). These service providers handle it on our behalf, only to run the service, under their own terms and privacy policies:
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-xs uppercase tracking-[0.06em] text-fg-faint">
                      <th scope="col" className="px-4 py-2 font-semibold">Provider</th>
                      <th scope="col" className="px-4 py-2 font-semibold">What for</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Their policy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SERVICE_PROVIDERS.map((p) => (
                      <tr key={p.name}>
                        <td className="px-4 py-2.5 font-medium text-fg">{p.name}</td>
                        <td className="px-4 py-2.5">{p.purpose}</td>
                        <td className="px-4 py-2.5">
                          <PolicyLink href={p.policy}>Privacy policy</PolicyLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong className="text-fg">Bank connections through Plaid.</strong> If you choose to connect a bank, Plaid Inc. collects information from
                your bank under its own{' '}
                <PolicyLink href="https://plaid.com/legal/#end-user-privacy-policy">End User Privacy Policy</PolicyLink>, and passes us the transactions
                described above. By connecting a bank you acknowledge that policy. You can see and remove your Plaid connections at{' '}
                <PolicyLink href="https://my.plaid.com">my.plaid.com</PolicyLink>, and disconnecting or deleting your account here also tells Plaid to stop
                accessing your bank for {LEGAL.appName}.
              </p>
              <p>
                We may also disclose information if the law requires it (for example, a valid court order), to protect someone&rsquo;s safety, or to
                investigate fraud or misuse of the service. If {LEGAL.appName} is ever transferred to someone else, your information would go with it only
                under this policy, and we would tell you first so you could delete your account.
              </p>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'How long we keep it',
          body: (
            <>
              <PolicyList
                items={[
                  'Everything in your account is kept until you delete it or your account.',
                  `When you delete your account, everything is deleted at once. Encrypted database backups kept by our host for recovery expire on their own within ${LEGAL.backupRetentionDays} days.`,
                  'When you disconnect a bank, we tell Plaid to stop accessing it and delete the access token. Transactions already brought in stay, as part of your records, until you delete them.',
                  'Request logs kept by our host expire after a short period set by the host.',
                ]}
              />
            </>
          ),
        },
        {
          id: 'security',
          title: 'How we protect it',
          body: (
            <>
              <p>
                Everything travels over encrypted connections (HTTPS). The database is encrypted at rest by its host, and bank access tokens are encrypted
                again, with AES-256, before they are stored. Sign-in is handled by Clerk, which supports two-step verification. Only the operator can
                reach the database. We never store bank logins.
              </p>
              <p>
                No system is perfectly secure. If a breach ever affects your information, we will tell you by email without unreasonable delay and as the
                law of your state requires.
              </p>
            </>
          ),
        },
        {
          id: 'rights',
          title: 'Your rights and choices',
          body: (
            <>
              <p>Wherever you live, you can:</p>
              <PolicyList
                items={[
                  <>
                    <strong className="text-fg">get a copy</strong> of everything we store about you, as a file you can take elsewhere: Account &amp; privacy,
                    &ldquo;Download my data&rdquo;;
                  </>,
                  <>
                    <strong className="text-fg">correct</strong> it: edit or delete any entry in the app;
                  </>,
                  <>
                    <strong className="text-fg">delete</strong> your account and everything in it: Account &amp; privacy, &ldquo;Delete my account&rdquo;, or
                    see <PolicyLink href="/legal/data-deletion">how to delete or download your data</PolicyLink>;
                  </>,
                  <>
                    <strong className="text-fg">ask us</strong> about any of this by writing to {email}.
                  </>,
                ]}
              />
              <p>
                We answer requests within {LEGAL.responseDays} days. To protect your account we may ask you to write from the email address on it. You can
                ask someone to make a request for you; we will need your confirmation. We will never treat you differently for using these rights. If we
                cannot do what you ask, we will explain why, and you can ask us to reconsider by replying.
              </p>
              <p>
                California residents: we do not sell or share personal information and do not disclose it to anyone for their own marketing. Residents of
                the EEA and UK also have rights to object to or restrict processing and to complain to a data protection authority.
              </p>
            </>
          ),
        },
        {
          id: 'dnt',
          title: 'Do Not Track and Global Privacy Control',
          body: (
            <p>
              We do not track you across other websites, and no third party collects information about your activity across websites through{' '}
              {LEGAL.appName}. Because there is no tracking to stop, &ldquo;Do Not Track&rdquo; and Global Privacy Control signals do not change how the
              service works; if we ever used information in a way these signals opt out of, we would honor them.
            </p>
          ),
        },
        {
          id: 'children',
          title: 'Children',
          body: (
            <p>
              {LEGAL.appName} is only for people {LEGAL.minimumAge} and older, and every user confirms their age before using it. We do not knowingly
              collect information from anyone younger, including children under 13. Anyone who says they are under {LEGAL.minimumAge} is offered
              deletion of their account on the spot. If you believe a minor has used the service, write to {email} and we will delete the account.
            </p>
          ),
        },
        {
          id: 'where',
          title: 'Where the service is offered',
          body: (
            <p>
              {LEGAL.appName} estimates United States federal tax and is intended for residents of the {LEGAL.country}. It is not offered to people in
              the European Economic Area or the United Kingdom. Your information is stored and processed in the {LEGAL.country}.
            </p>
          ),
        },
        {
          id: 'email',
          title: 'Emails',
          body: (
            <p>
              We do not send marketing email. Clerk sends the emails your account needs (sign-in codes, verification and security notices). These are
              part of having an account, so they do not have an unsubscribe link. If we ever send any other kind of email, it will only be to people who
              asked for it, and every one will have a working unsubscribe link and our postal address.
            </p>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to this policy',
          body: (
            <p>
              When this policy changes, the effective date at the top changes. If a change matters to how your information is used, we will ask you to
              read and agree to the new version in the app before you continue, and we may also email you. We keep every earlier version and will send
              you any of them on request.
            </p>
          ),
        },
        {
          id: 'contact',
          title: 'Contact',
          body: (
            <>
              <p>
                {LEGAL.operatorName}, {email}. {LEGAL.mailingAddress ? `Postal address: ${LEGAL.mailingAddress}.` : 'Postal address available on request.'}
              </p>
              <Conspicuous>We never sell your personal information.</Conspicuous>
            </>
          ),
        },
      ]}
    />
  );
}
