import { AlertTriangle, ChevronRight, Info } from 'lucide-react';
import { cn } from './cn';
import { formatCurrency } from './format';
import type { TaxWarning } from './api';

export interface EstimateNoticeProps {
  /** `disclaimer` from the summary response. */
  disclaimer: string | null | undefined;
  /** `warnings` from the summary response. Render all of them; never filter. */
  warnings: readonly TaxWarning[] | null | undefined;
  /** `assumptions` from the summary response, shown collapsed. */
  assumptions?: readonly string[] | null;
  /** `notModeled` from the summary response, shown collapsed. */
  notModeled?: readonly string[] | null;
  className?: string;
}

/**
 * The text that qualifies every liability figure.
 *
 * The engine returns `disclaimer` and `warnings` next to every number so that
 * a caller cannot show one without the other. This component is how a page
 * honours that: render it on the same screen as any figure from the estimate,
 * below the figures. It renders nothing only when there is nothing to say (no
 * disclaimer and no warnings), which the API never produces for a successful
 * estimate.
 */
export function EstimateNotice({ disclaimer, warnings, assumptions, notModeled, className }: EstimateNoticeProps) {
  const list = warnings ?? [];
  if (!disclaimer && list.length === 0) return null;

  return (
    <section
      aria-label="About this estimate"
      // In print the box styling is dropped: once the lists are expanded the
      // notice can run past a page, and a bordered box sliced by a page break
      // left a stray border line at the top of page 2 (second e2e pass).
      className={cn(
        'rounded-card border border-border bg-card p-5 shadow-card md:p-6',
        'print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none',
        className,
      )}
    >
      {disclaimer && (
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info print:hidden" aria-hidden>
            <Info size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">About this estimate</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{disclaimer}</p>
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div className={cn('rounded-xl border border-warning/30 bg-warning/5 p-4 print:border-0 print:bg-transparent print:p-0', disclaimer && 'mt-4')}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg print:break-after-avoid">
            <AlertTriangle size={16} className="text-warning" aria-hidden />
            Worth checking ({list.length})
          </h3>
          <ul className="mt-2.5 flex flex-col gap-2 text-sm leading-relaxed text-fg-muted">
            {list.map((w, i) => (
              <li key={`${w.code}-${i}`} className="flex gap-2 print:break-inside-avoid">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                <span>
                  {w.message}
                  {w.amount ? <span className="whitespace-nowrap text-fg-faint"> (about {formatCurrency(w.amount)})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {assumptions && assumptions.length > 0 && <CollapsibleList title={`What this estimate assumes (${assumptions.length})`} items={assumptions} />}

      {notModeled && notModeled.length > 0 && <CollapsibleList title={`What it leaves out (${notModeled.length})`} items={notModeled} />}
    </section>
  );
}

/**
 * Collapsed on screen, always expanded on paper.
 *
 * Browsers do not print the contents of a closed `<details>`, and paper has no
 * way to open one; the second e2e pass found the CPA organizer printing these
 * two headings with nothing under them, on the one document meant to leave the
 * app. So the list is rendered twice: the `<details>` for the screen, hidden
 * in print, and a plain copy that exists only in print. `hidden` keeps the
 * copy out of the accessibility tree on screen, so it is not read twice.
 */
function CollapsibleList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <>
      <details className="group mt-4 border-t border-border pt-3 text-sm text-fg-muted print:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight size={16} className="transition-transform group-open:rotate-90" aria-hidden />
          {title}
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-9 leading-relaxed">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </details>

      <div className="mt-4 hidden border-t border-border pt-3 text-sm text-fg-muted print:block" data-print-copy>
        <h3 className="font-medium text-fg print:break-after-avoid">{title}</h3>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
          {items.map((item, i) => (
            <li key={i} className="print:break-inside-avoid">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
