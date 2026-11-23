"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Move, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/lib/i18n/client";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/media";
import { uploadMedia } from "@/lib/upload-client";
import { PRINT_KIND_LABEL, type PrintKind, type PrintLayout, type PrintRecord } from "@/lib/print/layout";
import { prepareTemplateFile } from "@/lib/print/render";
import { PrintPreview } from "./print-preview";
import { TemplateEditor } from "./template-editor";
import { removeTemplate, saveTemplateImage } from "./actions";

export type TemplateData = { imageUrl: string; width: number; height: number; layout: PrintLayout };

/** The Turnamen's design for this kind: preview, upload / replace, position editor, remove. */
export function TemplatePanel({
  kind,
  competition,
  template,
  canManage,
  sample,
}: {
  kind: PrintKind;
  competition: { id: string; name: string };
  template: TemplateData | null;
  canManage: boolean;
  sample: PrintRecord;
}) {
  const t = useT();
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, start] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const kindLabel = t(PRINT_KIND_LABEL[kind]);

  const upload = (file: File) =>
    start(async () => {
      try {
        const ready = await prepareTemplateFile(file, MAX_UPLOAD_BYTES).catch(() => {
          throw new Error(t("Gambar tidak bisa dibaca atau lebih dari {size} setelah dikompres.", { size: formatBytes(MAX_UPLOAD_BYTES) }));
        });
        const media = await uploadMedia(ready.file, "image", t("Gagal mengunggah template."));
        await saveTemplateImage({ competitionId: competition.id, kind, imageUrl: media.url, width: ready.width, height: ready.height });
        toast.success(template ? t("Template diganti") : t("Template diunggah"), `${ready.width} × ${ready.height} px`);
        if (Math.max(ready.width, ready.height) < 1200)
          toast.warn(t("Resolusi template rendah"), t("Gunakan gambar minimal 1200 px di sisi terpanjang agar hasil cetak tajam."));
        router.refresh();
      } catch (e) {
        toast.error(t("Gagal mengunggah template."), e instanceof Error ? e.message : undefined);
      }
    });

  const remove = () =>
    start(async () => {
      try {
        await removeTemplate({ competitionId: competition.id, kind });
        toast.success(t("Template dihapus"));
        router.refresh();
      } catch (e) {
        toast.error(t("Gagal menghapus"), e instanceof Error ? e.message : undefined);
      }
    });

  const heightMm = template ? Math.round(template.layout.widthMm * (template.height / template.width)) : 0;
  const portrait = template ? template.height >= template.width : kind === "name_tag";

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{t("Template {kind}", { kind: kindLabel })}</CardTitle>
          <CardDescription className="mt-1">{competition.name}</CardDescription>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) upload(f);
              }}
            />
            <Button size="sm" variant={template ? "outline" : "primary"} onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <ImageUp className="size-3.5" />}
              {template ? t("Ganti template") : t("Unggah template")}
            </Button>
            {template && (
              <>
                <Button size="sm" onClick={() => setEditing(true)} disabled={busy}>
                  <Move className="size-3.5" /> {t("Atur posisi isian")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={busy} aria-label={t("Hapus template")} title={t("Hapus template")}>
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {template ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className={portrait ? "w-full max-w-[15rem]" : "w-full max-w-md"}>
              <PrintPreview imageUrl={template.imageUrl} width={template.width} height={template.height} layout={template.layout} record={sample} />
            </div>
            <dl className="grid gap-2 text-xs text-ink-secondary">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{t("Ukuran cetak")}</dt>
                <dd>{t("{w} × {h} mm per halaman", { w: template.layout.widthMm, h: heightMm })}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{t("Gambar")}</dt>
                <dd className="tabular-nums">{template.width} × {template.height} px</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{t("Pratinjau")}</dt>
                <dd>{t("Diisi dengan data {name}.", { name: sample.label })}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-xs text-ink-muted">
            <p className="font-semibold text-ink-secondary">{t("Belum ada template {kind} untuk turnamen ini.", { kind: kindLabel.toLowerCase() })}</p>
            <p className="mt-1">
              {canManage
                ? t("Unggah desainnya (JPG, PNG, atau WEBP) dengan bagian isian dikosongkan; data pemain ditulis di atasnya.")
                : t("Minta admin atau operator turnamen mengunggah template terlebih dahulu.")}
            </p>
          </div>
        )}
      </CardContent>

      {template && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent
            title={t("Atur posisi isian · {kind}", { kind: kindLabel })}
            description={t("Posisi disimpan untuk turnamen ini dan dipakai untuk semua PDF berikutnya.")}
            className="max-w-6xl"
          >
            {editing && (
              <TemplateEditor kind={kind} competitionId={competition.id} template={template} sample={sample} onDone={() => setEditing(false)} />
            )}
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("Hapus template {kind}?", { kind: kindLabel.toLowerCase() })}
        description={t("Gambar dan posisi isian untuk turnamen ini dihapus. PDF tidak bisa dibuat sampai template baru diunggah.")}
        confirmLabel={t("Hapus template")}
        onConfirm={remove}
      />
    </Card>
  );
}
