'use client';

import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { HUSTLE_KIND_KEYS, HUSTLE_KINDS, HUSTLE_NAME_MAX } from '@/lib/hustles';
import { deleteHustle, errorText, updateHustle, type HustleItem } from '../api';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { Input, Select } from '../ui/Field';
import { InlineStatus } from '../ui/InlineStatus';

/**
 * Rename, re-kind, merge or delete hustles. Renaming one to the name of
 * another merges them (the server moves every transaction and trip across),
 * which is how a list full of bank-description hustles gets tidied up.
 */
export function HustleManager({
  open,
  onClose,
  hustles,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  hustles: readonly HustleItem[];
  onChanged: () => Promise<void>;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = useState<{ id: string; name: string; type: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function saveEdit(h: HustleItem) {
    if (!editing) return;
    const name = editing.name.trim();
    const twin = hustles.find((o) => o.id !== h.id && o.name.toLowerCase() === name.toLowerCase());
    if (twin) {
      const ok = await confirm({
        title: `Merge into "${twin.name}"?`,
        body: `"${h.name}" and its ${h.transactionCount} transaction${h.transactionCount === 1 ? '' : 's'} move into "${twin.name}", and "${h.name}" is removed. The estimate does not change: hustles only group income.`,
        confirmLabel: 'Merge',
      });
      if (!ok) return;
    }
    setBusyId(h.id);
    setStatus(null);
    try {
      const result = await updateHustle(h.id, { name, type: editing.type });
      setEditing(null);
      await onChanged();
      setStatus({ kind: 'ok', text: result.merged ? `Merged into "${result.into.name}": ${result.moved} transaction${result.moved === 1 ? '' : 's'} moved.` : 'Saved.' });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not save the hustle.') });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(h: HustleItem) {
    const ok = await confirm({
      title: `Delete "${h.name}"?`,
      body:
        h.transactionCount > 0
          ? `Its ${h.transactionCount} transaction${h.transactionCount === 1 ? '' : 's'} stay, with no hustle chosen. The estimate does not change.`
          : 'Nothing is recorded against it.',
      confirmLabel: 'Delete hustle',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(h.id);
    setStatus(null);
    try {
      await deleteHustle(h.id);
      await onChanged();
      setStatus({ kind: 'ok', text: `"${h.name}" deleted.` });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not delete the hustle.') });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Your hustles" description="Rename one to another's name to merge the two." size="lg">
      {status && <InlineStatus kind={status.kind} className="mb-4">{status.text}</InlineStatus>}
      {hustles.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">No hustles yet. Choose &ldquo;Add a new hustle&rdquo; when you add a transaction.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {hustles.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              {editing?.id === h.id ? (
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label="Hustle name"
                    value={editing.name}
                    maxLength={HUSTLE_NAME_MAX}
                    autoFocus
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <Select aria-label="Kind" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="h-9 text-sm sm:w-52">
                    {HUSTLE_KIND_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {HUSTLE_KINDS[k].label}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-fg-faint">
                    {HUSTLE_KINDS[h.type as keyof typeof HUSTLE_KINDS]?.label ?? h.type} · {h.transactionCount} transaction{h.transactionCount === 1 ? '' : 's'}
                    {h.tripCount > 0 && ` · ${h.tripCount} trip${h.tripCount === 1 ? '' : 's'}`}
                  </p>
                </div>
              )}
              <div className="flex shrink-0 gap-1 self-end sm:self-center">
                {editing?.id === h.id ? (
                  <>
                    <Button size="sm" variant="primary" loading={busyId === h.id} icon={<Check size={14} aria-hidden />} onClick={() => void saveEdit(h)} disabled={editing.name.trim() === ''}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)} className="px-2">
                      <X size={15} aria-hidden />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" className="px-2" aria-label={`Rename ${h.name}`} onClick={() => setEditing({ id: h.id, name: h.name, type: h.type })}>
                      <Pencil size={15} aria-hidden />
                    </Button>
                    <Button size="sm" variant="ghost" className="px-2 hover:text-danger" aria-label={`Delete ${h.name}`} loading={busyId === h.id} onClick={() => void remove(h)}>
                      <Trash2 size={15} aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </Dialog>
  );
}
