import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2, Plus, Upload } from "lucide-react";
import { listPlayers, type PlayerListParams } from "@/lib/queries/registry";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { FootPreference } from "@/components/app/foot-icon";
import { EmptyState } from "@/components/ui/misc";
import {
  SearchBox,
  FilterSelect,
  SortHeader,
  Pagination,
} from "@/components/app/list-controls";
import { POSITION_LINES, POSITION_NAME } from "@/lib/positions";
import { PLAYER_DOCUMENTS } from "@/lib/player-documents";
import { ageFromDob } from "@/lib/utils";

export const metadata: Metadata = { title: "Registrasi Pemain" };
export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<PlayerListParams>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageSize, filters } = await listPlayers(params);
  const user = await getCurrentUser();
  const canWrite = can(user?.role, "registry:write");

  return (
    <div>
      <PageHeader
        title="Registrasi & Profil Pemain"
        description="Basis data pemain terpusat dengan status verifikasi, statistik karier, dan lencana pencapaian."
        actions={
          canWrite && (
            <>
              <Button variant="outline" size="sm" href="/ingestion">
                <Upload className="size-3.5" /> Impor CSV
              </Button>
              <Button size="sm" href="/registry/pemain/baru">
                <Plus className="size-3.5" /> Pemain Baru
              </Button>
            </>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <SearchBox placeholder="Cari nama, NISN, atau no. registrasi…" />
          <FilterSelect
            param="club"
            placeholder="Semua klub"
            options={filters.clubs.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            param="age"
            placeholder="Semua KU"
            options={filters.ageCategories.map((a) => ({
              value: a.id,
              label: a.code,
            }))}
          />
          <FilterSelect
            param="position"
            placeholder="Semua posisi"
            groups={POSITION_LINES.filter((l) => l.roles.length > 1).map((l) => ({
              label: l.label,
              options: [
                { value: l.line, label: `Semua ${l.label.toLowerCase()}` },
                ...l.roles.map((r) => ({ value: r, label: `${r} — ${POSITION_NAME[r]}` })),
              ],
            }))}
            options={[{ value: "GK", label: "GK — Kiper" }]}
          />
          <FilterSelect
            param="verification"
            placeholder="Semua status"
            options={[
              { value: "verified", label: "Terverifikasi" },
              { value: "pending", label: "Menunggu" },
              { value: "flagged", label: "Ditandai" },
              { value: "rejected", label: "Ditolak" },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            className="m-4"
            title="Tidak ada pemain yang cocok"
            description="Sesuaikan filter atau kata kunci pencarian."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-10"></TH>
                  <TH>
                    <SortHeader field="name">Nama</SortHeader>
                  </TH>
                  <TH>
                    <SortHeader field="club">Klub</SortHeader>
                  </TH>
                  <TH>Posisi</TH>
                  <TH>Kaki</TH>
                  <TH>
                    <SortHeader field="age">KU</SortHeader>
                  </TH>
                  <TH className="text-right">Usia</TH>
                  <TH>Registrasi</TH>
                  <TH>Verifikasi</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Avatar src={p.photoUrl} name={p.fullName} size={30} />
                    </TD>
                    <TD>
                      <Link
                        href={`/registry/pemain/${p.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {p.fullName}
                      </Link>
                      {p.nickname && (
                        <span className="ml-1.5 text-xs text-ink-muted">
                          &ldquo;{p.nickname}&rdquo;
                        </span>
                      )}
                    </TD>
                    <TD>
                      {p.clubShort ? (
                        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: p.clubColor ?? "var(--color-brand)" }}
                          />
                          {p.clubName}
                          {p.secondClubShort && (
                            <span
                              title={`Klub kedua: ${p.secondClubName}`}
                              className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary"
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ background: p.secondClubColor ?? "var(--color-info)" }}
                              />
                              +{p.secondClubShort}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-muted">Tanpa klub</span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge kind="position" value={p.position} />
                    </TD>
                    <TD>
                      <FootPreference foot={p.foot} size={16} />
                    </TD>
                    <TD className="text-xs">{p.ageCode ?? "—"}</TD>
                    <TD className="text-right tabular-nums">
                      {p.dob ? ageFromDob(p.dob) : "—"}
                    </TD>
                    <TD className="font-mono text-xs text-ink-muted">
                      {p.registrationNo}
                      <span className="block text-[10px] text-ink-muted/80">
                        NISN {p.nisn}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex items-center gap-2">
                        <StatusBadge
                          kind="verification"
                          value={p.verificationStatus}
                          dot
                        />
                        <span
                          title={`Dokumen lengkap ${Number(p.docs)} dari ${PLAYER_DOCUMENTS.length}`}
                          aria-label={`Dokumen lengkap ${Number(p.docs)} dari ${PLAYER_DOCUMENTS.length}`}
                          className={
                            Number(p.docs) === PLAYER_DOCUMENTS.length
                              ? "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums text-success"
                              : Number(p.docs) > 0
                                ? "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums text-warn"
                                : "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums text-ink-muted/60"
                          }
                        >
                          <FileCheck2 className="size-3.5" />
                          {Number(p.docs)}/{PLAYER_DOCUMENTS.length}
                        </span>
                      </span>
                    </TD>
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
