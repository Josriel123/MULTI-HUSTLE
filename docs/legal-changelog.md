# Legal changelog

Every published version of the Terms of Service and Privacy Policy, newest
first. The version is `LEGAL.agreementVersion` in `src/lib/legal.ts`; a user
whose recorded version differs is asked to agree again before the app opens
(`src/lib/agreement.ts`). Bump it when a change matters to users (what is
collected, who receives it, what they agree to); fix typos without a bump.

When bumping: change `agreementVersion` and `effectiveDate` together, add an
entry here saying what changed, and say the same in one line on the agreement
screen if it is not obvious.

## 2026-09-23 — first version

Published with the Privacy Policy, Terms of Service, Cookie Policy, Refund
Policy, data deletion page, accessibility statement and licenses page.

- Service run by an individual in the United States, for users 18 and older
  in the United States. No paid features; no payment details collected.
- Collected: account details through Clerk; what the user enters; bank
  transactions through Plaid only if the user connects a bank; the agreement
  and age-confirmation record. No analytics, advertising or tracking; only
  essential cookies and browser storage.
- Rights: download and delete in the app, or by email with a 30-day reply.
  Deleting an account revokes bank access at Plaid; backups expire within 30
  days.
- Terms: estimates are for planning, not tax advice or a return; warranty
  disclaimer and a $100 liability cap with the usual carve-outs; disputes by
  email first, then the courts (no arbitration). Florida law; the state or
  federal courts in Miami-Dade County, Florida, with small claims wherever the
  user lives. Named before anyone had agreed (0 of 8 accounts), so still this
  version; until then the clause read "the state where the operator lives".
