"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { deleteMatch } from "./ku/[id]/actions";
import { useT } from "@/lib/i18n/client";

/** Small trash button next to a match that has not started — for a typo or a cancelled fixture. */
export function DeleteMatchButton({ matchId, label }: { matchId: string; label: string }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  const remove = () =>
    start(async () => {
      try {
        await deleteMatch(matchId);
        toast.success(t("Pertandingan dihapus"), label);
      } catch (e) {
        toast.error(t("Gagal menghapus"), e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        title={t("Hapus {label}", { label })}
        aria-label={t("Hapus pertandingan {label}", { label })}
        className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("Hapus pertandingan?")}
        description={t("{label} akan dihapus dari jadwal.", { label })}
        confirmLabel={t("Hapus")}
        onConfirm={remove}
      />
    </>
  );
}
