"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { rethrowControlFlow } from "@/lib/action-helpers";
import { useT } from "@/lib/i18n/client";
import { deleteArticle, setArticleStatus } from "./actions";

/** Edit / publish / delete for one article. Each button is shown only to people who hold that capability. */
export function ArticleControls({
  id,
  title,
  published,
  canEdit,
  canDelete,
}: {
  id: string;
  title: string;
  published: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  const toggle = () =>
    start(async () => {
      try {
        await setArticleStatus(id, published ? "draft" : "published");
        toast.success(published ? t("Artikel ditarik ke draf") : t("Artikel diterbitkan"), title);
        router.refresh();
      } catch (e) {
        rethrowControlFlow(e);
        toast.error(t("Gagal mengubah status"), e instanceof Error ? e.message : undefined);
      }
    });

  const remove = () =>
    start(async () => {
      try {
        await deleteArticle(id);
        toast.success(t("Artikel dihapus"), title);
        router.push("/artikel");
      } catch (e) {
        rethrowControlFlow(e);
        toast.error(t("Gagal menghapus"), e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <>
          <Button size="sm" variant="outline" href={`/artikel/${id}/ubah`}>
            <Pencil className="size-3.5" /> {t("Ubah")}
          </Button>
          <Button size="sm" variant={published ? "outline" : "primary"} disabled={pending} onClick={toggle}>
            {pending ? <Loader2 className="animate-spin" /> : published ? <EyeOff className="size-3.5" /> : <Send className="size-3.5" />}
            {published ? t("Tarik ke draf") : t("Terbitkan")}
          </Button>
        </>
      )}
      {canDelete && (
        <>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(true)} className="text-danger hover:bg-danger/10">
            <Trash2 className="size-3.5" /> {t("Hapus")}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t("Hapus artikel?")}
            description={t("“{title}” akan dihapus permanen.", { title })}
            confirmLabel={t("Hapus")}
            onConfirm={remove}
          />
        </>
      )}
    </div>
  );
}
