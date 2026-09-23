import { AlertTriangle, Info } from 'lucide-react';
import { cn } from './cn';
import { formatCurrency } from './format';
import type { TaxWarning } from './api';

export interface EstimateNoticeProps {
  /** `disclaimer` from the summary response. */
  disclaimer: string | null | undefined;
  /** `warnings` from the summary response. Render all of them; never filter. */
  warnings: TaxWarning[] | null | undefined;
  /** `assumptions` from the summary response, shown collapsed. */
  assumptions?: string[] | null;
  /** `notModeled` from the summary response, shown collapsed. */
  notModeled?: string[] | null;
  className?: string;
}

/**
 * The text that qualifies every liability figure.
 *
 * The engine returns `disclaimer` and `warnings` next to every number so that
 * a caller cannot show one without the other. This component is how a page
 * honours that: render it on the same screen as any figure from the estimate,
 * below the figures, before anything else. It renders nothing only when there
 * is nothing to say (no disclaimer and no warnings), which the API never
 * produces for a successful estimate.
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
        'rounded-card border border-border bg-card px-4 py-4 md:px-6 md:py-5',
        'print:rounded-none print:border-0 print:bg-transparent print:p-0',
        className,
      )}
    >
      {disclaimer && (
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-info" aria-hidden />
          <p className="text-sm leading-relaxed text-fg-muted">
            <strong className="text-fg">Estimate, not tax advice. </strong>
            {disclaimer}
          </p>
        </div>
      )}

      {list.length > 0 && (
        <div className={cn(disclaimer && 'mt-4 border-t border-border pt-4')}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger print:break-after-avoid">
            <AlertTriangle size={16} aria-hidden />
            Estimate notices ({list.length})
          </h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-fg-muted">
            {list.map((w, i) => (
              <li key={`${w.code}-${i}`} className="print:break-inside-avoid">
                {w.message}
                {w.amount ? <span className="text-fg-faint"> (affects about {formatCurrency(w.amount)})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assumptions && assumptions.length > 0 && (
        <CollapsibleList title={`Assumptions this estimate makes (${assumptions.length})`} items={assumptions} />
      )}

      {notModeled && notModeled.length > 0 && (
        <CollapsibleList title={`Tax items not modeled by this engine (${notModeled.length})`} items={notModeled} />
      )}
    </section>
  );
}

/**
 * Collapsed on screen, always expanded on paper.
 *
 * Browsers do not print the contents of a closed `<details>`, and paper has no
 * way to open one — the second e2e pass found the CPA organizer printing these
 * two headings with nothing under them, on the one document meant to leave the
 * app. So the list is rendered twice: the `<details>` for the screen, hidden
 * in print, and a plain copy that exists only in print. `hidden` keeps the
 * copy out of the accessibility tree on screen, so it is not read twice.
 */
function CollapsibleList({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <details className="mt-4 border-t border-border pt-3 text-sm text-fg-muted print:hidden">
        <summary className="cursor-pointer font-medium text-fg-muted hover:text-fg">{title}</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
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
