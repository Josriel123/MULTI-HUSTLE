import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { afterDeletionUrl } from '@/components/legal/deletion';
import { LEGAL, SERVICE_PROVIDERS } from '../legal';

/**
 * The Terms and the Privacy Policy promise that a change that matters asks
 * everyone to agree again, which happens only when LEGAL.agreementVersion is
 * bumped (src/lib/agreement.ts). Nothing else links the two, so this test
 * fingerprints what users agree to: both pages' source and the details they
 * print from src/lib/legal.ts. When that changes, it fails until someone
 * decides:
 *
 *  - the change matters to users: bump agreementVersion and effectiveDate,
 *    add an entry to docs/legal-changelog.md, and record the new fingerprint
 *    under the new version; or
 *  - it does not (a typo, a link): record the new fingerprint under the
 *    current version, and say so in the commit message.
 */
const AGREED: Record<string, string> = {
  // Re-recorded when Florida law and Miami-Dade courts were named, before anyone had agreed (docs/legal-changelog.md).
  '2026-09-23': '136918de3eced907',
};

function fingerprint(): string {
  // Line endings differ between a Windows checkout and CI; the words do not.
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');
  // The version and date are what a bump changes, so they are not part of the text.
  const details = Object.fromEntries(Object.entries(LEGAL).filter(([key]) => key !== 'agreementVersion' && key !== 'effectiveDate'));
  const text = JSON.stringify({
    terms: read('src/app/(public)/legal/terms/page.tsx'),
    privacy: read('src/app/(public)/legal/privacy/page.tsx'),
    details,
    providers: SERVICE_PROVIDERS,
  });
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

describe('the policies people agree to', () => {
  it('have a fingerprint recorded for the current version', () => {
    expect(AGREED[LEGAL.agreementVersion], `no fingerprint recorded for agreementVersion ${LEGAL.agreementVersion}`).toBeDefined();
  });

  it('have not changed since that version was recorded (bump the version, or record a non-material change)', () => {
    expect(fingerprint(), 'The Terms or Privacy Policy changed: see the comment at the top of this file.').toBe(AGREED[LEGAL.agreementVersion]);
  });

  it('put the version and the effective date together', () => {
    expect(LEGAL.agreementVersion).toBe(LEGAL.effectiveDate);
  });
});

describe('afterDeletionUrl', () => {
  it('says the account is gone, and adds the Plaid follow-up only when Plaid did not confirm', () => {
    expect(afterDeletionUrl({ bankRevocationErrors: 0 })).toBe('/welcome?deleted=1');
    expect(afterDeletionUrl({ bankRevocationErrors: 1 })).toBe('/welcome?deleted=1&plaid=check');
    expect(afterDeletionUrl({ bankRevocationErrors: 0 }, 'underage')).toBe('/welcome?underage=1');
  });
});
