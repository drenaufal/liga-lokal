import * as React from "react";
import { AlertTriangle, Info, Paperclip, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

/** Receipt link, or a quiet "no receipt yet" marker. Plain component: works in server and client trees. */
export function ProofChip({
  url,
  viewLabel,
  missingLabel,
  compact,
}: {
  url: string | null;
  viewLabel: string;
  missingLabel: string;
  compact?: boolean;
}) {
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted" title={missingLabel}>
        <Paperclip className="size-3 opacity-60" />
        {!compact && missingLabel}
        {compact && <span className="sr-only">{missingLabel}</span>}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={viewLabel}
      className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success transition-colors hover:bg-success/15"
    >
      <Receipt className="size-3" />
      {compact ? <span className="sr-only">{viewLabel}</span> : viewLabel}
    </a>
  );
}

/** Small coloured pill naming the business unit a row belongs to (shown only when several units are visible). */
export function UnitTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-secondary ring-1 ring-line">
      {name}
    </span>
  );
}

/** Inline banner for "what is this view showing" and "something needs your attention". */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warn";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed",
        tone === "warn" ? "border-warn/30 bg-warn/10 text-ink-secondary" : "border-line bg-surface-2/60 text-ink-secondary",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warn" ? "text-warn" : "text-ink-muted")} />
      <div className="min-w-0">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** Heading for a block of a page (a chart, a table). */
export function BlockTitle({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** A header cell with a one-line explanation under the label — the main reading aid for newcomers. */
export function ColumnHead({
  label,
  hint,
  align = "left",
  className,
}: {
  label: string;
  hint?: string;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <span className={cn("block", align === "right" && "text-right", align === "center" && "text-center", className)}>
      <span className="block">{label}</span>
      {hint && <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-ink-muted">{hint}</span>}
    </span>
  );
}
