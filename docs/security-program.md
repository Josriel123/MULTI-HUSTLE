# Information security program

A short written program for the information Multi-Hustle holds. It exists
because the app keeps people's income, expenses and bank connections, and
because the FTC's Safeguards Rule (16 CFR Part 314) expects a business that
handles consumer financial information to have one in writing. Whether that
rule formally applies to a free estimator that prepares no returns is a
question for a lawyer; following it costs little. Plaid also asks for a
security program before granting production access.

It describes what the code does today and what the owner does by hand. Items
marked **Owner** are actions for the person who runs the service, not
properties of the code. Review it once a year and whenever the data the app
holds changes (last reviewed 2026-09-23).

## 1. Who is responsible

The operator named in `src/lib/legal.ts` (`LEGAL.operatorName`) is the
qualified individual for this program, and the security contact in
`public/.well-known/security.txt`.

## 2. What the app holds

| Data | Where | Why |
|---|---|---|
| Name, email address, sign-in method, sessions | Clerk | Sign-in; the name and email are copied to the `User` row |
| Transactions, hustles, trips, W-2s, estimated payments, 1098-T, 1098-E, home office, tax profile | Neon Postgres (`prisma/schema.prisma`) | What the estimate is computed from |
| Plaid access token and item id, per connected bank | Neon, `PlaidConnection`; the token is AES-256-GCM encrypted (`src/lib/crypto.ts`) | Reading the transactions the user asked to bring in |
| Agreement version and time, age confirmation time | Neon, `User` | The record of the clickwrap agreement and age check |
| Request logs (IP address, browser, path) | Vercel, short-lived | Hosting |

Nothing else is collected: no analytics, no advertising identifiers, no
location, no Social Security numbers. `SERVICE_PROVIDERS` in `src/lib/legal.ts`
is the list of every outside service that receives personal information, and
the Privacy Policy prints it. A new SDK that receives personal information goes
into that list, the Privacy Policy and this table in the same change.

## 3. Safeguards in the code

- **Access control.** Every route handler authenticates itself (AGENTS.md
  invariant 10) and reads only the signed-in user's rows. The proxy is an
  optimistic gate only.
- **Encryption.** TLS in transit (Vercel, Neon, Clerk and Plaid all require
  it; HSTS is sent). Plaid access tokens are encrypted with AES-256-GCM under
  `ENCRYPTION_KEY` before they are stored; all three tokens on the main
  database were checked encrypted on 2026-09-23. Neon encrypts storage at
  rest.
- **Minimisation.** The export leaves out the access token; the app never
  receives bank credentials (Plaid Link collects them); `User.plan`, which
  held nothing useful, is being removed (see `PLAN.md`).
- **Headers.** `next.config.ts` sends `X-Frame-Options: DENY`,
  `frame-ancestors 'none'`, `nosniff`, a strict referrer policy, HSTS and a
  restrictive `Permissions-Policy`.
- **Secrets.** Keys live in environment variables (`.env` locally, Vercel's
  settings in production), never in the repository; `.env` is git-ignored.

## 4. Owner safeguards

- **Owner:** two-step sign-in on every account that can reach the data:
  GitHub, Vercel, Neon, Clerk, Plaid and the contact mailbox.
- **Owner:** only the owner has access to the production database and
  dashboards. Anyone else given access is listed here with the date and
  removed when they no longer need it.
- **Owner:** keep `ENCRYPTION_KEY` only in Vercel's environment settings and
  the local `.env`. If it may have leaked, generate a new one, and ask every
  user with a bank connection to disconnect and reconnect it, since tokens
  encrypted under the old key cannot be read under the new one.
- **Owner:** before switching `PLAID_ENV` to `production`, complete Plaid's
  security questionnaire and confirm the app's use case in the Plaid
  dashboard's data transparency settings.

## 5. Retention and disposal

- A user's rows are deleted when they delete their account (Account &
  privacy, or `DELETE /api/account`) or when Clerk reports the user deleted
  (`/api/webhooks/clerk`). Both call `deleteUserData` in
  `src/lib/userData.ts`, which first asks Plaid to revoke each bank
  connection (`/item/remove`); `user-data.test.ts` fails if a table with a
  `userId` is left out.
- "Disconnect" on the bank card revokes the connection at Plaid and deletes
  the stored token; the transactions already brought in stay until the user
  deletes them.
- Neon keeps point-in-time history for at most the window set on the project
  (never more than 30 days, `LEGAL.backupRetentionDays`); deleted rows leave
  it when that window passes. **Owner:** keep the window at or below that
  number, or change the number and the Privacy Policy together.
- Requests by email are answered within `LEGAL.responseDays` (30) days.

## 6. Incidents

If personal information may have been exposed:

1. Contain it: rotate the affected keys (Clerk, Plaid, Neon, `ENCRYPTION_KEY`),
   revoke sessions in Clerk, and take the app offline in Vercel if needed.
2. Work out what was exposed, for whom, and when, from Vercel, Neon and Clerk
   logs.
3. Tell the affected users by email without unreasonable delay, as the
   Privacy Policy promises, and within any deadline set by the laws of the
   states they live in.
4. If unencrypted information about 500 or more people was taken, notify the
   FTC within 30 days of discovery, as the Safeguards Rule requires of
   businesses it covers.
5. Record what happened and what changed in `docs/decision-log.md`.

Reports from outside arrive at the address in `security.txt`; answer within
five business days.

## 7. Change management

- One branch per change, tests first for bug fixes, and the owner pushes
  (AGENTS.md "Process"). Schema changes are committed SQL, applied by hand.
- When dependencies change, run `npm run notices` to regenerate
  `public/third-party-notices.txt` (served with the site) from the production
  dependency tree, and check the Licenses page still lists what ships to
  users. A new SDK is also checked for what it sends on its own (Clerk's
  telemetry, for one, is switched off).
- A change to what the app collects, who receives it, or how long it is kept
  updates the Privacy Policy, bumps `LEGAL.agreementVersion` if the change
  matters to users, and gets an entry in `docs/legal-changelog.md`.
