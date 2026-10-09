"use client";

import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { cn, formatDateTime } from "@/lib/utils";
import { STAGE_LABEL } from "@/lib/status";
import { importSchedule, previewSchedule } from "./actions";

type Preview = Awaited<ReturnType<typeof previewSchedule>>;

const MAX_BYTES = 1024 * 1024;

const STATUS = {
  ok: { icon: CircleCheck, tone: "text-success", label: "Siap" },
  warning: { icon: CircleAlert, tone: "text-warn", label: "Peringatan" },
  duplicate: { icon: Copy, tone: "text-ink-muted", label: "Dilewati" },
  error: { icon: CircleX, tone: "text-danger", label: "Galat" },
} as const;

/** A CSV the user can fill in: header, then two example rows built from this tournament's clubs. */
function downloadTemplate(shorts: string[]) {
  const pick = (i: number) => shorts[i % Math.max(1, shorts.length)] ?? "KLUB";
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const lines = [
    "home_short,away_short,date,time,round,stage,group,venue,referee_license,bracket_slot",
    `${pick(0)},${pick(1)},${day},15:30,1,league,,,,`,
    `${pick(2)},${pick(3)},${day},17:00,1,league,,,,`,
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "templat-jadwal.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * "Unggah Jadwal": pick a CSV, see every row checked against this tournament,
 * then import the valid ones. Lives inside the tournament only.
 */
export function ScheduleUpload({
  tournamentId,
  shorts,
  variant = "outline",
}: {
  tournamentId: string;
  /** Club codes of the participants, shown as a hint and used in the template. */
  shorts: string[];
  variant?: "outline" | "primary";
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [replace, setReplace] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setText("");
    setPreview(null);
    setReplace(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const check = (csv: string, replaceScheduled: boolean) =>
    start(async () => {
      try {
        setPreview(await previewSchedule(tournamentId, csv, replaceScheduled));
      } catch (e) {
        setPreview(null);
        toast.error("Gagal membaca berkas", e instanceof Error ? e.message : undefined);
      }
    });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Berkas terlalu besar", "Maksimal 1 MB.");
      return;
    }
    const content = await file.text();
    setFileName(file.name);
    setText(content);
    check(content, replace);
  };

  const toggleReplace = (v: boolean) => {
    setReplace(v);
    if (text) check(text, v);
  };

  const submit = () =>
    start(async () => {
      try {
        const r = await importSchedule(tournamentId, text, replace);
        toast.success(
          `${r.imported} pertandingan dijadwalkan`,
          [r.removed ? `${r.removed} jadwal lama diganti` : null, r.skipped ? `${r.skipped} baris dilewati` : null]
            .filter(Boolean)
            .join(" · ") || undefined,
        );
        setOpen(false);
        reset();
      } catch (e) {
        toast.error("Gagal mengimpor jadwal", e instanceof Error ? e.message : undefined);
      }
    });

  const sum = preview?.summary;

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Upload className="size-3.5" /> Unggah Jadwal
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent
          title="Unggah Jadwal Pertandingan"
          description="Tambahkan banyak pertandingan sekaligus dari berkas CSV. Waktu dibaca sebagai WIB."
          className="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-secondary">
              <div className="min-w-0 space-y-1">
                <p>
                  Kolom wajib: <code className="font-mono text-ink">home_short</code>,{" "}
                  <code className="font-mono text-ink">away_short</code>, <code className="font-mono text-ink">date</code>,{" "}
                  <code className="font-mono text-ink">time</code>. Opsional: round, stage, group, venue, referee_license.
                </p>
                <p className="text-ink-muted">
                  Dari Excel: <em>File → Simpan sebagai → CSV</em>. Kode klub peserta:{" "}
                  <span className="font-mono text-ink-secondary">{shorts.join(", ") || "—"}</span>
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadTemplate(shorts)}>
                <Download className="size-3.5" /> Unduh templat
              </Button>
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition-colors",
                drag ? "border-brand/60 bg-brand/5" : "border-line hover:border-ink/25",
              )}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
                {pending && !preview ? <Loader2 className="size-5 animate-spin" /> : <FileSpreadsheet className="size-5" />}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold text-ink">{fileName ?? "Pilih atau seret berkas CSV ke sini"}</span>
                <span className="block text-xs text-ink-muted">
                  {fileName ? "Klik untuk mengganti berkas" : "Maksimal 500 baris · 1 MB"}
                </span>
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
            </label>

            {preview?.error && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
                {preview.error}
              </p>
            )}
            {preview?.archived && (
              <p className="rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
                Turnamen ini sudah diarsipkan, jadwalnya tidak dapat diubah. Pulihkan statusnya terlebih dahulu.
              </p>
            )}

            {sum && !preview?.error && (
              <>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  <Chip tone="bg-success/12 text-success">{sum.importable} siap diimpor</Chip>
                  {sum.warnings > 0 && <Chip tone="bg-warn/15 text-warn">{sum.warnings} dengan peringatan</Chip>}
                  {sum.duplicates > 0 && <Chip tone="bg-surface-2 text-ink-secondary">{sum.duplicates} dilewati (sudah ada)</Chip>}
                  {sum.errors > 0 && <Chip tone="bg-danger/12 text-danger">{sum.errors} galat</Chip>}
                </div>

                <div className="max-h-72 overflow-auto rounded-2xl border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wider text-ink-muted">
                      <tr>
                        <th className="px-3 py-2">Baris</th>
                        <th className="px-3 py-2">Pertandingan</th>
                        <th className="px-3 py-2">Waktu (WIB)</th>
                        <th className="px-3 py-2">Rincian</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {preview.rows.map((r) => {
                        const S = STATUS[r.status];
                        return (
                          <tr key={r.line} className={cn(r.status === "error" && "bg-danger/5")}>
                            <td className="px-3 py-2 tabular-nums text-ink-muted">{r.line}</td>
                            <td className="px-3 py-2 font-medium text-ink">
                              {r.homeName ?? (r.home || "?")} <span className="text-ink-muted">vs</span>{" "}
                              {r.awayName ?? (r.away || "?")}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-secondary">
                              {r.scheduledAt ? formatDateTime(r.scheduledAt) : "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-muted">
                              {r.stage ? (STAGE_LABEL[r.stage] ?? r.stage) : ""}
                              {r.round ? ` · Pekan ${r.round}` : ""}
                              {r.group ? ` · Grup ${r.group}` : ""}
                              {r.venueName ? ` · ${r.venueName}` : ""}
                              {r.refereeName ? ` · ${r.refereeName}` : ""}
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn("flex items-start gap-1.5", S.tone)}>
                                <S.icon className="mt-px size-3.5 shrink-0" />
                                <span className="min-w-0">
                                  <span className="font-semibold">{S.label}</span>
                                  {r.issues.map((m, i) => (
                                    <span key={i} className="block font-normal text-ink-secondary">
                                      {m}
                                    </span>
                                  ))}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {preview.scheduledCount > 0 && (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-xs text-ink-secondary">
                    <input
                      type="checkbox"
                      checked={replace}
                      onChange={(e) => toggleReplace(e.target.checked)}
                      className="mt-0.5 size-4 accent-[var(--color-brand)]"
                    />
                    <span>
                      <span className="font-semibold text-ink">Ganti jadwal yang belum dimulai</span>
                      <span className="block text-ink-muted">
                        Hapus {preview.scheduledCount} pertandingan berstatus “Terjadwal” (beserta penugasan wasit/operator)
                        lalu isi dengan berkas ini. Pertandingan yang sudah berjalan atau selesai tidak disentuh.
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Batal
              </Button>
              <Button
                onClick={submit}
                disabled={pending || !sum || sum.importable === 0 || !!preview?.error || !!preview?.archived}
              >
                {pending && preview ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
                {sum && sum.importable > 0 ? `Impor ${sum.importable} pertandingan` : "Impor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn("rounded-full px-3 py-1", tone)}>{children}</span>;
}
