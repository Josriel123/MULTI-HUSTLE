'use client';

import { HUSTLE_KIND_KEYS, HUSTLE_KINDS, HUSTLE_NAME_MAX } from '@/lib/hustles';
import type { HustleItem, HustleRef } from './api';
import { Field, Input, Select } from './ui/Field';

/** What the picker holds: no hustle, an existing one, or a new one to be created on save. */
export type HustleChoice = { mode: 'none' } | { mode: 'existing'; id: string } | { mode: 'new'; name: string; kind: string };

export const NO_HUSTLE: HustleChoice = { mode: 'none' };

/** The request fields for a choice. A new hustle is created by the server, found by name first. */
export function hustleRef(choice: HustleChoice): HustleRef {
  if (choice.mode === 'existing') return { incomeSourceId: choice.id };
  if (choice.mode === 'new' && choice.name.trim() !== '') return { sourceName: choice.name.trim(), sourceType: choice.kind };
  return {};
}

const NEW = '__new__';

/**
 * "Which hustle is this for?" A select of the user's hustles, plus "Add a new
 * hustle", which opens a name box and a kind picker in place. Optional: a
 * hustle only groups income on the overview; the category decides the tax.
 */
export function HustlePicker({
  id,
  hustles,
  value,
  onChange,
  label = 'Hustle',
  hint = 'Groups your income on the overview. Optional.',
}: {
  id: string;
  hustles: readonly HustleItem[];
  value: HustleChoice;
  onChange: (value: HustleChoice) => void;
  label?: string;
  hint?: string;
}) {
  const selectValue = value.mode === 'existing' ? value.id : value.mode === 'new' ? NEW : '';
  return (
    <div className="flex flex-col gap-3">
      <Field htmlFor={id} label={label} hint={value.mode === 'new' ? undefined : hint}>
        <Select
          id={id}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onChange(NO_HUSTLE);
            else if (v === NEW) onChange({ mode: 'new', name: '', kind: 'Delivery' });
            else onChange({ mode: 'existing', id: v });
          }}
        >
          <option value="">No hustle</option>
          {hustles.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          <option value={NEW}>+ Add a new hustle…</option>
        </Select>
      </Field>
      {value.mode === 'new' && (
        <div className="grid animate-fade-in gap-3 rounded-lg border border-dashed border-border-strong bg-surface/60 p-3 sm:grid-cols-2">
          <Field htmlFor={`${id}-name`} label="New hustle's name">
            <Input
              id={`${id}-name`}
              value={value.name}
              maxLength={HUSTLE_NAME_MAX}
              placeholder="e.g. DoorDash"
              autoFocus
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
          </Field>
          <Field htmlFor={`${id}-kind`} label="Kind">
            <Select id={`${id}-kind`} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value })}>
              {HUSTLE_KIND_KEYS.map((k) => (
                <option key={k} value={k}>
                  {HUSTLE_KINDS[k].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}
