"use client";

import * as React from "react";
import { ImagePlus, Link2, Loader2, Upload, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, formatBytes } from "@/lib/media";
import { shrinkImage, uploadMedia } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * Image field: uploads to `/api/media` (stored in the database, no external
 * service needed) and writes the resulting URL into a hidden input. Pasting an
 * external image URL is still possible as a fallback.
 */
export function ImageUpload({
  name,
  defaultValue,
  label,
  displayName,
  shape = "circle",
  fit = "cover",
  hint,
}: {
  name: string;
  defaultValue?: string | null;
  label?: string;
  displayName: string;
  shape?: "circle" | "square";
  /** `contain` keeps the whole image visible — use for logos. */
  fit?: "cover" | "contain";
  hint?: string;
}) {
  const t = useT();
  const [url, setUrl] = React.useState(defaultValue ?? "");
  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    if (!IMAGE_TYPES.includes(picked.type)) {
      setError(t("Format harus JPG, PNG, WEBP, atau GIF."));
      return;
    }
    setBusy(true);
    try {
      const file = await shrinkImage(picked, { maxSide: fit === "contain" ? 512 : 1024 });
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(t("Ukuran maksimal {size}.", { size: formatBytes(MAX_UPLOAD_BYTES) }));
      const res = await uploadMedia(file, "image", t("Gagal mengunggah berkas."));
      setUrl(res.url);
      setMode("upload");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Gagal mengunggah gambar."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-secondary">{label ?? t("Foto")}</span>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-dashed p-3 transition-colors",
          drag ? "border-brand/60 bg-brand/5" : "border-line",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="relative">
          {url && fit === "contain" ? (
            <div
              className={cn(
                "grid size-16 place-items-center overflow-hidden border border-line bg-surface-2 p-1.5",
                shape === "square" ? "rounded-lg" : "rounded-full",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={displayName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <Avatar src={url || null} name={displayName} size={64} square={shape === "square"} />
          )}
          {busy && (
            <div
              className={cn(
                "absolute inset-0 grid place-items-center bg-black/55",
                shape === "square" ? "rounded-lg" : "rounded-full",
              )}
            >
              <Loader2 className="size-5 animate-spin text-brand" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {mode === "upload" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {url ? <Upload className="size-3.5" /> : <ImagePlus className="size-3.5" />}
                {url ? t("Ganti gambar") : t("Unggah gambar")}
              </Button>
              <span className="text-[11px] text-ink-muted">{t("atau seret berkas ke sini")}</span>
            </div>
          ) : (
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("https://… (URL gambar)")}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
            <span>{hint ?? t("JPG, PNG, WEBP · maks {size} · diperkecil otomatis", { size: formatBytes(MAX_UPLOAD_BYTES) })}</span>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "upload" ? "url" : "upload"))}
              className="inline-flex items-center gap-1 hover:text-ink"
            >
              <Link2 className="size-3" />
              {mode === "upload" ? t("Pakai URL") : t("Unggah berkas")}
            </button>
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="inline-flex items-center gap-1 hover:text-danger"
              >
                <X className="size-3" /> {t("Hapus")}
              </button>
            )}
          </div>
          {error && <p className="text-[11px] text-danger">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
