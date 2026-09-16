/**
 * Federal tax estimate engine for self-employed individuals.
 *
 * Pure functions only: no database, no auth, no network. Start with
 * `estimateFederalTax` (engine.ts) and read `README.md` in this directory for
 * the computation order, the sources, and what is deliberately left out.
 */
export * from './money';
export * from './types';
export * from './categories';
export * from './parameters';
export * from './scheduleC';
export * from './homeOffice';
export * from './scheduleSE';
export * from './scholarships';
export * from './studentLoanInterest';
export * from './standardDeduction';
export * from './qbi';
export * from './incomeTax';
export * from './mileage';
export * from './disclaimer';
export * from './engine';
export * from './adapters/prismaRows';
export * from './adapters/estimateFromRows';
