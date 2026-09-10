import { describe, expect, it } from 'vitest';
import { computeIncomeTax } from '../incomeTax';
import { money } from '../money';
import { getTaxYearParameters } from '../parameters';
import { expectMoney } from './helpers';

/**
 * Known answers worked by hand from the Rev. Proc. tables. Each comment shows
 * the arithmetic so a reviewer can redo it with the table in front of them.
 */
describe('computeIncomeTax', () => {
  it('2024 single, $50,000 taxable income (Rev. Proc. 2023-34 Table 3)', () => {
    // 10% x 11,600 = 1,160.00
    // 12% x (47,150 - 11,600 = 35,550) = 4,266.00
    // 22% x (50,000 - 47,150 = 2,850) = 627.00
    // total 6,053.00. (The Tax Table would show $6,058 for the $50,000-$50,050 band.)
    const r = computeIncomeTax('50000', 'single', getTaxYearParameters(2024));
    expectMoney(r.tax, '6053.00');
    expect(r.slices.map((s) => s.rate.toString())).toEqual(['0.1', '0.12', '0.22']);
    expect(r.marginalRate.toString()).toBe('0.22');
    expect(r.table).toBe('single');
  });

  it('2024 married filing jointly, $100,000 (Table 1: "$10,852 plus 22% of the excess over $94,300")', () => {
    // 10,852 + 22% x (100,000 - 94,300 = 5,700) = 10,852 + 1,254 = 12,106.00
    expectMoney(computeIncomeTax('100000', 'married_filing_jointly', getTaxYearParameters(2024)).tax, '12106.00');
  });

  it('2025 single, $20,113.19 (Table 3: "$1,192.50 plus 12% of the excess over $11,925")', () => {
    // 1,192.50 + 12% x (20,113.19 - 11,925 = 8,188.19) = 1,192.50 + 982.5828 = 2,175.0828 -> 2,175.08
    expectMoney(computeIncomeTax('20113.19', 'single', getTaxYearParameters(2025)).tax, '2175.08');
  });

  it('2025 head of household exactly at a bracket boundary and one cent over', () => {
    // Table 2: "Over $64,850 but not over $103,350: $7,442 plus 22% of the excess over $64,850"
    const p = getTaxYearParameters(2025);
    expectMoney(computeIncomeTax('64850', 'head_of_household', p).tax, '7442.00');
    expectMoney(computeIncomeTax('64850.01', 'head_of_household', p).tax, '7442.00'); // + 0.0022, rounds away
    expectMoney(computeIncomeTax('64860', 'head_of_household', p).tax, '7444.20'); // + 22% x 10
  });

  it('2025 married filing separately hits the 37% bracket at $375,800, unlike single at $626,350', () => {
    const p = getTaxYearParameters(2025);
    // Table 4: "Over $375,800: $101,077.25 plus 37% of the excess over $375,800"
    // 101,077.25 + 37% x (400,000 - 375,800 = 24,200) = 101,077.25 + 8,954 = 110,031.25
    expectMoney(computeIncomeTax('400000', 'married_filing_separately', p).tax, '110031.25');
    // Table 3: "Over $250,525 but not over $626,350: $57,231 plus 35% of the excess over $250,525"
    // 57,231 + 35% x (400,000 - 250,525 = 149,475) = 57,231 + 52,316.25 = 109,547.25
    expectMoney(computeIncomeTax('400000', 'single', p).tax, '109547.25');
  });

  it('2026 single, $1,000,000 (Rev. Proc. 2025-32 Table 3: "$192,979.25 plus 37% of the excess over $640,600")', () => {
    // 192,979.25 + 37% x (1,000,000 - 640,600 = 359,400) = 192,979.25 + 132,978 = 325,957.25
    const r = computeIncomeTax('1000000', 'single', getTaxYearParameters(2026));
    expectMoney(r.tax, '325957.25');
    expect(r.slices).toHaveLength(7);
    expect(r.slices[6].upper).toBeNull();
  });

  it('qualifying surviving spouse is taxed on the joint table', () => {
    const p = getTaxYearParameters(2025);
    // Table 1: "$2,385 plus 12% of the excess over $23,850": 2,385 + 12% x 26,150 = 5,523.00
    expectMoney(computeIncomeTax('50000', 'qualifying_surviving_spouse', p).tax, '5523.00');
    expect(computeIncomeTax('50000', 'qualifying_surviving_spouse', p).table).toBe('joint');
  });

  it('zero and negative taxable income produce zero tax', () => {
    const p = getTaxYearParameters(2025);
    expectMoney(computeIncomeTax('0', 'single', p).tax, '0.00');
    expectMoney(computeIncomeTax('-1000', 'single', p).tax, '0.00');
    expectMoney(computeIncomeTax(money(0), 'married_filing_jointly', p).tax, '0.00');
  });

  it('exposes the per-bracket slices that add up to the total', () => {
    const r = computeIncomeTax('50000', 'single', getTaxYearParameters(2024));
    const total = r.slices.reduce((acc, s) => acc.plus(s.tax), money(0));
    expectMoney(total, '6053.00');
    expectMoney(r.slices[0].taxableInBracket, '11600.00');
    expectMoney(r.slices[1].taxableInBracket, '35550.00');
    expectMoney(r.slices[2].taxableInBracket, '2850.00');
  });
});
