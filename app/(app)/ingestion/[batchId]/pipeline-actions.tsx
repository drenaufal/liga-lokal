"use client";

import * as React from "react";
import { PlayCircle, CheckCheck, XCircle, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { runPipeline, bulkResolve, commitBatch } from "../actions";

export function PipelineActions({
  batchId,
  status,
  notRun,
  reviewCount,
  committable,
  canReview,
  canCommit,
}: {
  batchId: string;
  status: string;
  notRun: boolean;
  reviewCount: number;
  committable: number;
  canReview: boolean;
  canCommit: boolean;
}) {
  const [pending, start] = React.useTransition();

  const call = (fn: (fd: FormData) => Promise<void>, extra: Record<string, string>, msg: string) => {
    const fd = new FormData();
    fd.set("batchId", batchId);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    start(async () => {
      try {
        await fn(fd);
        toast.success(msg);
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="space-y-2">
      {canReview && notRun && (
        <Button
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => call(runPipeline, {}, "Pipeline QA dijalankan")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <PlayCircle className="size-3.5" />}
          Jalankan Validasi (Tahap 2–6)
        </Button>
      )}

      {canReview && reviewCount > 0 && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => call(bulkResolve, { resolution: "approve" }, "Semua baris tinjauan disetujui")}
          >
            <CheckCheck className="size-3.5" /> Setujui semua
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => call(bulkResolve, { resolution: "reject" }, "Semua baris tinjauan ditolak")}
          >
            <XCircle className="size-3.5" /> Tolak semua
          </Button>
        </div>
      )}

      {canCommit && (status === "staged" || (reviewCount === 0 && !notRun && status !== "completed")) && (
        <Button
          size="sm"
          className="w-full"
          disabled={pending || committable === 0}
          onClick={() => call(commitBatch, {}, "Impor diselesaikan")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Database className="size-3.5" />}
          Commit {committable} Baris ke Sistem
        </Button>
      )}

      {status === "completed" && (
        <p className="rounded-lg border border-success/25 bg-success/10 p-2.5 text-[11px] text-success">
          Impor selesai. Entitas baru masuk registry dengan status verifikasi &ldquo;Menunggu&rdquo;.
        </p>
      )}
    </div>
  );
}
