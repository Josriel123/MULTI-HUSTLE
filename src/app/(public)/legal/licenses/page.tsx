import type { Metadata } from 'next';
import { LegalDocument, PolicyLink } from '@/components/legal/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Licenses and credits',
  description: `The open-source software, font and icons ${LEGAL.appName} is built with, and their licenses.`,
};

/**
 * Third-party credits, kept in step with package.json and
 * THIRD_PARTY_NOTICES.md (which carries the full license texts). Only what
 * ships to users is listed; build and test tools are not redistributed.
 */
const SOFTWARE = [
  { name: 'Next.js', license: 'MIT', by: 'Vercel, Inc.', url: 'https://github.com/vercel/next.js' },
  { name: 'React and React DOM', license: 'MIT', by: 'Meta Platforms, Inc. and affiliates', url: 'https://github.com/facebook/react' },
  { name: 'Tailwind CSS', license: 'MIT', by: 'Tailwind Labs, Inc.', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'Clerk Next.js SDK', license: 'MIT', by: 'Clerk, Inc.', url: 'https://github.com/clerk/javascript' },
  { name: 'Plaid Node SDK and React Plaid Link', license: 'MIT', by: 'Plaid Inc.', url: 'https://github.com/plaid' },
  { name: 'Prisma Client', license: 'Apache-2.0', by: 'Prisma Data, Inc.', url: 'https://github.com/prisma/prisma' },
  { name: 'Recharts', license: 'MIT', by: 'Recharts Group', url: 'https://github.com/recharts/recharts' },
  { name: 'decimal.js', license: 'MIT', by: 'Michael Mclaughlin', url: 'https://github.com/MikeMcl/decimal.js' },
  { name: 'Lucide icons (lucide-react)', license: 'ISC', by: 'Lucide Contributors', url: 'https://github.com/lucide-icons/lucide' },
] as const;

export default function LicensesPage() {
  return (
    <LegalDocument
      title="Licenses and credits"
      shortVersion={[
        `${LEGAL.appName} is built on open-source software, all under permissive licenses (MIT, ISC, Apache-2.0).`,
        'The Outfit typeface is used under the SIL Open Font License. The logo and icons are Lucide icons (ISC).',
        'No stock photos, and no IRS logos or seals: the IRS is named only to describe the rules the estimate follows.',
      ]}
      sections={[
        {
          id: 'software',
          title: 'Software',
          body: (
            <>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-xs uppercase tracking-[0.06em] text-fg-faint">
                      <th scope="col" className="px-4 py-2 font-semibold">Project</th>
                      <th scope="col" className="px-4 py-2 font-semibold">License</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Copyright</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SOFTWARE.map((s) => (
                      <tr key={s.name}>
                        <td className="px-4 py-2.5">
                          <PolicyLink href={s.url}>{s.name}</PolicyLink>
                        </td>
                        <td className="px-4 py-2.5">{s.license}</td>
                        <td className="px-4 py-2.5">{s.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                The full license texts are in <code className="rounded bg-surface px-1 text-sm">THIRD_PARTY_NOTICES.md</code> in the source code, and in each
                project&rsquo;s repository.
              </p>
            </>
          ),
        },
        {
          id: 'font',
          title: 'Typeface',
          body: (
            <p>
              Outfit, copyright 2021 The Outfit Project Authors (
              <PolicyLink href="https://github.com/Outfitio/Outfit-Fonts">github.com/Outfitio/Outfit-Fonts</PolicyLink>), is licensed under the{' '}
              <PolicyLink href="https://openfontlicense.org">SIL Open Font License, Version 1.1</PolicyLink>. It is served from this site, not from a font
              service.
            </p>
          ),
        },
        {
          id: 'icons',
          title: 'Logo and icons',
          body: (
            <p>
              The icons, including the sprout in the logo, come from <PolicyLink href="https://lucide.dev">Lucide</PolicyLink>, licensed under the ISC
              License. There are no photographs or illustrations from other sources.
            </p>
          ),
        },
        {
          id: 'tax-content',
          title: 'Tax rules and forms',
          body: (
            <p>
              The tax figures and form references come from IRS publications, forms and revenue procedures, and from the Internal Revenue Code. IRS content
              is in the public domain. {LEGAL.appName} names the IRS and its forms only to say which rules it follows; it uses no IRS logo, seal or other
              government insignia, and is not affiliated with or endorsed by the IRS.
            </p>
          ),
        },
      ]}
    />
  );
}
