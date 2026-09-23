import type { Metadata } from 'next';
import { Conspicuous, LegalDocument, PolicyLink, PolicyList } from '@/components/legal/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The rules for using ${LEGAL.appName}, and what it is and is not.`,
};

/**
 * The Terms of Service, agreed to by clickwrap (AgreementGate records the
 * version and the time). Choices worth knowing when editing:
 *  - Warranty and liability limits are conspicuous (capitals, set apart).
 *  - No "void where prohibited" or "may not apply to you" wording: New
 *    Jersey's TCCWNA penalizes it. The carve-outs say exactly what is not
 *    limited instead.
 *  - Courts, with a small-claims option, rather than arbitration: for a free
 *    tool, mass-arbitration fees are a larger risk than a class action.
 *  - California residents get the Department of Consumer Affairs contact. It is
 *    not framed as the Civil Code §1789.3 notice: that section is about paid
 *    services, and this one is free.
 */
export default function TermsPage() {
  const email = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
      {LEGAL.contactEmail}
    </a>
  );
  const law = LEGAL.governingState ? `the laws of the State of ${LEGAL.governingState}` : 'the laws of the state in the United States where the operator lives';
  const courts = LEGAL.governingState
    ? `the state or federal courts located in ${LEGAL.venueCounty ? `${LEGAL.venueCounty}, ` : ''}${LEGAL.governingState}`
    : 'the state or federal courts where the operator lives';
  return (
    <LegalDocument
      title="Terms of Service"
      shortVersion={[
        `${LEGAL.appName} is free. It estimates your federal tax for planning. It is not tax advice, it does not file anything, and it is not connected with the IRS.`,
        'Estimates can be wrong. Check anything important with a tax professional before you rely on it; you are responsible for your own tax return and payments.',
        `You must be ${LEGAL.minimumAge} or older and live in the ${LEGAL.country}. Your data stays yours, and you can delete it at any time.`,
        'The service is provided as it is, and our responsibility to you is limited, as explained below.',
      ]}
      sections={[
        {
          id: 'agreement',
          title: 'Agreeing to these terms',
          body: (
            <p>
              These terms are an agreement between you and {LEGAL.operatorName}, who runs {LEGAL.appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You agree
              to them, and to the <PolicyLink href="/legal/privacy">Privacy Policy</PolicyLink>, when you tick the boxes and choose &ldquo;Agree and
              continue&rdquo; in the app, before you use it. If you do not agree, do not use {LEGAL.appName}.
            </p>
          ),
        },
        {
          id: 'eligibility',
          title: 'Who can use it',
          body: (
            <PolicyList
              items={[
                `You must be at least ${LEGAL.minimumAge} years old.`,
                `${LEGAL.appName} is intended for residents of the ${LEGAL.country} and is not offered in the European Economic Area or the United Kingdom.`,
                'One account per person, for your own taxes (and, on a joint return, your spouse’s figures with their permission).',
                'Keep your sign-in details to yourself and tell us straight away if you think someone else has used your account.',
              ]}
            />
          ),
        },
        {
          id: 'what-it-is',
          title: 'What Multi-Hustle is, and is not',
          body: (
            <>
              <p>
                {LEGAL.appName} applies published federal tax rules to the information you enter and shows an estimate of your federal income and
                self-employment tax, for planning. Each estimate says which tax year&rsquo;s IRS figures it uses and lists what it leaves out.
              </p>
              <PolicyList
                items={[
                  'It is not tax, legal, accounting, investment or financial advice, and using it does not create a professional relationship of any kind.',
                  'It is not a tax return and does not prepare or file one. It does not send payments to the IRS or anyone else.',
                  'It is not affiliated with, endorsed by or connected to the Internal Revenue Service or any other government agency.',
                  'It covers federal tax only. State and local taxes, tax credits and many other rules are not included; the estimate shows the full list.',
                ]}
              />
              <p>
                An estimate is only as good as the information behind it, and tax law changes. It can be higher or lower than what you actually owe.
                Before making a decision that matters, such as how much to pay the IRS, check with a qualified tax professional or IRS resources. You are
                responsible for your own tax returns, payments and records.
              </p>
            </>
          ),
        },
        {
          id: 'free',
          title: 'Price',
          body: (
            <p>
              {LEGAL.appName} is free. There are no fees, subscriptions or in-app purchases, and we never ask for payment details. If we ever offer
              something paid, we will say so clearly and in advance, and nothing will be charged without your separate, explicit agreement. See the{' '}
              <PolicyLink href="/legal/refunds">Refund Policy</PolicyLink>.
            </p>
          ),
        },
        {
          id: 'your-data',
          title: 'Your information',
          body: (
            <p>
              The information you enter is yours. You allow us to store and process it only to provide {LEGAL.appName} to you, as the Privacy Policy
              describes. You can download it or delete it, with your account, at any time from Account &amp; privacy. Please enter only your own
              information, or information you have permission to use.
            </p>
          ),
        },
        {
          id: 'banks',
          title: 'Bank connections',
          body: (
            <p>
              Connecting a bank is optional. It works through Plaid, which has its own terms and{' '}
              <PolicyLink href="https://plaid.com/legal/#end-user-privacy-policy">End User Privacy Policy</PolicyLink>. When you connect, you authorize us to
              receive your transactions from Plaid for use in {LEGAL.appName}. You can disconnect at any time. Transactions come from your bank as your bank
              reports them; check them before relying on them.
            </p>
          ),
        },
        {
          id: 'acceptable-use',
          title: 'Using it fairly',
          body: (
            <>
              <p>You agree not to:</p>
              <PolicyList
                items={[
                  'use the service for anything unlawful, or to mislead a tax authority or anyone else;',
                  'try to get into accounts, data or systems that are not yours, or test or bypass the service’s security;',
                  'overload, disrupt, copy at scale, or scrape the service, or use automated means to access it except as we allow;',
                  'upload malicious code or anything that infringes someone else’s rights.',
                ]}
              />
            </>
          ),
        },
        {
          id: 'ip',
          title: 'Our rights',
          body: (
            <p>
              {LEGAL.appName}, its design, text and code belong to {LEGAL.operatorName}, except the open-source software and fonts it uses, which belong to
              their authors and are used under their licenses (see <PolicyLink href="/legal/licenses">Licenses and credits</PolicyLink>). These terms do not
              give you any right to our name or branding.
            </p>
          ),
        },
        {
          id: 'availability',
          title: 'Changes to the service',
          body: (
            <p>
              We may improve, change, pause or stop parts of the service. We try to keep it running, but it may sometimes be unavailable or contain
              mistakes. If we ever shut the service down, we will give you reasonable notice so you can download your data first.
            </p>
          ),
        },
        {
          id: 'ending',
          title: 'Ending this agreement',
          body: (
            <p>
              You can stop at any time by deleting your account from Account &amp; privacy; your data is then deleted as the Privacy Policy describes. We
              may suspend or close an account that breaks these terms or puts the service or other people at risk, and will tell you why unless the law or
              safety prevents it. The sections on disclaimers, liability, disputes and general terms continue after the agreement ends.
            </p>
          ),
        },
        {
          id: 'warranty',
          title: 'Disclaimer of warranties',
          body: (
            <Conspicuous>
              {LEGAL.appName} is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the fullest extent the law allows, we make no warranties of
              any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, title, non-infringement, and that the
              estimates are accurate, complete or current, or that the service will be uninterrupted or error-free.
            </Conspicuous>
          ),
        },
        {
          id: 'liability',
          title: 'Limitation of liability',
          body: (
            <>
              <Conspicuous>
                To the fullest extent the law allows, we will not be liable for any indirect, incidental, special, consequential or punitive damages, or
                for lost profits, lost data, or any taxes, penalties or interest you owe, arising from your use of {LEGAL.appName}. Our total liability for
                all claims relating to the service is limited to one hundred US dollars ($100).
              </Conspicuous>
              <p>
                These limits do not apply to liability for fraud, gross negligence, willful misconduct, death or personal injury, or to any other liability
                that the law does not allow to be limited or excluded.
              </p>
            </>
          ),
        },
        {
          id: 'indemnity',
          title: 'Your responsibility to us',
          body: (
            <p>
              If you break these terms or the law in using {LEGAL.appName}, and someone brings a claim against us because of it, you agree to cover the
              reasonable costs of that claim, to the extent the law allows.
            </p>
          ),
        },
        {
          id: 'disputes',
          title: 'Disputes',
          body: (
            <>
              <p>
                If you have a problem, write to {email} first; most things can be sorted out that way, and we will try within 30 days. These terms are
                governed by {law}, and by United States federal law, without regard to conflict-of-law rules. Any dispute that we cannot resolve informally
                will be decided by {courts}, except that either of us may bring a claim in small-claims court where you live if it qualifies.
              </p>
            </>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to these terms',
          body: (
            <p>
              If we change these terms, we will update the effective date. If a change matters, we will ask you to read and agree to the new terms in the
              app before you continue using it. If you do not agree, you can delete your account and stop using the service.
            </p>
          ),
        },
        {
          id: 'california',
          title: 'California residents',
          body: (
            <p>
              {LEGAL.appName} is provided free of charge by {LEGAL.operatorName} ({email}
              {LEGAL.mailingAddress ? `, ${LEGAL.mailingAddress}` : '; postal address on request'}). California residents may contact the Complaint
              Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market
              Blvd., Suite N 112, Sacramento, CA 95834, or by telephone at (800) 952-5210.
            </p>
          ),
        },
        {
          id: 'general',
          title: 'General',
          body: (
            <PolicyList
              items={[
                'These terms, with the Privacy Policy, are the whole agreement between you and us about the service.',
                'If a court finds part of these terms unenforceable, the rest still applies.',
                'If we do not enforce a term straight away, we can still enforce it later.',
                'You may not transfer this agreement. We may transfer it if the service is transferred to someone who takes on these terms and the Privacy Policy.',
                'We will send notices to the email address on your account or show them in the app.',
              ]}
            />
          ),
        },
      ]}
    />
  );
}
