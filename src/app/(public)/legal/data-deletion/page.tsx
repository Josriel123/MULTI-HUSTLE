import type { Metadata } from 'next';
import { LegalDocument, PolicyLink, PolicyList } from '@/components/legal/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Delete or download your data',
  description: `How to get a copy of everything ${LEGAL.appName} stores about you, or delete it.`,
};

export default function DataDeletionPage() {
  const email = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
      {LEGAL.contactEmail}
    </a>
  );
  return (
    <LegalDocument
      title="Delete or download your data"
      shortVersion={[
        'Signed in: open Account & privacy. "Download my data" gives you a file with everything; "Delete my account" erases everything at once.',
        `Cannot sign in? Email ${LEGAL.contactEmail} from the address on your account and we will do it for you within ${LEGAL.responseDays} days.`,
      ]}
      sections={[
        {
          id: 'download',
          title: 'Download your data',
          body: (
            <p>
              In the app, open <strong className="text-fg">Account &amp; privacy</strong> and choose <strong className="text-fg">Download my data</strong>.
              You get one JSON file with your profile, transactions, hustles, trips, W-2s, estimated payments, education and home office forms, and your
              bank connections (without the access token, which is a credential). JSON can be opened by any text editor and imported into spreadsheets.
            </p>
          ),
        },
        {
          id: 'delete',
          title: 'Delete your account',
          body: (
            <>
              <p>
                In the app, open <strong className="text-fg">Account &amp; privacy</strong>, choose <strong className="text-fg">Delete my account</strong>{' '}
                and confirm. This, straight away:
              </p>
              <PolicyList
                items={[
                  'deletes every transaction, hustle, trip, W-2, payment, form, setting and agreement record we hold for you;',
                  'tells Plaid to stop accessing any bank you connected for this app, and deletes the connection;',
                  'closes your sign-in account at Clerk.',
                ]}
              />
              <p>
                Encrypted database backups kept by our host for disaster recovery expire on their own within {LEGAL.backupRetentionDays} days; your data is
                not restored from them except to recover the whole service after a failure, and it would be deleted again. Download your data first if you
                want a copy: deletion cannot be undone.
              </p>
            </>
          ),
        },
        {
          id: 'email',
          title: 'Ask us instead',
          body: (
            <p>
              If you cannot sign in, or prefer to ask, email {email} from the address on your account with &ldquo;Delete my data&rdquo; or &ldquo;Send me my
              data&rdquo;. We may ask a question to make sure the request is yours. We complete requests within {LEGAL.responseDays} days and confirm by
              email.
            </p>
          ),
        },
        {
          id: 'plaid',
          title: 'Data held by Plaid',
          body: (
            <p>
              Plaid keeps its own records of the connections you made through it, under its{' '}
              <PolicyLink href="https://plaid.com/legal/#end-user-privacy-policy">End User Privacy Policy</PolicyLink>. You can see and delete them at{' '}
              <PolicyLink href="https://my.plaid.com">my.plaid.com</PolicyLink>.
            </p>
          ),
        },
      ]}
    />
  );
}
