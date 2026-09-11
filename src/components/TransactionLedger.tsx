'use client';

import { useState, type FormEvent } from 'react';
import { Edit2, Lock, PlusCircle, Trash2, X } from 'lucide-react';
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type TransactionItem,
} from './api';
import { categoryLabel, formatCurrency, formatDate } from './format';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Field, FieldGrid, Input, Select } from './ui/Field';
import { InlineStatus } from './ui/InlineStatus';

const EXPENSE_CATEGORIES = [
  'advertising',
  'car_and_truck',
  'commissions_and_fees',
  'contract_labor',
  'insurance',
  'interest',
  'legal_and_professional',
  'office_expense',
  'rent_or_lease',
  'repairs_and_maintenance',
  'supplies',
  'taxes_and_licenses',
  'travel',
  'meals',
  'utilities',
  'software_and_subscriptions',
  'other_business_expense',
  'equipment',
  'education_required_materials',
  'personal',
];

const INCOME_CATEGORIES = [
  'business_income',
  'other_taxable_income',
  'loan_proceeds',
  'transfer',
  'refund',
  'gift',
  'scholarship_refund',
  'investment_proceeds',
  'w2_paycheck',
];

export interface TransactionLedgerProps {
  transactions: TransactionItem[];
  taxYear?: number;
  onRefresh: () => Promise<void>;
}

export function TransactionLedger({ transactions, onRefresh }: TransactionLedgerProps) {
  // New transaction form state
  const [submitting, setSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'Expense',
    category: 'other_business_expense',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    taxDeductible: true,
  });

  // Edit modal state
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    date: '',
    description: '',
    category: '',
    taxDeductible: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<'ALL' | 'Expense' | 'Income'>('ALL');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!formData.amount) return;
    setSubmitting(true);
    setFormStatus(null);
    try {
      await createTransaction({
        amount: formData.amount,
        type: formData.type,
        category: formData.category,
        date: formData.date,
        description: formData.description || undefined,
        taxDeductible: formData.type === 'Expense' ? formData.taxDeductible : false,
      });
      setFormData({
        amount: '',
        type: 'Expense',
        category: 'other_business_expense',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        taxDeductible: true,
      });
      setFormStatus({ kind: 'ok', text: 'Transaction recorded successfully.' });
      await onRefresh();
    } catch (err: unknown) {
      setFormStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to record transaction.' });
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(tx: TransactionItem) {
    setEditingTx(tx);
    setEditError(null);
    setEditFormData({
      amount: tx.amount,
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '',
      description: tx.description || '',
      category: tx.category || (tx.type === 'Income' ? 'business_income' : 'other_business_expense'),
      taxDeductible: tx.taxDeductible,
    });
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingTx) return;
    setSavingEdit(true);
    setEditError(null);

    const isPlaid = Boolean(editingTx.plaidTransactionId);
    const payload: {
      category?: string;
      taxDeductible?: boolean;
      amount?: string;
      date?: string;
      description?: string;
    } = {
      category: editFormData.category,
      taxDeductible: editFormData.taxDeductible,
    };

    if (!isPlaid) {
      payload.amount = editFormData.amount;
      payload.date = editFormData.date;
      payload.description = editFormData.description;
    }

    try {
      await updateTransaction(editingTx.id, payload);
      setEditingTx(null);
      await onRefresh();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update transaction.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteTransaction(id);
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete transaction.');
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'ALL') return true;
    return t.type === filterType;
  });

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Log Transaction Card */}
      <Card padding="lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          <div>
            <CardTitle>Log New Transaction</CardTitle>
            <CardDescription>
              Record business expenses or gross receipts. The tax engine assigns treatment by category, never by description.
            </CardDescription>
          </div>

          <FieldGrid>
            <Field htmlFor="new-amount" label="Amount ($)">
              <Input
                id="new-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="e.g. 150.00"
                value={formData.amount}
                onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </Field>

            <Field htmlFor="new-type" label="Transaction Type">
              <Select
                id="new-type"
                value={formData.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setFormData((f) => ({
                    ...f,
                    type: nextType,
                    taxDeductible: nextType === 'Expense',
                    category: nextType === 'Income' ? 'business_income' : 'other_business_expense',
                  }));
                }}
              >
                <option value="Expense">Expense / Operating Cost</option>
                <option value="Income">Gross Receipts / Income</option>
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field htmlFor="new-category" label="Tax Category">
              <Select
                id="new-category"
                value={formData.category}
                onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
              >
                {(formData.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabel(cat)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field htmlFor="new-date" label="Transaction Date">
              <Input
                id="new-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </Field>
          </FieldGrid>

          <Field
            htmlFor="new-desc"
            label="Memo / Description (Optional)"
            hint="Personal notes for your records; not used for tax determination"
          >
            <Input
              id="new-desc"
              type="text"
              placeholder="e.g. Figma annual subscription"
              value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>

          {formData.type === 'Expense' && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-fg">
              <input
                type="checkbox"
                checked={formData.taxDeductible}
                onChange={(e) => setFormData((f) => ({ ...f, taxDeductible: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
              />
              <span>Qualifies as ordinary and necessary business deduction (Schedule C)</span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              icon={<PlusCircle size={18} aria-hidden />}
            >
              Log Transaction
            </Button>
            {formStatus && <InlineStatus kind={formStatus.kind}>{formStatus.text}</InlineStatus>}
          </div>
        </form>
      </Card>

      {/* Ledger Section */}
      <Card padding="md">
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transaction Ledger</CardTitle>
            <CardDescription>
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'record' : 'records'} logged
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={filterType === 'ALL' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterType('ALL')}
            >
              All
            </Button>
            <Button
              variant={filterType === 'Expense' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterType('Expense')}
            >
              Expenses
            </Button>
            <Button
              variant={filterType === 'Income' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterType('Income')}
            >
              Income
            </Button>
          </div>
        </CardHeader>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-fg-muted">
            No transactions found for the selected filter.
          </div>
        ) : (
          <>
            {/* Desktop Table: visible at md and above */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-fg-faint">
                    <th className="pb-3 pl-2 pr-4 font-semibold">Date</th>
                    <th className="pb-3 px-4 font-semibold">Description / Origin</th>
                    <th className="pb-3 px-4 font-semibold">Category</th>
                    <th className="pb-3 px-4 font-semibold">Classification</th>
                    <th className="pb-3 px-4 text-right font-semibold">Amount</th>
                    <th className="pb-3 pl-4 pr-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.map((t) => {
                    const isPlaid = Boolean(t.plaidTransactionId);
                    const isExpense = t.type === 'Expense';
                    return (
                      <tr key={t.id} className="transition-colors hover:bg-surface/50">
                        <td className="py-3.5 pl-2 pr-4 tabular-nums text-fg-muted whitespace-nowrap">
                          {formatDate(t.date)}
                        </td>
                        <td className="py-3.5 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[220px]">
                              {t.description || (isPlaid ? 'Plaid Synced Bank Entry' : 'Manual Entry')}
                            </span>
                            {isPlaid && <Badge tone="info">Plaid</Badge>}
                          </div>
                          {t.incomeSource && (
                            <div className="text-xs text-fg-faint">{t.incomeSource.name}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge tone="neutral">{categoryLabel(t.category)}</Badge>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isExpense ? (
                            <Badge tone={t.taxDeductible ? 'accent' : 'muted'}>
                              {t.taxDeductible ? 'Deductible' : 'Non-deductible'}
                            </Badge>
                          ) : (
                            <Badge tone="accent">Gross Income</Badge>
                          )}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                            isExpense ? 'text-fg' : 'text-accent'
                          }`}
                        >
                          {isExpense ? `-${formatCurrency(t.amount, { cents: true })}` : `+${formatCurrency(t.amount, { cents: true })}`}
                        </td>
                        <td className="py-3.5 pl-4 pr-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Edit transaction"
                              onClick={() => openEditModal(t)}
                            >
                              <Edit2 size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Delete transaction"
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2 size={15} className="text-danger" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards: visible below md (eliminates horizontal overflow on 375px screens) */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredTransactions.map((t) => {
                const isPlaid = Boolean(t.plaidTransactionId);
                const isExpense = t.type === 'Expense';
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-fg">
                            {t.description || (isPlaid ? 'Plaid Synced Entry' : 'Manual Entry')}
                          </span>
                          {isPlaid && <Badge tone="info">Plaid</Badge>}
                        </div>
                        <div className="text-xs text-fg-muted">{formatDate(t.date)}</div>
                      </div>
                      <div
                        className={`shrink-0 font-bold tabular-nums text-base ${
                          isExpense ? 'text-fg' : 'text-accent'
                        }`}
                      >
                        {isExpense ? `-${formatCurrency(t.amount, { cents: true })}` : `+${formatCurrency(t.amount, { cents: true })}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="neutral">{categoryLabel(t.category)}</Badge>
                      {isExpense ? (
                        <Badge tone={t.taxDeductible ? 'accent' : 'muted'}>
                          {t.taxDeductible ? 'Deductible' : 'Non-deductible'}
                        </Badge>
                      ) : (
                        <Badge tone="accent">Gross Income</Badge>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Edit2 size={14} />}
                        onClick={() => openEditModal(t)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleDelete(t.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-slide-up">
          <div className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-card border border-border bg-card p-6 shadow-2xl md:p-8">
            <button
              onClick={() => setEditingTx(null)}
              className="absolute right-4 top-4 text-fg-muted hover:text-fg"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-5">
              <div>
                <h3 className="text-xl font-bold">Edit Transaction</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Update taxonomy classification and tax-deductibility attributes.
                </p>
              </div>

              {Boolean(editingTx.plaidTransactionId) && (
                <div className="flex items-start gap-3 rounded-lg border border-info/40 bg-info/10 p-3.5 text-sm text-info">
                  <Lock size={18} className="mt-0.5 shrink-0" aria-hidden />
                  <div className="leading-relaxed">
                    <strong>Bank-synced transaction: </strong>
                    Amount and date are locked to prevent next sync cycle from overwriting changes. Category and
                    tax-deductible status may be updated freely.
                  </div>
                </div>
              )}

              <FieldGrid>
                <Field
                  htmlFor="edit-amount"
                  label="Amount ($)"
                  hint={editingTx.plaidTransactionId ? 'Locked (Bank synced)' : undefined}
                >
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData((f) => ({ ...f, amount: e.target.value }))}
                    disabled={Boolean(editingTx.plaidTransactionId)}
                    required
                  />
                </Field>

                <Field
                  htmlFor="edit-date"
                  label="Date"
                  hint={editingTx.plaidTransactionId ? 'Locked (Bank synced)' : undefined}
                >
                  <Input
                    id="edit-date"
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData((f) => ({ ...f, date: e.target.value }))}
                    disabled={Boolean(editingTx.plaidTransactionId)}
                    required
                  />
                </Field>
              </FieldGrid>

              <Field htmlFor="edit-category" label="Tax Category">
                <Select
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData((f) => ({ ...f, category: e.target.value }))}
                >
                  {(editingTx.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </option>
                  ))}
                </Select>
              </Field>

              {!editingTx.plaidTransactionId && (
                <Field htmlFor="edit-desc" label="Description">
                  <Input
                    id="edit-desc"
                    type="text"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData((f) => ({ ...f, description: e.target.value }))}
                  />
                </Field>
              )}

              {editingTx.type === 'Expense' && (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-fg">
                  <input
                    type="checkbox"
                    checked={editFormData.taxDeductible}
                    onChange={(e) => setEditFormData((f) => ({ ...f, taxDeductible: e.target.checked }))}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                  />
                  <span>Mark as tax-deductible business expense</span>
                </label>
              )}

              {editError && <InlineStatus kind="error">{editError}</InlineStatus>}

              <div className="mt-2 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button variant="secondary" onClick={() => setEditingTx(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={savingEdit}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
