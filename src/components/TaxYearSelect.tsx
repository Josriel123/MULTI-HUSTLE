'use client';

import { SUPPORTED_TAX_YEARS } from '@/lib/tax/parameters';
import { Select } from './ui/Field';

export interface TaxYearSelectProps {
  /** The year currently shown. `undefined` while the first response is loading. */
  value: number | undefined;
  onChange: (taxYear: number) => void;
  id?: string;
  className?: string;
}

/**
 * Picks the tax year the page is looking at. The list is the engine's own
 * `SUPPORTED_TAX_YEARS`, so the UI can never offer a year the API rejects.
 */
export function TaxYearSelect({ value, onChange, id = 'tax-year', className }: TaxYearSelectProps) {
  return (
    <label className={className}>
      <span className="sr-only">Tax year</span>
      <Select
        id={id}
        aria-label="Tax year"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-auto min-w-[9rem] pr-8 text-sm font-medium"
      >
        {value === undefined && <option value="">Tax year…</option>}
        {SUPPORTED_TAX_YEARS.map((year) => (
          <option key={year} value={year}>
            Tax year {year}
          </option>
        ))}
      </Select>
    </label>
  );
}
