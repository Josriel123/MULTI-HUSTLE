import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { cents, dollars, money, Money, nonNegativeMoney, notBelowZero, sum, TaxInputError, times, toFixed2, toNumber } from '../money';
import { expectMoney } from './helpers';

describe('money()', () => {
  it('keeps cents exact where binary floats do not', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expectMoney(money('0.1').plus(money('0.2')), '0.30');
    expectMoney(money(0.1).plus(money(0.2)), '0.30');
  });

  it('accepts strings, numbers, decimal.js instances and Prisma.Decimal instances', () => {
    expectMoney(money('1234.5'), '1234.50');
    expectMoney(money(1234.5), '1234.50');
    expectMoney(money(new Decimal('1234.5')), '1234.50');
    // Prisma bundles its own copy of decimal.js; instances are not `instanceof` ours.
    const fromPrisma = new Prisma.Decimal('18400.00');
    expect(fromPrisma instanceof Money).toBe(false);
    expectMoney(money(fromPrisma), '18400.00');
    expect(money(fromPrisma) instanceof Money).toBe(true);
  });

  it('rejects non-finite numbers and unparsable strings with a TaxInputError naming the field', () => {
    expect(() => money(NaN, 'gross')).toThrow(TaxInputError);
    expect(() => money(Infinity)).toThrow(/finite/);
    expect(() => money('abc', 'box1')).toThrow(/box1/);
    expect(() => money('')).toThrow(TaxInputError);
    expect(() => money('12,000')).toThrow(TaxInputError);
  });

  it('nonNegativeMoney rejects negatives', () => {
    expectMoney(nonNegativeMoney('0', 'x'), '0.00');
    expect(() => nonNegativeMoney('-0.01', 'box5')).toThrow(/box5.*negative/);
  });
});

describe('rounding', () => {
  it('cents() rounds half up to two places', () => {
    expectMoney(cents(money('2.345')), '2.35');
    expectMoney(cents(money('2.344')), '2.34');
    expectMoney(cents(money('2.3449999')), '2.34');
    expectMoney(cents(money('-2.345')), '-2.35');
    expectMoney(cents(money('1339.075')), '1339.08');
  });

  it('dollars() rounds half up to whole dollars', () => {
    expect(dollars(money('12.50')).toString()).toBe('13');
    expect(dollars(money('12.49')).toString()).toBe('12');
  });

  it('notBelowZero clamps at zero', () => {
    expectMoney(notBelowZero(money('-5')), '0.00');
    expectMoney(notBelowZero(money('5')), '5.00');
  });

  it('times() multiplies by an exact decimal rate', () => {
    expectMoney(cents(times(money('44000'), '0.9235')), '40634.00');
    expectMoney(cents(times(money('46175'), '0.029')), '1339.08');
  });

  it('sum() adds a list exactly', () => {
    expectMoney(sum([money('0.1'), money('0.2'), money('0.3')]), '0.60');
    expectMoney(sum([]), '0.00');
  });

  it('serialises to numbers and fixed strings only after rounding', () => {
    expect(toNumber(money('1234.565'))).toBe(1234.57);
    expect(toFixed2(money('7'))).toBe('7.00');
  });
});
