import type { Metadata } from 'next';
import { LegalDocument, PolicyLink } from '@/components/legal/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: `${LEGAL.appName} is free, so there is nothing to refund.`,
};

export default function RefundPolicyPage() {
  const email = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
      {LEGAL.contactEmail}
    </a>
  );
  return (
    <LegalDocument
      title="Refund Policy"
      shortVersion={[
        `${LEGAL.appName} is free. No subscriptions, no in-app purchases, no hidden fees.`,
        'We never ask for card or payment details, so nothing can be charged and there is nothing to refund.',
      ]}
      sections={[
        {
          id: 'free',
          title: 'There is nothing to pay',
          body: (
            <p>
              Every part of {LEGAL.appName} is free to use. We do not sell subscriptions, upgrades or add-ons, we do not collect payment details, and no
              feature is held back behind a payment. Connecting a bank through Plaid is free too.
            </p>
          ),
        },
        {
          id: 'charges',
          title: 'If you see a charge',
          body: (
            <p>
              Any charge claiming to be from {LEGAL.appName} is not from us. Contact your bank or card issuer, and please tell us at {email} so we can warn
              others. Fees your own bank charges for its accounts are between you and your bank.
            </p>
          ),
        },
        {
          id: 'future',
          title: 'If this ever changes',
          body: (
            <p>
              If we ever offer something paid, the price, what you get, and the refund terms will be shown before you decide, and nothing will be charged
              without your separate, explicit agreement. This page and the <PolicyLink href="/legal/terms">Terms of Service</PolicyLink> will be updated
              first.
            </p>
          ),
        },
      ]}
    />
  );
}
