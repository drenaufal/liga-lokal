"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { deleteCategory } from "./actions";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/client";

export function DeleteCategoryButton({
  id,
  code,
  inUse,
}: {
  id: string;
  code: string;
  /** Human summary of what still references the category, if anything. */
  inUse: string | null;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  const confirm = () =>
    start(async () => {
      const res = await deleteCategory(id);
      if (res.error) {
        toast.error(t("Tidak dapat menghapus"), res.error);
      } else {
        toast.success(t("Kategori {code} dihapus", { code }));
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label={t("Hapus {code}", { code })}
          title={t("Hapus {code}", { code })}
        >
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent title={t("Hapus kategori {code}?", { code })} description={t("Tindakan ini tercatat pada jejak audit.")}>
        {inUse ? (
          <p className="text-sm text-ink-secondary">
            {rich(t("{code} masih dipakai oleh <b>{inUse}</b>. Pindahkan pemain / KU ke kategori lain terlebih dahulu.", { code, inUse }), {
              b: (c) => <strong className="text-ink">{c}</strong>,
            })}
          </p>
        ) : (
          <p className="text-sm text-ink-secondary">
            {t("Kategori ini tidak dipakai pemain maupun turnamen dan dapat dihapus dengan aman.")}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose>
            <Button variant="ghost" size="sm">
              {t("Batal")}
            </Button>
          </DialogClose>
          <Button variant="danger" size="sm" disabled={pending || !!inUse} onClick={confirm}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            {t("Hapus")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
