import { TaxInputError } from '../money';
import { PARAMETERS_2024 } from './2024';
import { PARAMETERS_2025 } from './2025';
import { PARAMETERS_2026 } from './2026';
import type { TaxYearParameters } from './types';

export * from './types';

/**
 * Every tax year the engine can compute. Adding a year means adding one file
 * here with its own citations, nothing else.
 */
export const TAX_YEAR_PARAMETERS: Readonly<Record<number, TaxYearParameters>> = {
  2024: PARAMETERS_2024,
  2025: PARAMETERS_2025,
  2026: PARAMETERS_2026,
};

export const SUPPORTED_TAX_YEARS: readonly number[] = Object.keys(TAX_YEAR_PARAMETERS)
  .map(Number)
  .sort((a, b) => a - b);

export function isSupportedTaxYear(year: unknown): year is number {
  return typeof year === 'number' && Number.isInteger(year) && Object.prototype.hasOwnProperty.call(TAX_YEAR_PARAMETERS, year);
}

export function getTaxYearParameters(year: number): TaxYearParameters {
  if (!isSupportedTaxYear(year)) {
    throw new TaxInputError(`Tax year ${year} is not supported. Supported years: ${SUPPORTED_TAX_YEARS.join(', ')}.`);
  }
  return TAX_YEAR_PARAMETERS[year];
}

export function latestSupportedTaxYear(): number {
  return SUPPORTED_TAX_YEARS[SUPPORTED_TAX_YEARS.length - 1];
}
