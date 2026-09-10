import { expect } from 'vitest';
import type { Money } from '../money';

/** Assert a Money equals a fixed two-decimal string, e.g. `expectMoney(x, '6053.00')`. */
export function expectMoney(actual: Money, expected: string): void {
  expect(actual.toFixed(2)).toBe(expected);
}
