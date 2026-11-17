"use client";

import * as React from "react";
import { Check, X, GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import type { ImportRow, ImportIssue } from "@/lib/db/schema";
import { resolveRow } from "../actions";
import { candidateLabel } from "@/lib/ingestion";
import { useT } from "@/lib/i18n/client";

export function ReviewRow({
  row,
  batchId,
  canWrite,
}: {
  row: ImportRow;
  batchId: string;
  canWrite: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const raw = row.raw as Record<string, string>;
  const issues = (row.issues ?? []) as ImportIssue[];

  const act = (resolution: string) => {
    const fd = new FormData();
    fd.set("rowId", row.id);
    fd.set("batchId", batchId);
    fd.set("resolution", resolution);
    start(async () => {
      try {
        await resolveRow(fd);
        toast.success(t("Keputusan tersimpan"));
      } catch (e) {
        toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="rounded-lg border border-line-soft bg-surface-2/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink">
            {t("Baris {n} · {name}", { n: row.rowNumber, name: raw.full_name ?? raw.name })}
          </p>
          <p className="text-[10px] text-ink-muted">
            {[raw.dob, raw.position, raw.club_short].filter(Boolean).join(" · ")}
          </p>
        </div>
        {row.matchScore != null && (
          <span className="shrink-0 rounded-full border border-violet/25 bg-violet/10 px-2 py-0.5 text-[10px] text-violet">
            {t("{pct}% mirip", { pct: Math.round(row.matchScore * 100) })}
          </span>
        )}
      </div>

      {row.matchCandidateName && (
        <p className="mt-1.5 text-[11px] text-ink-secondary">
          {t("Kemungkinan sama dengan:")}{" "}
          <span className="font-medium text-ink">{candidateLabel(t, row.matchCandidateName)}</span>
        </p>
      )}
      {issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-warn">
          {issues.map((iss, i) => (
            <li key={i}>
              {iss.field}: {t.dyn(iss.message, iss.params)}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="mt-2.5 flex gap-1.5">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => act("approve")}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {t("Buat baru")}
          </Button>
          {row.matchCandidateId && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => act("merge")}>
              <GitMerge className="size-3.5" /> {t("Gabung (skip)")}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("reject")}>
            <X className="size-3.5" /> {t("Tolak")}
          </Button>
        </div>
      )}
    </div>
  );
}
