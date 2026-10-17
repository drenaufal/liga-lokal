import type { Metadata } from "next";
import Link from "next/link";
import { FileInput, FileDown } from "lucide-react";
import { listBatches } from "@/lib/queries/ingestion";
import { requireCapability } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/ui/misc";
import { UploadPanel } from "./upload-panel";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Data Ingestion & Staging" };
export const dynamic = "force-dynamic";

const ENTITY_LABEL: Record<string, string> = {
  players: "Pemain",
  clubs: "Klub",
  referees: "Wasit",
  venues: "Venue",
  matches: "Pertandingan",
};

export default async function IngestionPage() {
  await requireCapability("ingestion:view");
  const [batches, user] = await Promise.all([listBatches(), getCurrentUser()]);
  const canWrite = can(user, "ingestion:upload");

  return (
    <div>
      <PageHeader
        title="Data Ingestion & Staging"
        description="Impor data massal (CSV) dengan delapan tahap penjaminan kualitas — validasi skema, deteksi duplikasi, hingga jejak audit."
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          {canWrite ? (
            <UploadPanel />
          ) : (
            <Card>
              <CardContent className="text-xs text-ink-muted">
                Anda memiliki akses baca-saja untuk modul ingestion.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="size-4" /> Templat CSV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs">
                {["players", "clubs", "referees", "venues"].map((e) => (
                  <li key={e}>
                    <a
                      href={`/templates/${e}.csv`}
                      download
                      className="flex items-center justify-between rounded-lg border border-line-soft px-2.5 py-1.5 text-ink-secondary transition-colors hover:border-brand/30 hover:text-ink"
                    >
                      <span>Templat {ENTITY_LABEL[e]}</span>
                      <FileDown className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Impor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {batches.length === 0 ? (
              <EmptyState
                className="m-4"
                icon={FileInput}
                title="Belum ada impor data"
                description="Unggah berkas CSV untuk memulai pipeline penjaminan kualitas."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2.5">Berkas</th>
                      <th className="px-2 py-2.5">Entitas</th>
                      <th className="px-2 py-2.5 text-right">Baris</th>
                      <th className="px-2 py-2.5 text-right">Valid</th>
                      <th className="px-2 py-2.5 text-right">Tinjau</th>
                      <th className="px-2 py-2.5 text-right">Masuk</th>
                      <th className="px-2 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-2/40">
                        <td className="px-4 py-2.5">
                          <Link href={`/ingestion/${b.id}`} className="font-medium text-ink hover:text-brand">
                            {b.fileName}
                          </Link>
                          <span className="block text-[10px] text-ink-muted">oleh {b.uploadedBy ?? "—"}</span>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-ink-secondary">{ENTITY_LABEL[b.entity]}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{b.totalRows}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-success">{b.validRows}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-warn">{b.reviewRows}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-brand">{b.importedRows}</td>
                        <td className="px-2 py-2.5">
                          <StatusBadge kind="import" value={b.status} />
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-ink-muted">
                          {relativeTime(b.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
