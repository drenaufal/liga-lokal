import Link from "next/link";
import { Check, ExternalLink, FileText, Lock, Upload } from "lucide-react";
import { formatBytes } from "@/lib/media";

/**
 * One line of a document checklist (player papers, coach license / KTP).
 * Files open only for people who verify registrations.
 */
export function DocumentRow({
  label,
  url,
  meta,
  canView,
  editHref,
}: {
  label: string;
  url: string | null;
  meta: { fileName: string | null; mimeType: string; size: number } | null;
  canView: boolean;
  editHref: string | null;
}) {
  if (!url) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-2.5 py-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted/60">
          <Upload className="size-3" />
        </span>
        <span className="min-w-0 flex-1 text-xs text-ink-muted">
          <span className="font-medium text-ink-secondary">{label}</span> · belum diunggah
        </span>
        {editHref && (
          <Link href={editHref} className="shrink-0 text-[11px] text-brand hover:underline">
            Unggah
          </Link>
        )}
      </li>
    );
  }

  const detail = meta
    ? `${meta.fileName ?? (meta.mimeType === "application/pdf" ? "PDF" : "Gambar")} · ${formatBytes(meta.size)}`
    : "Terunggah";

  if (!canView) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg bg-surface-2/50 px-2.5 py-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-xs">
          <span className="font-medium text-ink">{label}</span>
          <span className="flex items-center gap-1 text-[11px] text-ink-muted">
            <Lock className="size-3" /> Hanya admin & operator yang dapat membuka
          </span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-2.5 rounded-lg bg-surface-2/50 px-2.5 py-2 transition-colors hover:bg-surface-2"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-xs">
          <span className="block font-medium text-ink">{label}</span>
          <span className="block truncate text-[11px] text-ink-muted">{detail}</span>
        </span>
        <FileText className="size-3.5 shrink-0 text-ink-muted group-hover:hidden" />
        <ExternalLink className="hidden size-3.5 shrink-0 text-ink group-hover:block" />
      </a>
    </li>
  );
}
