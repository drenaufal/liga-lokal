import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listRefereeAskots, listReferees } from "@/lib/queries/registry";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { SearchBox, FilterSelect } from "@/components/app/list-controls";
import { EmptyState } from "@/components/ui/misc";
import { REFEREE_LICENSE_LEVELS, refereeSpecialtyLabel } from "@/lib/status";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Registrasi Wasit") };
}
export const dynamic = "force-dynamic";

export default async function RefereesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; level?: string; askot?: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("registry.referee:view");
  const params = await searchParams;
  const [rows, askots] = await Promise.all([
    listReferees(params),
    listRefereeAskots(),
  ]);
  const canWrite = can(user, "registry.referee:create");

  const summary = {
    active: rows.filter((r) => r.status === "active").length,
    expiring: rows.filter((r) => r.status === "expiring").length,
    expired: rows.filter((r) => r.status === "expired").length,
    revoked: rows.filter((r) => r.status === "revoked").length,
  };

  return (
    <div>
      <PageHeader
        title={t("Registrasi Wasit")}
        description={t("Manajemen wasit, asal Askot, lisensi, dan pemantauan status keaktifan.")}
        actions={
          canWrite && (
            <Button size="sm" href="/registry/wasit/baru">
              <Plus className="size-3.5" /> {t("Wasit Baru")}
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("Aktif"), summary.active],
          [t("Akan Kedaluwarsa"), summary.expiring],
          [t("Kedaluwarsa"), summary.expired],
          [t("Dicabut"), summary.revoked],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-xl border border-line bg-surface/70 p-3">
            <div className="text-xl font-semibold tabular-nums text-ink">{n as number}</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">{label as string}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <SearchBox placeholder={t("Cari nama, no. lisensi, atau Askot…")} />
          <FilterSelect
            param="askot"
            placeholder={t("Semua Askot")}
            options={askots.map((a) => ({ value: a, label: a }))}
          />
          <FilterSelect
            param="status"
            placeholder={t("Semua status")}
            options={[
              { value: "active", label: t("Aktif") },
              { value: "expiring", label: t("Akan Kedaluwarsa") },
              { value: "expired", label: t("Kedaluwarsa") },
              { value: "revoked", label: t("Dicabut") },
            ]}
          />
          <FilterSelect
            param="level"
            placeholder={t("Semua lisensi")}
            options={REFEREE_LICENSE_LEVELS.map((v) => ({ value: v, label: t.dyn(v) }))}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            className="m-4"
            title={t("Tidak ada wasit yang cocok")}
            description={canWrite ? t("Tambahkan wasit baru atau sesuaikan filter.") : t("Sesuaikan filter pencarian.")}
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"></TH>
                <TH>{t("Nama")}</TH>
                <TH>{t("Asal Askot")}</TH>
                <TH>{t("Lisensi")}</TH>
                <TH>{t("No. Lisensi")}</TH>
                <TH>{t("Berlaku s.d.")}</TH>
                <TH className="text-right">{t("Memimpin")}</TH>
                <TH>{t("Status")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Avatar src={r.photoUrl} name={r.fullName} size={30} />
                  </TD>
                  <TD>
                    <Link href={`/registry/wasit/${r.id}`} className="font-medium text-ink hover:text-brand">
                      {r.fullName}
                    </Link>
                    {r.specialty && <span className="ml-1.5 text-[11px] text-ink-muted">{refereeSpecialtyLabel(t, r.specialty)}</span>}
                  </TD>
                  <TD className="text-xs">{r.askot ?? <span className="text-ink-muted">—</span>}</TD>
                  <TD>
                    <Badge tone="violet">{t.dyn(r.licenseLevel)}</Badge>
                  </TD>
                  <TD className="font-mono text-xs text-ink-muted">{r.licenseNumber}</TD>
                  <TD className="text-xs">{r.licenseExpiry ? fmt.date(r.licenseExpiry) : "—"}</TD>
                  <TD className="text-right tabular-nums">{r.matchesOfficiated}</TD>
                  <TD>
                    <StatusBadge kind="referee" value={r.status} dot />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
