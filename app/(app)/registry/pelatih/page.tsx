import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { getRegistryFilters, listCoaches } from "@/lib/queries/registry";
import { requireCapability, getClubScope } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ClubCrest } from "@/components/app/club-crest";
import { SearchBox, FilterSelect } from "@/components/app/list-controls";
import { EmptyState } from "@/components/ui/misc";
import { COACH_LICENSE_LEVELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { getI18n, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Registrasi Pelatih") };
}
export const dynamic = "force-dynamic";

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; club?: string; docs?: string }>;
}) {
  const { t } = await getI18n();
  const user = await requireCapability("registry.coach:view");
  const params = await searchParams;
  const scope = await getClubScope();
  const [rows, { clubs }] = await Promise.all([
    listCoaches(params, scope),
    getRegistryFilters(scope),
  ]);
  const canWrite = can(user, "registry.coach:create");

  const complete = rows.filter((r) => Number(r.hasLicenseDoc) && Number(r.hasKtp)).length;
  const summary: [string, number][] = [
    [t("Pelatih"), rows.length],
    [t("Dokumen lengkap"), complete],
    [t("Dokumen belum lengkap"), rows.length - complete],
    [t("Belum terikat SSB"), rows.filter((r) => !r.clubId).length],
  ];

  return (
    <div>
      <PageHeader
        title={t("Registrasi Pelatih")}
        description={t("Data pelatih, lisensi dan KTP (unggah), serta penugasan ke SSB.")}
        actions={
          canWrite && (
            <Button size="sm" href="/registry/pelatih/baru">
              <Plus className="size-3.5" /> {t("Pelatih Baru")}
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line bg-surface/70 p-3">
            <div className="text-xl font-semibold tabular-nums text-ink">{n}</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">{label}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <SearchBox placeholder={t("Cari nama atau no. lisensi…")} />
          <FilterSelect
            param="club"
            placeholder={t("Semua SSB")}
            options={clubs.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            param="level"
            placeholder={t("Semua lisensi")}
            options={COACH_LICENSE_LEVELS.map((v) => ({ value: v, label: t.dyn(v) }))}
          />
          <FilterSelect
            param="docs"
            placeholder={t("Semua dokumen")}
            options={[
              { value: "lengkap", label: t("Dokumen lengkap") },
              { value: "kurang", label: t("Belum lengkap") },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            className="m-4"
            title={t("Tidak ada pelatih yang cocok")}
            description={canWrite ? t("Tambahkan pelatih baru atau sesuaikan filter.") : t("Sesuaikan filter pencarian.")}
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"></TH>
                <TH>{t("Nama")}</TH>
                <TH>{t("SSB::tunggal")}</TH>
                <TH>{t("Lisensi")}</TH>
                <TH>{t("No. Lisensi")}</TH>
                <TH>{t("Dokumen")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Avatar src={r.photoUrl} name={r.fullName} size={30} />
                  </TD>
                  <TD>
                    <Link href={`/registry/pelatih/${r.id}`} className="font-medium text-ink hover:text-brand">
                      {r.fullName}
                    </Link>
                    {r.specialty && (
                      <span className="ml-1.5 text-[11px] text-ink-muted">{t.dyn(r.specialty)}</span>
                    )}
                  </TD>
                  <TD>
                    {r.clubId ? (
                      <div className="space-y-1">
                        <Link href={`/registry/klub/${r.clubId}`} className="flex items-center gap-1.5 hover:text-ink">
                          <ClubCrest logoUrl={r.clubLogo} short={r.clubShort} size={20} />
                          <span className="truncate">{r.clubName}</span>
                        </Link>
                        {r.secondClubId && (
                          <Link href={`/registry/klub/${r.secondClubId}`} className="flex items-center gap-1.5 hover:text-ink">
                            <ClubCrest logoUrl={r.secondClubLogo} short={r.secondClubShort} size={20} />
                            <span className="truncate">{r.secondClubName}</span>
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone="violet" className="whitespace-nowrap">{t.dyn(r.licenseLevel)}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-ink-muted">{r.licenseNumber}</TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <DocChip ok={!!Number(r.hasLicenseDoc)} label={t("Lisensi")} />
                      <DocChip ok={!!Number(r.hasKtp)} label="KTP" />
                    </div>
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

async function DocChip({ ok, label }: { ok: boolean; label: string }) {
  const t = await getT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        ok ? "bg-success/12 text-success" : "bg-surface-2 text-ink-muted",
      )}
      title={ok ? t("{label} sudah diunggah", { label }) : t("{label} belum diunggah", { label })}
    >
      {ok ? <Check className="size-3" /> : <Minus className="size-3" />}
      {label}
    </span>
  );
}
