import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Users2, Landmark, Plus } from "lucide-react";
import { listClubs } from "@/lib/queries/registry";
import { requireCapability, getClubScope } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClubCrest } from "@/components/app/club-crest";
import { SearchBox, FilterSelect } from "@/components/app/list-controls";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("SSB") };
}
export const dynamic = "force-dynamic";

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; city?: string }>;
}) {
  const { t } = await getI18n();
  const user = await requireCapability("registry.club:view");
  const params = await searchParams;
  const { rows, cities } = await listClubs(params, await getClubScope());
  const canWrite = can(user, "registry.club:create");

  return (
    <div>
      <PageHeader
        title={t("Registrasi SSB")}
        description={t("Profil SSB, logo, afiliasi Askot / Asprov, alamat, skuad, dan riwayat performa antar kompetisi.")}
        actions={
          canWrite && (
            <Button size="sm" href="/registry/klub/baru">
              <Plus className="size-3.5" /> {t("SSB Baru")}
            </Button>
          )
        }
      />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <SearchBox placeholder={t("Cari nama SSB, Askot, Asprov…")} />
          <FilterSelect
            param="type"
            placeholder={t("Semua jenis")}
            options={[
              { value: "club", label: t("Klub") },
              { value: "academy", label: t("Akademi / SSB") },
            ]}
          />
          <FilterSelect
            param="city"
            placeholder={t("Semua kota")}
            options={cities.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title={t("Tidak ada SSB yang cocok")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const affiliation = [c.askot, c.asprov].filter(Boolean).join(" · ");
            return (
              <Link
                key={c.id}
                href={`/registry/klub/${c.id}`}
                className="group rounded-xl border border-line bg-surface/70 p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-start gap-3">
                  <ClubCrest logoUrl={c.logoUrl} short={c.shortName} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink group-hover:text-brand">
                      {c.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {c.shortName} · Est. {c.foundedYear ?? "—"}
                    </p>
                  </div>
                  <Badge tone={c.type === "academy" ? "violet" : "info"}>
                    {c.type === "academy" ? t("Akademi") : t("Klub")}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" /> {c.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users2 className="size-3" /> {t("{n} pemain", { n: c.squadSize })}
                  </span>
                  {affiliation && (
                    <span className="flex items-center gap-1">
                      <Landmark className="size-3" /> {affiliation}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
