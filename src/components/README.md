# UI components and page conventions

This directory is the only place for shared UI. `src/app/components/` is gone;
do not recreate it. The two reference pages are the dashboard
(`src/app/page.tsx`) and the home office form (`src/app/office/page.tsx`).
Convert the remaining pages to look like those two.

## Two rules that outrank everything else on this page

1. **Every screen that shows a figure from the estimate renders
   `<EstimateNotice>`** with the response's `disclaimer`, `warnings` and
   `assumptions`, directly below the figures. The engine returns those next
   to the number so nobody can show one without the other. Dropping them is
   a regression, not a simplification.
2. **No tax arithmetic in a `.tsx` file.** Read `estimate` from
   `fetchSummary()`; format it with `format.ts`. If a component adds,
   multiplies or compares money to produce a tax figure, it is a bug. The
   home office page shows both methods, the income cap and the carryover
   without a single operator, by reading `estimate.scheduleC.homeOffice`.

## Tokens

Tailwind 4 is on. `globals.css` keeps the original palette as CSS custom
properties and aliases them in `@theme inline`, so utilities compile to
`var(--…)` and the print stylesheet can still override the variables.

| Use it for | Utility | Backed by |
|---|---|---|
| Page background | `bg-bg` | `--bg-primary` |
| Content area | `bg-surface` | `--bg-secondary` |
| Cards, inputs' parent | `bg-card` | `--bg-card` |
| Body text | `text-fg` | `--text-primary` |
| Secondary text, labels | `text-fg-muted` | `--text-secondary` |
| Hints, placeholders | `text-fg-faint` | `--text-muted` |
| Money in the user's favour, primary actions, active nav | `text-accent`, `bg-accent`, `border-accent` | `--accent-green` |
| Tax owed, destructive actions, engine notices | `text-danger`, `bg-danger`, `border-danger` | `--accent-red` |
| Plaid, disclaimers, informational | `text-info`, `bg-info`, `border-info` | `--accent-blue` |
| Lines | `border-border`, hover `border-border-strong` | `--border-color`, `--border-strong` |
| Card radius | `rounded-card` | `--border-radius` (12px) |
| Entrance animation | `animate-slide-up` | keyframes in `@theme` |

Opacity modifiers work on all of them: `bg-info/5`, `ring-accent/30`.
Never write a hex colour or `style={{ color: '#…' }}` in a page; if a colour
is missing, add it to `:root` and `@theme` together.

Type: `text-xs` (12px) for badges, `text-sm` (14px) for hints, labels and
notices, base (16px) for body, `text-lg`/`text-xl` for card titles,
`text-2xl md:text-[2rem]` for the page title, `text-3xl md:text-[2.5rem]`
for headline figures. Money and other columns of numbers get `tabular-nums`.

## Layout

`AppShell` (used by `layout.tsx`) owns the frame: a 260px sidebar from `md`
up, a header with the menu button on phones, and a drawer that closes on
navigation, overlay tap or Escape. Pages render inside `<main>` with
`p-4 md:p-8` already applied; do not add page-level padding.

Responsive rules, mobile first:

- Stack by default, go multi-column at `md` (or `lg` for two wide cards):
  `grid gap-4 md:grid-cols-3 md:gap-6`. Two form fields: `<FieldGrid>`
  (`sm:grid-cols-2`).
- Anything in a flex row that holds text gets `min-w-0` so it can shrink.
- Tables scroll inside their own container: wrap in `overflow-x-auto`. On
  phones prefer a stacked card per row for anything with more than three
  columns (the deductions ledger).
- Page-level vertical rhythm is `flex flex-col gap-6 md:gap-8`; inside a card
  use `gap-3` to `gap-5`.
- Header actions (year picker, primary button) go in `PageHeader`'s `actions`;
  they wrap under the title on phones.
- Modals: `fixed inset-0 z-50` overlay, panel `w-full max-w-lg` on phones
  growing to `max-w-xl`, scroll inside the panel (`max-h-[90dvh] overflow-y-auto`).

## Components

| Component | Use |
|---|---|
| `ui/Card` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `DataRow`) | Every surface. `accent` adds the 4px top rule (stat cards only). `hover` only when the card is itself a target. `DataRow` is the label/value strip used for engine line items. |
| `ui/StatCard` | One headline figure with an uppercase label and a caption naming the form line. Pass an already formatted string. |
| `ui/Button`, `LinkButton`, `buttonClasses` | The only button. Variants: `primary` (save/submit), `secondary` (everything else), `info` (Plaid), `danger` (delete), `ghost` (icon-only). `loading` shows a spinner and disables. `LinkButton` for navigation. |
| `ui/Field` (`Field`, `Label`, `Input`, `Select`, `FieldGrid`) | Forms. `Field` owns label/hint/error; controls are plain and composable. |
| `ui/Badge` | Status pills: Deductible, Plaid, a category label. Tone, not colour. |
| `ui/PageHeader` | Title, one-sentence description, optional icon badge, `actions` slot. |
| `ui/Busy` | Wrap content that is loading or refreshing; dims it in place and sets `aria-busy`. Do not swap to a spinner; figures must not jump when the year changes. |
| `ui/InlineStatus` | The result of an action (`ok`, `error`, `info`) where it happened. Replaces `alert()` and `window.location.reload()`. |
| `ui/ConfirmDialog` (`useConfirm`) | Ask before anything destructive: `const [confirm, dialog] = useConfirm()`, then `if (!(await confirm({ title, tone: 'danger' }))) return;` and render `{dialog}` once. **Never `window.confirm()`** — it freezes the page's JavaScript while open, which stalls Clerk's background token refresh; a delete confirmed after a long pause can go out on an expired session. |
| `EstimateNotice` | Disclaimer, warnings, and the assumptions and not-modeled lists — collapsed on screen, always expanded in print. Mandatory next to figures. |
| `TaxYearSelect` | Year picker fed by the engine's `SUPPORTED_TAX_YEARS`. Every year-scoped page has one in its header; pass the year to every fetch and POST. |
| `PlaidLinkButton` | Connect / sync. |
| `SidebarNav`, `AppShell` | Frame. |

Helpers: `api.ts` (typed fetchers; `EstimatePayload` is the engine's result
type after serialisation, so field names are checked at compile time),
`format.ts` (`formatCurrency`, `formatMiles`, `formatPercent`,
`categoryLabel`, `filingStatusLabel`, `homeOfficeMethodLabel`, `formatDate`),
`cn.ts`.

## Copy

Describe what the app does. No "loophole", "shield", "bypass", "brutal",
"aggressively", "annihilation", "legally sheltering". Name the form line a
number comes from ("Form 1040 line 24", "Schedule 1 line 8r"). The estimate
runs high because it omits credits; say "estimate", never "bill" or "owed".
Labels come from the engine's vocabulary via `categoryLabel()`; a raw slug
such as `other_business_expense` must never render.

## Converting a page

1. Replace the header with `PageHeader` (+ `TaxYearSelect` if the page is
   year-scoped; pass `taxYear` to its GETs and POST bodies).
2. Fetch through `api.ts`; keep the `ignore` flag pattern from the reference
   pages so a slow response for the previous year cannot overwrite the new one.
3. Delete every local calculation and read the same value from `estimate`.
   If the value is not in the payload, that is a Phase 3 (API) conversation,
   not a reason to compute it in the page.
4. Cards, fields, buttons, badges from `ui/`. No `style={{}}`.
5. `EstimateNotice` under the figures. `Busy` around the data region.
6. Replace `alert()`/`reload()` with `InlineStatus` and a re-fetch, and
   `confirm()` with `useConfirm`. Browser dialogs block the page; none remain.
7. Check the phone layout (375px) and the print layout if the page prints.
   A closed `<details>` does not print its contents — anything a reader of
   the paper copy needs must have a print-only expanded copy, as
   `EstimateNotice` does.
8. A page that loads several things loads them with `Promise.allSettled` and
   applies each result on its own, so one failing request (usually the
   estimate) cannot blank data that did load.
9. Remove any legacy class the page no longer needs from `globals.css`.

### Remaining pages

- **deductions/page.tsx** (1,133 lines). Ledger table needs a stacked layout
  on phones. Edit modal: keep the Plaid lock on amount and date exactly (the
  API rejects changes; show the lock message from the response). Mileage form
  and ledger: read `ratePerMile`, `deduction`, `totalDeduction` from
  `/api/mileage`, never multiply miles by a rate. Category selects should use
  labels from `categoryLabel`. Behaviour to re-test after converting: edit a
  Plaid transaction (only category/deductible change), edit a manual one
  (amount/date change), delete both kinds, add and delete a mileage entry.
- **student/page.tsx**. Copy is fixed; layout is not. It still computes
  `box5 - box1` locally: replace with `estimate.scholarships` (fields:
  `totalScholarships`, `qualifiedEducationExpenses`,
  `restrictedToNonQualifiedExpenses`, `taxable`) and
  `estimate.adjustments.studentLoanInterest` (`tentative`, `reduction`,
  `deduction`, `disallowedReason`). It posts without a year; add
  `TaxYearSelect` and send `taxYear`.
- **export/page.tsx**. Reads the summary and transactions; keep the `.card`
  and `.print-hide` classes (or their `print:` equivalents) so the print CSS
  in `globals.css` still applies. `AppShell` is already `print:hidden`.

## Legacy classes

`globals.css` still defines `.card`, `.text-secondary`, `.text-green`,
`.text-red` and `.flex-item-center` for the three unconverted pages. Delete
each once nothing references it. One transitional side effect of Tailwind's
reset: bullet lists on the unconverted pages lose their bullets until they
use `list-disc`.
