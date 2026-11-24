"use client";

import * as React from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { PrintRecord } from "@/lib/print/layout";
import { buildPdf, downloadPdf } from "@/lib/print/render";
import type { TemplateData } from "./template-panel";

/**
 * The people of the current selection with a tick each ("Pilih semua" on top), and the export:
 * one PDF page per ticked person, built in the browser from the Turnamen's template.
 */
export function ExportList({
  title,
  description,
  records,
  template,
  fileName,
  emptyText,
  groups = false,
}: {
  title: string;
  description?: string;
  records: PrintRecord[];
  template: TemplateData | null;
  fileName: string;
  emptyText: string;
  /** Name tags list players and coaches under their own headings. */
  groups?: boolean;
}) {
  const t = useT();
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(() => new Set(records.map((r) => r.id)));
  const [query, setQuery] = React.useState("");
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const all = picked.size === records.length && records.length > 0;
  const some = picked.size > 0 && !all;

  // (the page keys this component by club / KU, so a new list starts with everyone ticked)
  const q = query.trim().toLowerCase();
  const shown = q ? records.filter((r) => `${r.label} ${r.detail} ${r.values.number ?? ""}`.toLowerCase().includes(q)) : records;
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportPdf = async () => {
    if (!template) return;
    const chosen = records.filter((r) => picked.has(r.id));
    setProgress({ done: 0, total: chosen.length });
    try {
      const { bytes, missingPhotos } = await buildPdf({
        template,
        layout: template.layout,
        records: chosen,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      downloadPdf(bytes, fileName);
      toast.success(t("PDF siap: {n} halaman", { n: chosen.length }), fileName);
      if (missingPhotos.length)
        toast.warn(t("{n} foto tidak bisa dimuat", { n: missingPhotos.length }), missingPhotos.slice(0, 5).join(", ") + (missingPhotos.length > 5 ? "…" : ""));
    } catch (e) {
      toast.error(t("Gagal membuat PDF"), e instanceof Error ? e.message : undefined);
    } finally {
      setProgress(null);
    }
  };

  const sections = groups
    ? ([
        ["player", t("Pemain")],
        ["coach", t("Pelatih")],
      ] as const)
        .map(([kind, label]) => ({ label, rows: shown.filter((r) => r.kind === kind) }))
        .filter((s) => s.rows.length)
    : [{ label: null, rows: shown }];

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        <Button onClick={exportPdf} disabled={!template || picked.size === 0 || !!progress}>
          {progress ? <Loader2 className="animate-spin" /> : <Download />}
          {progress
            ? t("Menyusun {done}/{total}…", progress)
            : t("Unduh PDF ({n})", { n: picked.size })}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!template && records.length > 0 && (
          <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">{t("Unggah template terlebih dahulu untuk membuat PDF.")}</p>
        )}
        {records.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-3 py-10 text-center text-xs text-ink-muted">{emptyText}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={() => setPicked(all ? new Set() : new Set(records.map((r) => r.id)))}
                />
                {t("Pilih semua")}
                <span className="font-normal text-ink-muted">{t("{n} dari {total} dipilih", { n: picked.size, total: records.length })}</span>
              </label>
              {records.length > 8 && (
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Cari nama atau nomor…")}
                    aria-label={t("Cari nama atau nomor…")}
                    className="h-9 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-xs text-ink outline-none placeholder:text-ink-muted focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                  />
                </div>
              )}
            </div>
            {sections.map((s) => (
              <section key={s.label ?? "all"}>
                {s.label && (
                  <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    {s.label} · {s.rows.length}
                  </p>
                )}
                <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {s.rows.map((r) => {
                    const on = picked.has(r.id);
                    return (
                      <li key={r.id}>
                        <label
                          className={cn(
                            "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                            on ? "border-brand/40 bg-brand-soft/60" : "border-line bg-surface hover:bg-surface-2",
                          )}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggle(r.id)} />
                          <Avatar src={r.photoUrl} name={r.label} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{r.label}</span>
                            <span className="block truncate text-[11px] text-ink-muted">{r.detail || "—"}</span>
                          </span>
                          {r.values.number && <Badge tone="neutral">#{r.values.number}</Badge>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {!shown.length && <p className="py-6 text-center text-xs text-ink-muted">{t("Tidak ada yang cocok dengan “{query}”.", { query })}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
