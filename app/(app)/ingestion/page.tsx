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
import type { MessageId } from "@/lib/i18n/translate";
import { getI18n } from "@/lib/i18n/server";
import { msg } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Data Ingestion & Staging" };
}
export const dynamic = "force-dynamic";

const ENTITY_LABEL: Record<string, MessageId> = {
  players: msg("Pemain"),
  clubs: msg("Klub::entitas"),
  referees: msg("Wasit"),
  venues: msg("Venue"),
  matches: msg("Pertandingan"),
};

export default async function IngestionPage() {
  const { t, fmt } = await getI18n();
  await requireCapability("ingestion:view");
  const [batches, user] = await Promise.all([listBatches(), getCurrentUser()]);
  const canWrite = can(user, "ingestion:upload");

  return (
    <div>
      <PageHeader
        title="Data Ingestion & Staging"
        description={t("Impor data massal (CSV) dengan delapan tahap penjaminan kualitas — validasi skema, deteksi duplikasi, hingga jejak audit.")}
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          {canWrite ? (
            <UploadPanel />
          ) : (
            <Card>
              <CardContent className="text-xs text-ink-muted">
                {t("Anda memiliki akses baca-saja untuk modul ingestion.")}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="size-4" /> {t("Templat CSV")}
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
                      <span>{t("Templat {entity}", { entity: t(ENTITY_LABEL[e]) })}</span>
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
            <CardTitle>{t("Riwayat Impor")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {batches.length === 0 ? (
              <EmptyState
                className="m-4"
                icon={FileInput}
                title={t("Belum ada impor data")}
                description={t("Unggah berkas CSV untuk memulai pipeline penjaminan kualitas.")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2.5">{t("Berkas")}</th>
                      <th className="px-2 py-2.5">{t("Entitas")}</th>
                      <th className="px-2 py-2.5 text-right">{t("Baris")}</th>
                      <th className="px-2 py-2.5 text-right">{t("Valid")}</th>
                      <th className="px-2 py-2.5 text-right">{t("Tinjau")}</th>
                      <th className="px-2 py-2.5 text-right">{t("Masuk::impor")}</th>
                      <th className="px-2 py-2.5">{t("Status")}</th>
                      <th className="px-4 py-2.5">{t("Waktu")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-2/40">
                        <td className="px-4 py-2.5">
                          <Link href={`/ingestion/${b.id}`} className="font-medium text-ink hover:text-brand">
                            {b.fileName}
                          </Link>
                          <span className="block text-[10px] text-ink-muted">{t("oleh {user}", { user: b.uploadedBy ?? "—" })}</span>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-ink-secondary">{ENTITY_LABEL[b.entity] ? t(ENTITY_LABEL[b.entity]) : b.entity}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{b.totalRows}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-success">{b.validRows}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-warn">{b.reviewRows}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-brand">{b.importedRows}</td>
                        <td className="px-2 py-2.5">
                          <StatusBadge kind="import" value={b.status} />
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-ink-muted">
                          {fmt.relative(b.createdAt)}
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
