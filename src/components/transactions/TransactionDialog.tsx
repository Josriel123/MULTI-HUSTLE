'use client';

import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Lock } from 'lucide-react';
import { isExpenseCategory, isIncomeCategory } from '@/lib/tax/categories';
import { createTransaction, errorText, updateTransaction, type HustleItem, type TransactionItem, type UpdateTransactionInput } from '../api';
import { CategorySelect } from '../CategorySelect';
import { categoryLabel, defaultTransactionDate } from '../format';
import { HustlePicker, hustleRef, NO_HUSTLE, type HustleChoice } from '../HustlePicker';
import { normalizeMoneyText } from '../moneyText';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { Dialog } from '../ui/Dialog';
import { Field, FieldGrid, Input, MoneyInput } from '../ui/Field';
import { InlineStatus } from '../ui/InlineStatus';
import { SegmentedControl } from '../ui/SegmentedControl';

type Side = 'Income' | 'Expense';

export type TransactionDialogMode = { kind: 'create'; type: Side } | { kind: 'edit'; transaction: TransactionItem };

interface FormState {
  type: Side;
  amount: string;
  date: string;
  description: string;
  category: string;
  hustle: HustleChoice;
}

function initialState(mode: TransactionDialogMode, taxYear: number | undefined): FormState {
  if (mode.kind === 'create') {
    return {
      type: mode.type,
      amount: '',
      date: defaultTransactionDate(taxYear),
      description: '',
      // Money in is nearly always hustle income, so it starts there; money
      // out has no safe default and must be chosen.
      category: mode.type === 'Income' ? 'business_income' : '',
      hustle: NO_HUSTLE,
    };
  }
  const tx = mode.transaction;
  const type: Side = tx.type === 'Income' ? 'Income' : 'Expense';
  // A stored category outside the vocabulary (legacy rows accepted any
  // string) cannot be re-saved, so the select starts empty.
  const known = type === 'Income' ? isIncomeCategory(tx.category) : isExpenseCategory(tx.category);
  return {
    type,
    amount: tx.amount,
    date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '',
    description: tx.description ?? '',
    category: known && tx.category ? tx.category : '',
    hustle: tx.incomeSource?.id ? { mode: 'existing', id: tx.incomeSource.id } : NO_HUSTLE,
  };
}

/**
 * Add or edit one transaction. For a bank-synced row only the category and
 * the hustle can change: the next sync would overwrite anything else, so the
 * server refuses it and the fields are locked here to match.
 */
export function TransactionDialog({
  mode,
  onClose,
  hustles,
  taxYear,
  onSaved,
}: {
  /** Null when closed. */
  mode: TransactionDialogMode | null;
  onClose: () => void;
  hustles: readonly HustleItem[];
  taxYear?: number;
  /** After every successful save; the page reloads what it shows. */
  onSaved: () => Promise<void>;
}) {
  return (
    <Dialog
      open={mode !== null}
      onClose={onClose}
      title={mode?.kind === 'edit' ? 'Edit transaction' : 'Add a transaction'}
      description={mode?.kind === 'edit' ? undefined : 'Money your hustles brought in, or a cost that went with them.'}
    >
      {mode && (
        // Keyed so each opening starts from fresh state.
        <TransactionForm
          key={mode.kind === 'edit' ? mode.transaction.id : `new-${mode.type}`}
          mode={mode}
          onClose={onClose}
          hustles={hustles}
          taxYear={taxYear}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function TransactionForm({
  mode,
  onClose,
  hustles,
  taxYear,
  onSaved,
}: {
  mode: TransactionDialogMode;
  onClose: () => void;
  hustles: readonly HustleItem[];
  taxYear?: number;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(mode, taxYear));
  const [initial] = useState<FormState>(() => initialState(mode, taxYear));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown at the category itself (WCAG 3.3.1), not only in the status line below the form.
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const editing = mode.kind === 'edit' ? mode.transaction : null;
  const locked = Boolean(editing?.plaidTransactionId);

  async function save(addAnother: boolean) {
    setError(null);
    setCategoryError(null);
    setSaved(null);
    if (!form.category) {
      setCategoryError('Choose a category: it decides how this is taxed.');
      document.getElementById('tx-category')?.focus();
      return;
    }
    if (form.hustle.mode === 'new' && form.hustle.name.trim() === '') {
      setError('Give the new hustle a name, or choose "No hustle".');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: UpdateTransactionInput = { category: form.category };
        if (!locked) {
          payload.amount = normalizeMoneyText(form.amount);
          payload.date = form.date;
          payload.description = form.description;
        }
        if (JSON.stringify(form.hustle) !== JSON.stringify(initial.hustle)) {
          if (form.hustle.mode === 'none') payload.incomeSourceId = null;
          else Object.assign(payload, hustleRef(form.hustle));
        }
        await updateTransaction(editing.id, payload);
        await onSaved();
        onClose();
      } else {
        await createTransaction({
          type: form.type,
          amount: normalizeMoneyText(form.amount),
          date: form.date,
          description: form.description.trim() || undefined,
          category: form.category,
          ...hustleRef(form.hustle),
        });
        await onSaved();
        if (addAnother) {
          // Keep the side, date, category and hustle: the next entry is usually alike.
          setForm((f) => ({ ...f, amount: '', description: '', hustle: f.hustle.mode === 'new' ? NO_HUSTLE : f.hustle }));
          setSaved('Saved. Add the next one.');
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(errorText(err, 'Could not save the transaction.'));
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {!editing && (
        <SegmentedControl
          label="Money in or out"
          fullWidth
          value={form.type}
          onChange={(type) => setForm((f) => ({ ...f, type, category: type === 'Income' ? 'business_income' : '' }))}
          options={[
            {
              value: 'Income',
              label: (
                <>
                  <ArrowDownLeft size={16} aria-hidden /> Money in
                </>
              ),
            },
            {
              value: 'Expense',
              label: (
                <>
                  <ArrowUpRight size={16} aria-hidden /> Money out
                </>
              ),
            },
          ]}
        />
      )}

      {locked && (
        <Callout tone="tip">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden />
            From your bank: the amount, date and description come from the bank and would be overwritten on the next sync.
          </span>
        </Callout>
      )}

      <FieldGrid>
        <Field htmlFor="tx-amount" label="Amount">
          <MoneyInput
            id="tx-amount"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
            disabled={locked}
          />
        </Field>
        <Field htmlFor="tx-date" label="Date">
          <Input id="tx-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required disabled={locked} />
        </Field>
      </FieldGrid>

      <Field htmlFor="tx-description" label="What was it?" aside="Optional">
        <Input
          id="tx-description"
          value={form.description}
          maxLength={200}
          placeholder={form.type === 'Income' ? 'e.g. Weekly payout' : 'e.g. Phone mount for the car'}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          disabled={locked}
        />
      </Field>

      <Field
        htmlFor="tx-category"
        label="Category"
        error={categoryError}
        hint={
          editing?.category && !form.category
            ? `Was "${categoryLabel(editing.category)}", which is no longer a category. Choose one.`
            : form.type === 'Income'
              ? 'Decides whether this counts as income. Transfers, loans, refunds and gifts are not income.'
              : 'Decides whether this is deducted. Choose "Personal" for anything that is not a business cost.'
        }
      >
        <CategorySelect
          id="tx-category"
          type={form.type}
          allowEmpty={form.category === ''}
          value={form.category}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? 'tx-category-error' : 'tx-category-hint'}
          onChange={(e) => {
            setCategoryError(null);
            setForm((f) => ({ ...f, category: e.target.value }));
          }}
        />
      </Field>

      <HustlePicker id="tx-hustle" hustles={hustles} value={form.hustle} onChange={(hustle) => setForm((f) => ({ ...f, hustle }))} />

      {error && <InlineStatus kind="error">{error}</InlineStatus>}
      {saved && <InlineStatus kind="ok">{saved}</InlineStatus>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          {saved ? 'Done' : 'Cancel'}
        </Button>
        {!editing && (
          <Button variant="secondary" loading={saving} onClick={() => void save(true)}>
            Save and add another
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving}>
          {editing ? 'Save changes' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
