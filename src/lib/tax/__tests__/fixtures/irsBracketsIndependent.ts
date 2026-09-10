import type { BracketTableKey } from '../../parameters/types';

/**
 * A SECOND transcription of the §1(j)(2) rate tables, made independently of
 * `parameters/*.ts` during the 2026-09-09 audit from the IRS PDFs of
 * Rev. Proc. 2023-34 (pp. 5-7), Rev. Proc. 2024-40 (pp. 5-6) and
 * Rev. Proc. 2025-32 (pp. 10-12). Source: docs/audits/federal-tax-2026-09-09/parameters.md,
 * "Complete bracket comparison".
 *
 * `tops` are the six finite bracket ceilings; `bases` are the cumulative tax at
 * each of those ceilings, i.e. the "$B" printed in the next row's "$B plus R%
 * of the excess". Do NOT regenerate this file from the production tables: its
 * value is that it was typed from the source by someone else.
 */
export interface IndependentBracketTable {
  year: number;
  table: BracketTableKey;
  tops: readonly [string, string, string, string, string, string];
  bases: readonly [string, string, string, string, string, string];
}

export const INDEPENDENT_RATES = ['0.10', '0.12', '0.22', '0.24', '0.32', '0.35', '0.37'] as const;

export const INDEPENDENT_BRACKETS: readonly IndependentBracketTable[] = [
  { year: 2024, table: 'joint', tops: ['23200', '94300', '201050', '383900', '487450', '731200'], bases: ['2320', '10852', '34337', '78221', '111357', '196669.50'] },
  { year: 2024, table: 'head_of_household', tops: ['16550', '63100', '100500', '191950', '243700', '609350'], bases: ['1655', '7241', '15469', '37417', '53977', '181954.50'] },
  { year: 2024, table: 'single', tops: ['11600', '47150', '100525', '191950', '243725', '609350'], bases: ['1160', '5426', '17168.50', '39110.50', '55678.50', '183647.25'] },
  { year: 2024, table: 'married_filing_separately', tops: ['11600', '47150', '100525', '191950', '243725', '365600'], bases: ['1160', '5426', '17168.50', '39110.50', '55678.50', '98334.75'] },
  { year: 2025, table: 'joint', tops: ['23850', '96950', '206700', '394600', '501050', '751600'], bases: ['2385', '11157', '35302', '80398', '114462', '202154.50'] },
  { year: 2025, table: 'head_of_household', tops: ['17000', '64850', '103350', '197300', '250500', '626350'], bases: ['1700', '7442', '15912', '38460', '55484', '187031.50'] },
  { year: 2025, table: 'single', tops: ['11925', '48475', '103350', '197300', '250525', '626350'], bases: ['1192.50', '5578.50', '17651', '40199', '57231', '188769.75'] },
  { year: 2025, table: 'married_filing_separately', tops: ['11925', '48475', '103350', '197300', '250525', '375800'], bases: ['1192.50', '5578.50', '17651', '40199', '57231', '101077.25'] },
  { year: 2026, table: 'joint', tops: ['24800', '100800', '211400', '403550', '512450', '768700'], bases: ['2480', '11600', '35932', '82048', '116896', '206583.50'] },
  { year: 2026, table: 'head_of_household', tops: ['17700', '67450', '105700', '201750', '256200', '640600'], bases: ['1770', '7740', '16155', '39207', '56631', '191171'] },
  { year: 2026, table: 'single', tops: ['12400', '50400', '105700', '201775', '256225', '640600'], bases: ['1240', '5800', '17966', '41024', '58448', '192979.25'] },
  { year: 2026, table: 'married_filing_separately', tops: ['12400', '50400', '105700', '201775', '256225', '384350'], bases: ['1240', '5800', '17966', '41024', '58448', '103291.75'] },
];
