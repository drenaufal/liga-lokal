"use client";

import * as React from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { rethrowControlFlow } from "@/lib/action-helpers";
import { formatNumber } from "@/lib/utils";

/**
 * Destructive delete that spells out what goes with it and asks for a name to
 * be typed first. Blocked (with the reason) while something is in play.
 * `onDelete` runs the server action; a redirect it throws is passed through.
 */
export function TypedDeleteDialog({
  triggerLabel,
  title,
  name,
  confirmText,
  confirmLabel,
  items,
  note,
  blockedReason,
  onDelete,
  errorTitle,
}: {
  triggerLabel: string;
  title: string;
  /** Shown in the dialog so the person sees exactly what is being deleted. */
  name: string;
  /** What has to be typed to unlock the button. */
  confirmText: string;
  confirmLabel: string;
  /** What goes with it: label + count. Zero rows are left out. */
  items: [string, number][];
  note?: string;
  blockedReason?: string | null;
  onDelete: (typed: string) => Promise<unknown>;
  errorTitle: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, start] = React.useTransition();
  const matches = typed.trim() === confirmText;
  const blocked = !!blockedReason;

  const submit = () =>
    start(async () => {
      try {
        await onDelete(typed);
      } catch (e) {
        rethrowControlFlow(e);
        toast.error(errorTitle, e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setTyped("");
        }}
      >
        <DialogContent title={title} description="Tindakan ini permanen dan tidak dapat dibatalkan." className="max-w-md">
          <div className="space-y-4">
            <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm font-semibold text-ink">{name}</p>

            <ul className="space-y-1.5 text-xs text-ink-secondary">
              {items
                .filter(([, n]) => n > 0)
                .map(([label, n]) => (
                  <li key={label} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1.5">
                    <span>{label[0].toUpperCase() + label.slice(1)}</span>
                    <span className="font-semibold tabular-nums text-ink">{formatNumber(n)}</span>
                  </li>
                ))}
              {note && <li className="pt-0.5 text-ink-muted">{note}</li>}
            </ul>

            {blocked ? (
              <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
                <TriangleAlert className="mt-px size-4 shrink-0" />
                {blockedReason}
              </p>
            ) : (
              <div>
                <Label htmlFor="confirm-name">{confirmLabel}</Label>
                <Input
                  id="confirm-name"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={confirmText}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" onClick={submit} disabled={pending || blocked || !matches}>
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
                Hapus permanen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
