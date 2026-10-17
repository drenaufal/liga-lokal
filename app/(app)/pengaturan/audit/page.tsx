import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getAuditLog, type AuditParams } from "@/lib/queries/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBox, FilterSelect, Pagination } from "@/components/app/list-controls";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Jejak Audit" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditParams>;
}) {
  const user = await requireCapability("audit:view");
  const params = await searchParams;
  const { rows, total, page, size, actions } = await getAuditLog(params, user.role);

  return (
    <div>
      <Link
        href="/pengaturan"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Pengaturan
      </Link>
      <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <ScrollText className="size-5" /> Jejak Audit Menyeluruh
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Setiap perubahan data, verifikasi, dan operasi pertandingan tercatat lengkap dengan pelaku dan waktu.
      </p>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <SearchBox placeholder="Cari aktivitas…" />
          <FilterSelect
            param="action"
            placeholder="Semua aksi"
            options={actions.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-2 py-2.5">Pelaku</th>
                <th className="px-2 py-2.5">Aksi</th>
                <th className="px-4 py-2.5">Ringkasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/40">
                  <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-ink-muted">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="text-xs text-ink">{r.actorName ?? "Sistem"}</span>
                    {r.actorRole && (
                      <span className="block text-[10px] text-ink-muted">{r.actorRole}</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-secondary">
                      {r.action}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-secondary">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3">
          <Pagination page={page} pageSize={size} total={total} />
        </div>
      </Card>
      <p className="mt-2 text-[11px] text-ink-muted">
        <Badge>Immutable</Badge> Entri audit tidak dapat diubah atau dihapus melalui antarmuka.
      </p>
    </div>
  );
}
