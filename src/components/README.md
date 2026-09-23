# UI components and page conventions

This directory is the only place for shared UI. Every page follows the rules
here; the Overview (`src/app/(app)/page.tsx`) and Income & expenses
(`src/app/(app)/transactions/page.tsx`) are the reference pages. Why it looks this
way is [D33](../../docs/decision-log.md#d33).

## Three rules that outrank everything else on this page

1. **Every screen that shows a figure from the estimate renders
   `<EstimateNotice>`** with the response's `disclaimer`, `warnings`,
   `assumptions` and `notModeled`, below the figures. The engine returns those
   next to the number so nobody can show one without the other. Dropping them
   is a regression, not a simplification. (D16)
2. **No arithmetic on money in a `.tsx` file.** Not for a tax figure, not for
   a bar width, not for a total. Read the value from the summary (`fetchSummary`)
   or the route that owns it, and format it with `format.ts`. Shares for bars
   and progress, "left to pay" and "refund", and list totals are computed on
   the server (`src/lib/dashboard.ts`, the payments route). If a value is not
   in a payload, add it there. (D16, D34)
3. **No tax facts in a page.** Rates, thresholds, due dates and citations come
   from the engine: through the API, or by importing its constants (the
   profile page reads the standard deduction from `getTaxYearParameters`; the
   glossary quotes `SE_RATES`). Qualitative explanations are fine; numbers are
   not. (D26)

## Tokens

Light by default, dark when the operating system asks (`prefers-color-scheme`),
print resets to black on white. Every colour is a custom property in
`src/app/globals.css`, aliased in `@theme inline`, so utilities compile to
`var(--c-…)`. **Never type a colour** in a component: no hex, no `bg-white`,
no `text-black`. If one is missing, add it to `:root`, the dark block and
`@theme` together.

| Use it for | Utility |
|---|---|
| Page background, content cards, insets and hovers | `bg-bg`, `bg-card`, `bg-surface` |
| Body text, secondary text, hints | `text-fg`, `text-fg-muted`, `text-fg-faint` |
| Money in your favour, the primary action, the current page | `accent` (`text-accent`, `bg-accent`; text on it `text-on-accent`) |
| Something in the estimate needs checking | `warning` |
| Destructive actions and errors (owing tax is not an error) | `danger` |
| Bank connections, neutral notes | `info` (text on it `text-on-info`) |
| Lines (decoration only) | `border-border`, hover `border-border-strong` |
| The outline of a text box, the chosen segment | `border-field-border`, `ring-field-border` (3:1, WCAG 1.4.11) |
| Behind dialogs and the drawer | `bg-scrim` |
| Card radius and shadows | `rounded-card`, `shadow-card`, `shadow-pop` |
| Motion | `animate-slide-up`, `animate-fade-in`, `animate-slide-in` (all off under reduced motion) |

Tints use opacity modifiers: `bg-accent/10`, `border-warning/30`.

`src/app/__tests__/contrast.test.ts` checks the tokens, not the pages: every
text colour at 4.5:1 on every surface in both themes and on its own 10% tint,
outlines and the focus ring at 3:1 (D46). A new colour pair a page relies on
goes into that test. `src/lib/brand.ts` repeats three tokens as literals for
the manifest, the theme-color tag and the icons; the test keeps them equal.

Type: page title `text-2xl md:text-[1.75rem] font-bold`; card title
`text-base md:text-lg`; body and controls ~15px; hints `text-xs`/`text-sm`.
Headline figures `text-[1.75rem] md:text-[2rem] font-bold`. Every column of
numbers gets `tabular-nums`. Sentence case everywhere, uppercase only for the
small section eyebrows.

## Layout

`AppShell` owns the frame: a sidebar from `lg` up, a sticky header with the
**tax-year picker** (one for the whole app) and the account button, and
`<main id="main">` with padding and a `max-w-6xl` column, the policy links
under it. Below `lg` the sidebar becomes a bottom tab bar (Overview, Money,
"+", Report, More): "+" opens quick add, More opens the slide-out menu, a
custom modal (focus trapped, Escape, the page `inert`) rather than a native
`<dialog>`, so the guided tour can draw above it (D43, D44). Pages add no
page padding of their own. Public pages use `legal/PublicShell` instead.

- Anything that floats over the page (the cookie notice) adds
  `var(--mh-bottom-nav)` and `env(safe-area-inset-bottom)` to its bottom
  offset, so the tab bar never covers it.
- A new tab needs `data-tour` on its link and a step in `tour/tourSteps.ts`;
  `tour-steps.test.ts` fails otherwise.

- Page rhythm: `flex flex-col gap-6`. Cards in a row: `grid gap-4 sm:grid-cols-3`
  or `lg:grid-cols-2`. A form beside a list: `lg:grid-cols-[minmax(0,22rem)_1fr]`.
- Anything in a flex row that holds text gets `min-w-0`.
- Check every page at 375px. Lists stack instead of scrolling sideways; long
  segmented controls drop their counts below `sm`.
- Editing one thing happens in a `Dialog`: centred on desktop, a bottom sheet
  on phones.

## Components

| Component | Use |
|---|---|
| `ui/Card` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `DataRow`) | Every surface. `accent` adds a thin top rule, sparingly. `padding="none"` when a list brings its own. `DataRow` is a label/value line; `emphasis` makes it a total. |
| `ui/StatCard` | One headline figure: label (may be a `<Term>`; a label, not a heading, so the page outline goes h1 → h2), formatted value, one plain caption, optional icon and footer. `captionClassName="hidden sm:block"` when cards sit two to a row on phones. |
| `ui/PageHeader`, `SectionHeading` | Title, one or two plain sentences on what the page is for, an icon, and the page's main action. |
| `ui/Button`, `LinkButton`, `buttonClasses` | The only button. `primary` (the one main action), `secondary`, `info` (bank), `danger` (delete), `ghost` (icon-only). `loading` spins and disables. |
| `ui/Field` (`Field`, `Input`, `MoneyInput`, `Select`, `Checkbox`, `RadioCard`, `FieldGrid`) | Forms. `Field` owns label, `aside` ("Optional", "Box 2"), hint and error; the hint and error carry ids `${htmlFor}-hint` and `${htmlFor}-error` for the control's `aria-describedby`, and an error belongs on the field that is wrong (with `aria-invalid`), not only in a status line. `MoneyInput` shows "$", opens the decimal keypad, and is text, not `type="number"`. |
| `ui/Callout` | A tinted note inside a page: `warning`, `info`, `success`, `tip`, with an optional action. |
| `ui/EmptyState` | What an empty list shows: what goes here, why, and the button that adds the first one. Never just "No data". |
| `ui/SegmentedControl` | Two to four exclusive choices side by side (money in or out, list filters). Native radios underneath. |
| `ui/ProgressBar` | A fraction from the server or a count, drawn. |
| `ui/Dialog` | Modal editing panel on a native `<dialog>` (focus trap, Escape, inert page). |
| `ui/ConfirmDialog` (`useConfirm`) | Ask before anything destructive. **Never `window.confirm()`**: it freezes JavaScript, which stalls Clerk's token refresh (D24). |
| `ui/Term` | A tax word that explains itself on hover, focus or tap. Definitions live in `src/lib/glossary.ts`; add one there, never inline. |
| `ui/Badge` | Status pills: Deductible, From your bank, a hustle. |
| `ui/InlineStatus` | The result of an action, where it happened. Replaces `alert()`. |
| `ui/Busy`, `Skeleton` | Dim content that is refreshing, in place; placeholders for a first load. |
| `EstimateNotice` | The disclaimer, the warnings ("Worth checking"), and the assumptions and not-modeled lists, collapsed on screen and expanded in print. |
| `CategorySelect` | The category picker, grouped by what each category does (`categoryOptions.ts` builds the groups from the engine's treatments). |
| `HustlePicker` | "Which hustle?" with "Add a new hustle" in place. |
| `TaxYearSelect`, `useTaxYear`, `useYearHref` | The year lives in the URL (D18). `useYearHref` adds it to in-app links. |
| `useLoad` | Load data for a key and reload on demand; `loading` is derived and a stale response is dropped. Use one per independent request (D21). |
| `ui/SkipLink` | "Skip to main content", first in every frame; targets `#main`. |
| `legal/AgreementGate` | Nothing in the app renders until the current Terms and the 18+ box are ticked (D40). `AgreementScreen` is exported for the preview. |
| `legal/CookieNotice`, `reopenCookieNotice` | The informational cookie notice (D42), in the root layout. While it shows it reserves its height at the bottom of the page (scroll padding and body padding), so it never covers what has focus. |
| `legal/underage`, `UnderageBlock`, `deletion` | The device's memory of an "I'm under 18" answer and the sign-up notice it shows; `afterDeletionUrl`, where to land after an account is deleted (with the Plaid follow-up when Plaid did not confirm). |
| `legal/PublicShell`, `SiteFooter`, `LegalDocument`, `AuthLegalNote` | The public frame, the footer every page shows (`compact` inside the app), the policy page layout (short version, contents, numbered sections, `Conspicuous` for capitalised clauses), and the line under the sign-in forms. |
| `tour/GuidedTour`, `startTour`, `tourSteps` | The first-visit tour (D43): spotlight on a `data-tour` element, a speech bubble, arrows and Escape; `startTour()` replays it. |
| `overview/`, `transactions/`, `jobs/` | Pieces of one page each. |

Helpers: `api.ts` (typed fetchers; the summary and chart types are the
server's own return types), `format.ts` (currency, miles, percent, dates, the
mileage rate, `formatLineValue` for engine lines with a unit, labels),
`moneyText.ts` (`normalizeMoneyText`: strips "$" and well-placed thousands
separators, passes anything ambiguous to the server to refuse), `cn.ts`.

## Copy

Write for someone who has never done their own taxes.

- Plain words first: "Money in", "Money out", "Left to pay", "Safe to spend",
  "Income & expenses". The form line can follow as a hint ("Box 2",
  "Form 1040 line 24") where it helps someone copying from a form.
- Wrap a tax term in `<Term>` the first time it appears on a screen.
- Say what to do next. Every empty state and warning names the action.
- It is an estimate, and it can be higher or lower than the real tax (it
  leaves out credits, among other things): "estimate", never "bill".
- Claim only what the code does (D49): no testimonials, ratings, user counts
  or urgency; no "bank-level", "guaranteed" or "accurate to the cent"; "we
  never sell your data or share it for advertising", never "we share
  nothing" (service providers receive data). Limits as plainly as features.
- Category and filing-status labels come from the engine (`categoryLabel`,
  `FILING_STATUS_INFO`); a raw slug never renders.
- American spelling. No hype ("loophole", "shield", "aggressively").

## Checking a page

`/preview/<page>` (dev only) renders the real page with sample data run
through the real engine, no sign-in needed; `?scenario=new` is an empty
account and `?tour=1` starts the tour. Pages: `overview`, `transactions`,
`mileage`, `jobs`, `payments`, `education`, `office`, `report`, `profile`,
`account`, and `agreement` (the step before the app). Its layout,
`src/app/(preview)/layout.tsx`, is the app frame without the agreement step.
Check light, dark, 1280px and 375px, and print the report. Writes succeed there without storing anything.
It shows what the code renders, not what a real account holds: a
click-through signed in is still the final check.

## Building a page

1. `PageHeader` with an icon and a sentence on what the page is for.
2. One `useLoad` per request, each with a `useCallback` loader keyed on the
   tax year, so one failing request cannot blank the others (D21).
3. Read every figure from a payload; format with `format.ts`.
4. Components from `ui/`. No `style={{}}` except a width the server computed
   or a position measured at runtime (the tour's spotlight and bubble).
5. `EstimateNotice` under the figures; `Busy` around data that refreshes.
6. `InlineStatus` for results, `useConfirm` for deletes, `Dialog` for edits.
7. An `EmptyState` for every list.
8. Anything a paper reader needs prints expanded (D25).
9. A browser-tab title: the page is a client component, so a `layout.tsx`
   beside it exports `metadata.title` (screen readers announce it on every
   navigation).
