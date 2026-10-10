"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { deleteCategory } from "./actions";

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
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  const confirm = () =>
    start(async () => {
      const res = await deleteCategory(id);
      if (res.error) {
        toast.error("Tidak dapat menghapus", res.error);
      } else {
        toast.success(`Kategori ${code} dihapus`);
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label={`Hapus ${code}`}
          title={`Hapus ${code}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent title={`Hapus kategori ${code}?`} description="Tindakan ini tercatat pada jejak audit.">
        {inUse ? (
          <p className="text-sm text-ink-secondary">
            {code} masih dipakai oleh <strong className="text-ink">{inUse}</strong>. Pindahkan pemain /
            KU ke kategori lain terlebih dahulu.
          </p>
        ) : (
          <p className="text-sm text-ink-secondary">
            Kategori ini tidak dipakai pemain maupun turnamen dan dapat dihapus dengan aman.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose>
            <Button variant="ghost" size="sm">
              Batal
            </Button>
          </DialogClose>
          <Button variant="danger" size="sm" disabled={pending || !!inUse} onClick={confirm}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Hapus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
