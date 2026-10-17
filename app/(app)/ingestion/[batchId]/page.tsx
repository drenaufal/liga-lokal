import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  CircleMinus,
} from "lucide-react";
import { getBatch } from "@/lib/queries/ingestion";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import type { ImportIssue, ImportStage } from "@/lib/db/schema";
import { PipelineActions } from "./pipeline-actions";
import { ReviewRow } from "./review-row";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Detail Impor" };
export const dynamic = "force-dynamic";

const STAGE_ICON = {
  passed: <CircleCheck className="size-4 text-success" />,
  failed: <CircleX className="size-4 text-danger" />,
  running: <LoaderCircle className="size-4 animate-spin text-info" />,
  pending: <CircleDashed className="size-4 text-ink-muted" />,
  skipped: <CircleMinus className="size-4 text-ink-muted" />,
};

const ROW_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Menunggu", tone: "text-ink-muted" },
  valid: { label: "Valid", tone: "text-success" },
  error: { label: "Galat", tone: "text-danger" },
  duplicate: { label: "Duplikat", tone: "text-warn" },
  needs_review: { label: "Perlu tinjauan", tone: "text-warn" },
  approved: { label: "Disetujui", tone: "text-success" },
  rejected: { label: "Ditolak", tone: "text-ink-muted" },
  imported: { label: "Diimpor", tone: "text-brand" },
};

export default async function BatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const user = await requireCapability("ingestion:view");
  const { batchId } = await params;
  const data = await getBatch(batchId);
  if (!data) notFound();
  const { batch, rows } = data;
  const canReview = can(user, "ingestion:review");
  const canCommit = can(user, "ingestion:commit");

  const stages = (batch.stages ?? []) as ImportStage[];
  const reviewRows = rows.filter((r) => r.status === "needs_review");
  const committable = rows.filter((r) => r.status === "valid" || r.status === "approved").length;
  const notRun = batch.status === "validating";

  return (
    <div>
      <Link
        href="/ingestion"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Semua impor
      </Link>

      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-ink">{batch.fileName}</h1>
            <StatusBadge kind="import" value={batch.status} dot />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {batch.entity} · {batch.totalRows} baris · diunggah {formatDateTime(batch.createdAt)}
          </p>
        </div>
        <div className="flex gap-4 text-center text-xs">
          <Metric label="Valid" value={batch.validRows} tone="text-success" />
          <Metric label="Tinjau" value={batch.reviewRows} tone="text-warn" />
          <Metric label="Duplikat" value={batch.duplicateRows} tone="text-warn" />
          <Metric label="Galat" value={batch.errorRows} tone="text-danger" />
          <Metric label="Masuk" value={batch.importedRows} tone="text-brand" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* 8-stage pipeline */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Pipeline Penjaminan Kualitas</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-0.5">
              {stages.map((s, i) => (
                <li key={s.key} className="flex items-start gap-2.5 rounded-lg px-1.5 py-2">
                  <span className="mt-0.5">{STAGE_ICON[s.status]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">{s.label}</p>
                    {(s.detail || s.count != null) && (
                      <p className="text-[10px] text-ink-muted">
                        {s.detail ?? `${s.count} baris`}
                      </p>
                    )}
                  </div>
                  {i < stages.length - 1 && (
                    <span className="absolute" aria-hidden />
                  )}
                </li>
              ))}
            </ol>
            {(canReview || canCommit) && (
              <div className="mt-3 border-t border-line-soft pt-3">
                <PipelineActions
                  batchId={batchId}
                  status={batch.status}
                  notRun={notRun}
                  reviewCount={reviewRows.length}
                  committable={committable}
                  canReview={canReview}
                  canCommit={canCommit}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Review queue */}
          {reviewRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Antrian Tinjauan Manual ({reviewRows.length})</CardTitle>
                <span className="text-[11px] text-ink-muted">
                  Kandidat duplikat & peringatan aturan bisnis
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                {reviewRows.map((r) => (
                  <ReviewRow key={r.id} row={r} batchId={batchId} canWrite={canReview} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Full row table */}
          <Card>
            <CardHeader>
              <CardTitle>Baris Data ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 border-b border-line bg-surface text-left text-[10px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-2 py-2">Data</th>
                      <th className="px-2 py-2">Catatan Validasi</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {rows.map((r) => {
                      const raw = r.raw as Record<string, string>;
                      const issues = (r.issues ?? []) as ImportIssue[];
                      const meta = ROW_STATUS[r.status];
                      return (
                        <tr key={r.id} className="align-top hover:bg-surface-2/30">
                          <td className="px-3 py-2 tabular-nums text-ink-muted">{r.rowNumber}</td>
                          <td className="px-2 py-2">
                            <span className="font-medium text-ink">
                              {raw.full_name ?? raw.name ?? "—"}
                            </span>
                            <span className="block text-[10px] text-ink-muted">
                              {[raw.dob, raw.position, raw.club_short, raw.short_name, raw.city]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {issues.length === 0 ? (
                              <span className="text-ink-muted">—</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {issues.map((iss, k) => (
                                  <li
                                    key={k}
                                    className={
                                      iss.severity === "error" ? "text-danger" : "text-warn"
                                    }
                                  >
                                    {iss.field}: {iss.message}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {r.matchCandidateName && r.status !== "imported" && (
                              <p className="mt-0.5 text-[10px] text-violet">
                                Cocok dengan &ldquo;{r.matchCandidateName}&rdquo;
                                {r.matchScore ? ` (${Math.round(r.matchScore * 100)}%)` : ""}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-medium ${meta?.tone}`}>{meta?.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[10px] text-ink-muted">{label}</div>
    </div>
  );
}

void Badge;
