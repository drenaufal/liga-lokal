import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Mail, Phone, User, Pencil, UserPlus, Landmark } from "lucide-react";
import { getClubProfile } from "@/lib/queries/registry";
import { requireCapability, getClubScope } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Button } from "@/components/ui/button";
import { ClubCrest } from "@/components/app/club-crest";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/ui/misc";
import { STAGE_LABEL } from "@/lib/status";
import { positionText } from "@/lib/positions";
import { inClubScope } from "@/lib/club-scope";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await getClubProfile(id);
  const { t } = await getI18n();
  return { title: d?.club.name ?? t("Klub") };
}

export default async function ClubProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("registry.club:view");
  const { id } = await params;
  const d = inClubScope(await getClubScope(), id) ? await getClubProfile(id) : null;
  if (!d) notFound();
  const { club, squad, comps, recentMatches, staff } = d;
  const canWrite = can(user, "registry.club:edit");
  const canAddCoach = can(user, "registry.coach:create");

  const byCategory = squad.reduce<Record<string, typeof squad>>((acc, p) => {
    const k = p.ageCode ?? "Lainnya";
    (acc[k] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <Link
        href="/registry/klub"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali ke daftar SSB")}
      </Link>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ClubCrest logoUrl={club.logoUrl} short={club.shortName} size={80} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink">{club.name}</h1>
              <Badge tone={club.type === "academy" ? "violet" : "info"}>
                {club.type === "academy" ? t("Akademi") : t("Klub")}
              </Badge>
              {canWrite && (
                <Button variant="outline" size="sm" href={`/registry/klub/${club.id}/edit`} className="ml-auto">
                  <Pencil className="size-3.5" /> {t("Ubah data & logo")}
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3" /> {[club.city, club.province].filter(Boolean).join(", ")}
              </span>
              <span>{t("Berdiri {year}", { year: club.foundedYear ?? "—" })}</span>
              {club.askot && (
                <span className="flex items-center gap-1.5">
                  <Landmark className="size-3" /> {club.askot}
                </span>
              )}
              {club.asprov && (
                <span className="flex items-center gap-1.5">
                  <Landmark className="size-3" /> {club.asprov}
                </span>
              )}
            </div>
            {club.address && (
              <p className="mt-2 max-w-xl whitespace-pre-line text-xs leading-relaxed text-ink-muted">
                {club.address}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-muted">
              {club.contactName && (
                <span className="flex items-center gap-1"><User className="size-3" /> {club.contactName}</span>
              )}
              {club.contactEmail && (
                <span className="flex items-center gap-1"><Mail className="size-3" /> {club.contactEmail}</span>
              )}
              {club.contactPhone && (
                <span className="flex items-center gap-1"><Phone className="size-3" /> {club.contactPhone}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-1 sm:gap-1.5">
            <div>
              <div className="text-lg font-semibold tabular-nums text-ink">{squad.length}</div>
              <div className="text-[10px] text-ink-muted">{t("Pemain")}</div>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums text-ink">{comps.length}</div>
              <div className="text-[10px] text-ink-muted">{t("Kompetisi")}</div>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums text-ink">
                {Object.keys(byCategory).length}
              </div>
              <div className="text-[10px] text-ink-muted">{t("Kelompok umur")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("Skuad")}</CardTitle>
              <span className="text-[11px] text-ink-muted">{t("{n} pemain terdaftar", { n: squad.length })}</span>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.entries(byCategory)
                .sort()
                .map(([cat, list]) => (
                  <div key={cat}>
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone="info">{t.dyn(cat)}</Badge>
                      <span className="text-[11px] text-ink-muted">{t("{n} pemain", { n: list.length })}</span>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {list.map((p) => (
                        <Link
                          key={p.id}
                          href={`/registry/pemain/${p.id}`}
                          className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-surface-2/40 p-2 transition-colors hover:border-brand/30"
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-[10px] font-semibold text-ink-muted">
                            {p.jerseyNumber ?? "–"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-ink">
                              {p.fullName}
                            </span>
                            <span className="text-[10px] text-ink-muted">
                              {positionText(p.position, t)} · {t("{apps} main · {goals} gol", { apps: p.apps, goals: p.goals })}
                            </span>
                          </span>
                          <StatusBadge kind="verification" value={p.verificationStatus} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("Staf Pelatih")}</CardTitle>
              {canAddCoach && (
                <Link
                  href={`/registry/pelatih/baru?club=${club.id}`}
                  className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-brand"
                >
                  <UserPlus className="size-3" /> {t("Tambah")}
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {staff.length ? (
                <ul className="space-y-1.5">
                  {staff.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/registry/pelatih/${c.id}`}
                        className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                      >
                        <Avatar src={c.photoUrl} name={c.fullName} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-ink">{c.fullName}</span>
                          <span className="text-[10px] text-ink-muted">
                            {t.dyn(c.specialty ?? t("Pelatih::peran"))} · {t.dyn(c.licenseLevel)}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[10px] tabular-nums ${Number(c.docs) === 2 ? "text-success" : "text-ink-muted"}`}
                          title={t("Dokumen lisensi & KTP yang sudah diunggah")}
                        >
                          {t("{n}/2 dok", { n: Number(c.docs) })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-xs text-ink-muted">{t("Belum ada pelatih terdaftar.")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Riwayat Kompetisi")}</CardTitle>
            </CardHeader>
            <CardContent>
              {comps.length ? (
                <ul className="space-y-2.5">
                  {comps.map((c) => (
                    <li key={c.tournamentId}>
                      <Link
                        href={`/kompetisi/ku/${c.tournamentId}`}
                        className="block rounded-lg border border-line-soft bg-surface-2/40 p-2.5 transition-colors hover:border-brand/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-ink">{c.name}</span>
                          <StatusBadge kind="tournament" value={c.status} />
                        </div>
                        {c.played != null && c.played > 0 && (
                          <p className="mt-1 text-[10px] text-ink-muted">
                            {t("Peringkat {rank} · {played} main · {won}M {drawn}S {lost}K · {points} poin", { rank: c.rank ?? "—", played: c.played, won: c.won ?? 0, drawn: c.drawn ?? 0, lost: c.lost ?? 0, points: c.points ?? 0 })}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t("Belum ikut kompetisi")} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Pertandingan Terakhir")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentMatches.length ? (
                <ul className="space-y-1.5">
                  {recentMatches.map((m) => {
                    const isHome = m.homeClubId === id;
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/match-ops/${m.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2"
                        >
                          <span className="min-w-0 truncate text-ink-secondary">
                            {m.homeShort} v {m.awayShort}
                          </span>
                          {m.status === "completed" ? (
                            <span className="shrink-0 font-mono font-semibold text-ink">
                              {m.homeScore}–{m.awayScore}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-ink-muted">
                              {fmt.date(m.scheduledAt)}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-4 text-center text-xs text-ink-muted">{t("Belum ada pertandingan.")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

void STAGE_LABEL;
