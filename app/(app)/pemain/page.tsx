import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { listPublicPlayers, type PublicPlayerListParams } from "@/lib/queries/public-players";
import { requireViewerCapability } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { FootPreference } from "@/components/app/foot-icon";
import { EmptyState } from "@/components/ui/misc";
import { SearchBox, FilterSelect, SortHeader, Pagination } from "@/components/app/list-controls";
import { POSITION_LINES, POSITION_NAME } from "@/lib/positions";
import { crestTint } from "@/lib/crest";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Profil Pemain") };
}
export const dynamic = "force-dynamic";

/**
 * Open to everyone: the master player list without personal data (see lib/queries/public-players.ts).
 * Management stays in Master Data & Registry, behind login.
 */
export default async function PublicPlayersPage({ searchParams }: { searchParams: Promise<PublicPlayerListParams> }) {
  const { t } = await getI18n();
  await requireViewerCapability("player-profile:view");
  const params = await searchParams;
  const { rows, total, page, pageSize, filters } = await listPublicPlayers(params);
  const listQuery = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ).toString();
  const returnTo = `/pemain${listQuery ? `?${listQuery}` : ""}`;

  return (
    <div>
      <PageHeader
        title={t("Profil Pemain")}
        description={t("Telusuri pemain beserta klub, posisi, dan statistik kariernya. Data pribadi pemain tidak ditampilkan.")}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <SearchBox placeholder={t("Cari nama atau no. registrasi…")} />
          <FilterSelect param="club" placeholder={t("Semua klub")} options={filters.clubs.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect param="age" placeholder={t("Semua KU")} options={filters.ageCategories.map((a) => ({ value: a.id, label: a.code }))} />
          <FilterSelect
            param="position"
            placeholder={t("Semua posisi")}
            groups={POSITION_LINES.filter((l) => l.roles.length > 1).map((l) => ({
              label: t.dyn(l.label),
              options: [
                { value: l.line, label: t("Semua {line}", { line: t.dyn(l.label).toLowerCase() }) },
                ...l.roles.map((r) => ({ value: r, label: `${r} — ${t.dyn(POSITION_NAME[r])}` })),
              ],
            }))}
            options={[{ value: "GK", label: t("GK — Kiper") }]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState className="m-4" title={t("Tidak ada pemain yang cocok")} description={t("Sesuaikan filter atau kata kunci pencarian.")} />
        ) : (
          <>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-10"></TH>
                  <TH><SortHeader field="name">{t("Nama")}</SortHeader></TH>
                  <TH><SortHeader field="club">{t("Klub")}</SortHeader></TH>
                  <TH>{t("Posisi")}</TH>
                  <TH>{t("Kaki")}</TH>
                  <TH><SortHeader field="age">{t("KU::bidang")}</SortHeader></TH>
                  <TH>{t("Registrasi")}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD><Avatar src={p.photoUrl} name={p.fullName} size={30} /></TD>
                    <TD>
                      <Link href={`/pemain/${p.id}?returnTo=${encodeURIComponent(returnTo)}`} className="font-medium text-ink hover:text-brand">
                        {p.fullName}
                      </Link>
                      {p.nickname && <span className="ml-1.5 text-xs text-ink-muted">&ldquo;{p.nickname}&rdquo;</span>}
                      {p.verified && (
                        <span title={t("Identitas terverifikasi")} className="ml-1.5 inline-flex align-middle text-success">
                          <BadgeCheck className="size-3.5" aria-label={t("Identitas terverifikasi")} />
                        </span>
                      )}
                    </TD>
                    <TD>
                      {p.clubShort ? (
                        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="size-2 rounded-full" style={{ background: crestTint(p.clubShort).bg }} />
                          {p.clubName}
                          {p.secondClubShort && (
                            <span
                              title={t("Klub kedua: {name}", { name: p.secondClubName ?? "" })}
                              className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary"
                            >
                              <span className="size-1.5 rounded-full" style={{ background: crestTint(p.secondClubShort).bg }} />+{p.secondClubShort}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-muted">{t("Tanpa klub")}</span>
                      )}
                    </TD>
                    <TD><StatusBadge kind="position" value={p.position} /></TD>
                    <TD><FootPreference foot={p.foot} size={16} /></TD>
                    <TD className="text-xs">{p.ageCode ?? "—"}</TD>
                    <TD className="font-mono text-xs text-ink-muted">{p.registrationNo}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="px-3">
              <Pagination page={page} pageSize={pageSize} total={total} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
