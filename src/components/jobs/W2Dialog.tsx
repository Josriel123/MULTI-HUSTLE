'use client';

import { useState, type FormEvent } from 'react';
import { createW2, errorText, updateW2, type W2Input, type W2Item } from '../api';
import { normalizeMoneyText } from '../moneyText';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Checkbox, Field, FieldGrid, Input, MoneyInput, RadioCard } from '../ui/Field';
import { InlineStatus } from '../ui/InlineStatus';

type Form = {
  employer: string;
  wages: string;
  federalWithheld: string;
  socialSecurityWages: string;
  medicareWages: string;
  socialSecurityTips: string;
  medicareWithheld: string;
  ownedByTaxpayer: boolean;
  /** Boxes 3 and 5 follow box 1 until the user says they differ. */
  sameAsBox1: boolean;
};

function initial(form: W2Item | null): Form {
  if (!form) {
    return {
      employer: '',
      wages: '',
      federalWithheld: '',
      socialSecurityWages: '',
      medicareWages: '',
      socialSecurityTips: '',
      medicareWithheld: '',
      ownedByTaxpayer: true,
      sameAsBox1: true,
    };
  }
  const blankZero = (v: string) => (v === '0.00' ? '' : v);
  return {
    employer: form.employer,
    wages: form.wages,
    federalWithheld: blankZero(form.federalWithheld),
    socialSecurityWages: form.socialSecurityWages,
    medicareWages: form.medicareWages,
    socialSecurityTips: blankZero(form.socialSecurityTips),
    medicareWithheld: blankZero(form.medicareWithheld),
    ownedByTaxpayer: form.ownedByTaxpayer,
    // Only a string comparison of what the server sent back, never arithmetic.
    sameAsBox1: form.socialSecurityWages === form.wages && form.medicareWages === form.wages,
  };
}

/**
 * Add or edit one W-2. Box numbers are shown with every field, because the
 * form itself is what people copy from. Boxes 3 and 5 usually equal box 1
 * and follow it unless the user unticks "same as box 1" (pre-tax retirement
 * savings, for example, lower box 1 but not 3 or 5).
 */
export function W2Dialog({
  open,
  onClose,
  editing,
  taxYear,
  jointReturn,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: W2Item | null;
  taxYear: number;
  /** Married filing jointly: ask whose W-2 it is. */
  jointReturn: boolean;
  onSaved: () => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.employer}` : `Add a W-2 for ${taxYear}`}
      description="Copy the boxes from the W-2. Before it arrives, your latest pay stub's year-to-date figures work."
      size="lg"
    >
      {open && <W2Form key={editing?.id ?? 'new'} editing={editing} taxYear={taxYear} jointReturn={jointReturn} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function W2Form({
  editing,
  taxYear,
  jointReturn,
  onClose,
  onSaved,
}: {
  editing: W2Item | null;
  taxYear: number;
  jointReturn: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<Form>(() => initial(editing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const wages = normalizeMoneyText(form.wages);
    const input: W2Input = {
      employer: form.employer,
      wages,
      federalWithheld: normalizeMoneyText(form.federalWithheld),
      socialSecurityWages: form.sameAsBox1 ? wages : normalizeMoneyText(form.socialSecurityWages),
      medicareWages: form.sameAsBox1 ? wages : normalizeMoneyText(form.medicareWages),
      socialSecurityTips: normalizeMoneyText(form.socialSecurityTips),
      medicareWithheld: normalizeMoneyText(form.medicareWithheld),
      // Only a joint return has a spouse's W-2 on it; otherwise it is always the user's.
      ownedByTaxpayer: jointReturn ? form.ownedByTaxpayer : true,
    };
    setSaving(true);
    try {
      if (editing) await updateW2(editing.id, input);
      else await createW2(taxYear, input);
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not save the W-2.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field htmlFor="w2-employer" label="Employer" hint="Whatever you call this job. Only you see it.">
        <Input id="w2-employer" value={form.employer} maxLength={80} placeholder="e.g. Blue Bottle Cafe" onChange={(e) => set({ employer: e.target.value })} required autoFocus />
      </Field>

      {jointReturn && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Whose W-2 is this?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioCard
              id="w2-owner-me"
              name="w2-owner"
              checked={form.ownedByTaxpayer}
              onChange={() => set({ ownedByTaxpayer: true })}
              label="Mine"
              description="I also run the side hustles."
            />
            <RadioCard
              id="w2-owner-spouse"
              name="w2-owner"
              checked={!form.ownedByTaxpayer}
              onChange={() => set({ ownedByTaxpayer: false })}
              label="My spouse's"
              description="Counts toward our joint income, but not toward my self-employment tax."
            />
          </div>
        </fieldset>
      )}

      <FieldGrid>
        <Field htmlFor="w2-box1" label="Wages" aside="Box 1" hint="Wages, tips, other compensation.">
          <MoneyInput id="w2-box1" value={form.wages} onChange={(e) => set({ wages: e.target.value })} required />
        </Field>
        <Field htmlFor="w2-box2" label="Federal tax withheld" aside="Box 2" hint="Already paid toward your tax.">
          <MoneyInput id="w2-box2" value={form.federalWithheld} onChange={(e) => set({ federalWithheld: e.target.value })} />
        </Field>
      </FieldGrid>

      <Checkbox
        id="w2-same"
        checked={form.sameAsBox1}
        onChange={(e) => set({ sameAsBox1: e.target.checked, socialSecurityWages: e.target.checked ? '' : form.wages, medicareWages: e.target.checked ? '' : form.wages })}
        label="Box 3 and box 5 are the same as box 1"
        description="True on most W-2s. Untick if you save into a 401(k) or similar before tax, which lowers box 1 only."
      />

      {!form.sameAsBox1 && (
        <FieldGrid className="animate-fade-in">
          <Field htmlFor="w2-box3" label="Social Security wages" aside="Box 3">
            <MoneyInput id="w2-box3" value={form.socialSecurityWages} onChange={(e) => set({ socialSecurityWages: e.target.value })} required />
          </Field>
          <Field htmlFor="w2-box5" label="Medicare wages and tips" aside="Box 5">
            <MoneyInput id="w2-box5" value={form.medicareWages} onChange={(e) => set({ medicareWages: e.target.value })} required />
          </Field>
        </FieldGrid>
      )}

      <details className="group rounded-lg border border-border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-fg-muted hover:text-fg">More boxes: tips and Medicare withheld (optional)</summary>
        <FieldGrid className="mt-4">
          <Field htmlFor="w2-box7" label="Social Security tips" aside="Box 7" hint="Only if you had reported tips.">
            <MoneyInput id="w2-box7" value={form.socialSecurityTips} onChange={(e) => set({ socialSecurityTips: e.target.value })} />
          </Field>
          <Field htmlFor="w2-box6" label="Medicare tax withheld" aside="Box 6" hint="Matters only for high earners.">
            <MoneyInput id="w2-box6" value={form.medicareWithheld} onChange={(e) => set({ medicareWithheld: e.target.value })} />
          </Field>
        </FieldGrid>
      </details>

      {error && <InlineStatus kind="error">{error}</InlineStatus>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {editing ? 'Save changes' : 'Add W-2'}
        </Button>
      </div>
    </form>
  );
}
