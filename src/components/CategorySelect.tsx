'use client';

import type { SelectHTMLAttributes } from 'react';
import { expenseCategoryGroups, incomeCategoryGroups } from './categoryOptions';
import { Select } from './ui/Field';

const EXPENSE_GROUPS = expenseCategoryGroups();
const INCOME_GROUPS = incomeCategoryGroups();

/**
 * The category picker for one side of the ledger, grouped by what the
 * category does to the estimate. `allowEmpty` adds an empty first option for
 * a transaction that has none yet, rather than preselecting a guess.
 */
export function CategorySelect({
  type,
  allowEmpty = false,
  ...rest
}: { type: 'Income' | 'Expense'; allowEmpty?: boolean } & SelectHTMLAttributes<HTMLSelectElement>) {
  const groups = type === 'Income' ? INCOME_GROUPS : EXPENSE_GROUPS;
  return (
    <Select {...rest}>
      {allowEmpty && <option value="">Choose a category…</option>}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
