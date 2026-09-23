# Multi-Hustle

> A federal tax estimator for people with several income streams — gig work,
> freelancing, scholarships — built around an engine that cites every rule it
> applies.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)
![Plaid](https://img.shields.io/badge/Banking-Plaid_sandbox-00D64F)

Connect a bank through Plaid's sandbox or enter transactions by hand, give each
one a category, log business mileage, and add what else applies: a W-2 job, the
estimated tax payments you have sent, a 1098-T, a 1098-E, a home office. The app
turns that into a federal estimate you can act on: what the year's tax comes to,
how much is already paid, what is left to set aside, and what is safe to spend.
Behind it is a line-by-line computation in Form 1040 order (Schedule C,
Schedule SE, the QBI deduction, the standard deduction, income tax) with the
rule behind each line, and a tax report that prints for a preparer.

> **This is an estimate for planning, not tax advice.** It covers federal
> income and self-employment tax only, leaves out every tax credit (so it comes
> out high for anyone who qualifies for one), and says on screen and on paper
> what else it does not model.

## What's worth a look

**A tax engine you can check.** `src/lib/tax/` is pure functions — no
database, network or auth — that follow the order of Form 1040. Every rule
cites its source: the Internal Revenue Code section, the IRS Revenue Procedure
or the form line. Parameters for 2024–2026 are transcribed from the Revenue
Procedures; every function has known-answer tests, and the bracket tables are
also checked against the auditor's independent transcription at 270 boundary
points. Its [README](src/lib/tax/README.md) walks through the computation order
and the sources.

**Independent audits, not only tests.** The engine was written by one AI model
and audited cold by a model from a different lab, which found 11 problems and
no parameter errors — including a misread statute that the engine's own test
enforced. Two browser end-to-end passes followed and found 11 more bugs between
them; the engine was correct, and the code around it was dropping or
misreporting its inputs. Every finding was triaged and fixed — the engine's
fixes each starting from the auditor's counterexample, ported as a test that
failed first — and all of it is linked from [`docs/audits/`](docs/audits/).

**Exact money.** Amounts are `DECIMAL(12,2)` from the database to the page,
cross the API as strings, and are formatted only at the last moment. The one
place a JavaScript number slipped into a comparison was caught by a read-only
check against real rows — 12 of 15 matched until it was fixed.

**Made for someone who has never done their own taxes.** A new account gets a
three-step setup checklist. Screens are named for what you are doing ("Income &
expenses", "Tax payments"), every tax word on screen explains itself when you
tap it, and each figure says in a sentence where it comes from. Light and dark
themes, and it works on a phone. To see every screen without an account, run
the app and open `/preview` (development only): the real pages, fed sample data
through the real engine.

**Honest about its limits.** When the engine cannot know a fact that would
change the answer, it either assumes the conservative reading or makes the
likely assumption and warns — and every figure on screen carries the
disclaimer, the warnings, the assumptions, and the year's IRS source that
qualify it.

**Ready for strangers to sign up.** Public policies written from the code
(privacy, terms, cookies, refunds, data deletion, accessibility, licenses), a
recorded agreement and 18+ check before the app opens, download-everything and
delete-everything buttons that also revoke bank access at Plaid, only
essential cookies, security headers, and a written security program. A guided
tour explains every tab on the first visit, and on a phone the app has bottom
tabs, a quick-add button, and installs to the home screen. Contrast is tested
on the colour tokens in both themes.

Why things are built the way they are is recorded in the
[decision log](docs/decision-log.md).

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router; middleware is called Proxy here) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, Recharts, Lucide icons |
| Database | PostgreSQL on Neon, through Prisma 5 |
| Auth | Clerk |
| Banking | Plaid (sandbox only) |
| Tests | Vitest; PGlite for running the SQL migrations in-process |

## Running it locally

You need **Node 20.9 or newer**, a [Neon](https://neon.tech) database, a
[Clerk](https://clerk.com) application and a [Plaid](https://dashboard.plaid.com)
developer account (sandbox access is immediate).

```bash
git clone https://github.com/Josriel123/MULTI-HUSTLE.git
cd MULTI-HUSTLE
npm install
cp .env.example .env
```

Fill in `.env` — **`.env`, not `.env.local`**: the Prisma CLI reads only `.env`.

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon → Connect, with connection pooling **on** (hostname contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | The same, with pooling **off** — migrations need a direct connection |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard → API keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Optional locally: Clerk cannot reach `localhost`, and the app creates user rows on first write anyway |
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | Plaid dashboard → Developers → Keys (the sandbox secret) |
| `PLAID_ENV` | Leave as `sandbox` |
| `ENCRYPTION_KEY` | Encrypts Plaid tokens at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED` | `1`. Keeps Clerk's server SDK from sending usage telemetry (the browser side is off in code); the Privacy Policy promises no analytics |

Create the tables, then start the app:

```bash
npx prisma migrate deploy
npm run dev
```

Open <http://localhost:3000>: signed out, it shows the welcome page. Sign up,
agree to the Terms and confirm you are 18 or older, and the guided tour starts.
To link a bank, pick any institution in Plaid's sandbox and sign in with
`user_good` / `pass_good`.

Just looking? <http://localhost:3000/preview> renders every screen with sample
data, no sign-in needed (development only; `?scenario=new` shows an empty
account, `?tour=1` starts the tour, `/preview/agreement` is the step before
the app).

Optional demo data for your account — your Clerk user id starts with `user_`:

```bash
SEED_USER_ID=user_xxxxx npx tsx prisma/seed.ts
```

Using a database that was created earlier with `prisma db push`? Mark the
baseline as applied first — see [`prisma/migrations/README.md`](prisma/migrations/README.md).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm test` | The Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run notices` | Regenerate `public/third-party-notices.txt` after dependencies change |
| `npm start` | Serve the production build |

**On Windows**, stop `npm run dev` before running `npx prisma generate`, and
restart it afterwards: the dev server holds the Prisma query engine open, so
generate fails with `EPERM` on it (and a running server keeps the old client in
memory anyway). `npm run build` has failed the same way. Syncing the project
folder with OneDrive makes both more likely.

## Project layout

```
src/
├── app/
│   ├── (app)/            The signed-in app, behind the agreement step: overview,
│   │                     income & expenses, mileage, W-2 jobs, tax payments, home
│   │                     office, education, tax report, tax profile, account
│   ├── (public)/         Welcome, About, the policies under /legal, sign-in, sign-up
│   ├── (preview)/        The dev-only sample-data view of every app page
│   ├── api/              Route handlers — each authenticates itself
│   └── manifest.ts, icon.svg, robots.ts
├── components/           Shared UI; its README is the design-system spec
│   ├── ui/               Buttons, cards, fields, dialogs, the term popover, …
│   ├── legal/            Agreement step, cookie notice, public frame, footer
│   └── tour/             The first-visit guided tour
├── lib/
│   ├── tax/              The federal engine: pure functions, cited, tested
│   ├── dashboard.ts      Builds the summary and chart responses from rows (pure)
│   ├── estimateRows.ts   Loads one user's rows for one tax year
│   ├── legal.ts          Operator details, policy versions, service providers
│   ├── agreement.ts      Whether a user still has to agree, and what counts
│   ├── userData.ts       Export and delete everything for one user
│   ├── brand.ts          Brand colours as literals for the manifest and icons
│   ├── glossary.ts       Plain-English definitions for the tax words on screen
│   ├── hustles.ts        Hustle names, kinds, and matching deposits to them
│   ├── taxYear.ts        How every route decides which year it is answering for
│   ├── validation.ts     Input is refused, never silently corrected
│   ├── formInput.ts      The same, for W-2s, payments and the tax profile
│   ├── crypto.ts         AES-256-GCM for Plaid tokens at rest
│   └── user.ts           Creates the user row on first write
└── proxy.ts              Next.js 16 Proxy: public pages through, the rest to sign-in
prisma/
├── schema.prisma
└── migrations/           Committed SQL, applied with `prisma migrate deploy`
docs/
├── decision-log.md       Why the code is the way it is
├── security-program.md   What is held, how it is protected, incidents, retention
├── legal-changelog.md    Every version of the Terms and Privacy Policy
└── audits/               The engine audit and two end-to-end passes, each triaged
public/.well-known/security.txt   The security contact
public/third-party-notices.txt   Licences of the packages the app is built on (npm run notices)
```

## Known limitations

- **Federal only**, 2024–2026, for one self-employed person. No state tax. On
  a joint return the spouse's W-2 counts, but a spouse's own self-employment
  does not.
- **No tax credits**, so the estimate is higher than the real liability for
  anyone who qualifies for one. The full list of what is not modeled is shown
  under every estimate and in the printed report.
- **Estimated payments are recorded, not sent,** and the estimate does not work
  out due dates or underpayment penalties.
- **Plaid sandbox only.** Its sample data is regenerated whenever a bank is
  linked, so re-linking an existing test account duplicates its history —
  start a new test user for fresh bank data.
- **The policies were written from the code, not by a lawyer.** The operator's
  postal address is not published yet (`src/lib/legal.ts`).
- Engineering items still open are tracked in [PLAN.md](PLAN.md).

## Documentation

| Document | For |
|---|---|
| [`docs/decision-log.md`](docs/decision-log.md) | Why each significant choice was made, and what it replaced |
| [`AGENTS.md`](AGENTS.md) | Rules for anyone — person or AI agent — changing this code |
| [`PLAN.md`](PLAN.md) | The build plan, its history, and the open items |
| [`src/lib/tax/README.md`](src/lib/tax/README.md) | The engine: computation order, sources, omissions |
| [`src/components/README.md`](src/components/README.md) | UI tokens, components and page conventions |
| [`prisma/migrations/README.md`](prisma/migrations/README.md) | Schema history and how to apply it |
| [`docs/audits/`](docs/audits/) | The three audits, their evidence and their triage |
| [`docs/security-program.md`](docs/security-program.md) | The written security program: data held, safeguards, retention, incidents |
| [`docs/legal-changelog.md`](docs/legal-changelog.md) | What changed in each version of the Terms and Privacy Policy |
| [`public/third-party-notices.txt`](public/third-party-notices.txt) | Licence texts of the runtime dependencies, the typeface and the icon (served at `/third-party-notices.txt`) |

Pages moved in the 2026-09 redesign: `/deductions` is now `/transactions` and
`/mileage`, `/student` is `/education`, and `/export` is `/report`. The old
paths redirect.

## License

The code is for educational and portfolio purposes. The packages it is built
on keep their own licences; see [`public/third-party-notices.txt`](public/third-party-notices.txt).
