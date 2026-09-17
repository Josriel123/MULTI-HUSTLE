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
      className={cn('rounded-card border border-border bg-card px-4 py-4 md:px-6 md:py-5', className)}
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
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle size={16} aria-hidden />
            Estimate notices ({list.length})
          </h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-fg-muted">
            {list.map((w, i) => (
              <li key={`${w.code}-${i}`}>
                {w.message}
                {w.amount ? <span className="text-fg-faint"> (affects about {formatCurrency(w.amount)})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assumptions && assumptions.length > 0 && (
        <details className="mt-4 border-t border-border pt-3 text-sm text-fg-muted">
          <summary className="cursor-pointer font-medium text-fg-muted hover:text-fg">
            Assumptions this estimate makes ({assumptions.length})
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
            {assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      {notModeled && notModeled.length > 0 && (
        <details className="mt-4 border-t border-border pt-3 text-sm text-fg-muted">
          <summary className="cursor-pointer font-medium text-fg-muted hover:text-fg">
            Tax items not modeled by this engine ({notModeled.length})
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
            {notModeled.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
