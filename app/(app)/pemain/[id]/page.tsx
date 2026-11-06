import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Footprints, Ruler, Shield } from "lucide-react";
import { getPublicPlayerProfile } from "@/lib/queries/public-players";
import { requireViewerCapability } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FootPreference } from "@/components/app/foot-icon";
import { crestTint } from "@/lib/crest";
import { StatusBadge } from "@/components/app/status-badge";
import { Icon } from "@/components/app/icon";
import { Radar } from "@/components/charts/radar";
import { RADAR_AXES, radarValues, per90Summary, percentileOf } from "@/lib/player-metrics";
import { emptyTotals } from "@/lib/player-stats";
import { LINE_LABEL, positionLine } from "@/lib/positions";
import { cn } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getI18n();
  const data = UUID.test(id) ? await getPublicPlayerProfile(id) : null;
  return { title: data?.player.fullName ?? t("Profil Pemain") };
}

/**
 * Open to everyone. Same layout as the master player profile, minus everything personal: NISN,
 * date and place of birth, guardian and contact, verification date and the private documents —
 * the data it renders (lib/queries/public-players.ts) does not contain them.
 */
export default async function PublicPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ klub?: string; returnTo?: string }>;
}) {
  const { t, fmt } = await getI18n();
  await requireViewerCapability("player-profile:view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { klub, returnTo } = await searchParams;
  const backHref = typeof returnTo === "string" && (returnTo === "/pemain" || returnTo.startsWith("/pemain?")) ? returnTo : "/pemain";
  const data = await getPublicPlayerProfile(id, klub);
  if (!data) notFound();
  const { player, clubChips, selectedClub, peers } = data;
  const totals = data.totals ?? emptyTotals();

  const chip = clubChips.find((c) => c.id === selectedClub) ?? null;
  const filtered = !!chip;
  const radar = radarValues(totals);
  const p90 = per90Summary(totals);
  // Percentile pools hold all-clubs career lines, so it only applies to "Semua klub".
  const scorePct = filtered ? null : percentileOf(totals.score, peers.map((x) => x.score));
  const clubs = [player.club, player.secondClub].filter((c): c is NonNullable<typeof c> => !!c);
  const query = (extra: string) => `/pemain/${id}?${extra}${extra ? "&" : ""}returnTo=${encodeURIComponent(backHref)}`;

  const statTiles = [
    { label: t("Penampilan"), value: totals.appearances },
    { label: t("Menit"), value: fmt.number(totals.minutesPlayed) },
    { label: t("Gol::jumlah"), value: totals.goals },
    { label: t("Assist::jumlah"), value: totals.assists },
    { label: t("Tembakan tepat"), value: totals.shotsOnTarget },
    { label: t("Tembakan meleset"), value: totals.shotsOffTarget },
    { label: t("Penyelamatan::jumlah"), value: totals.saves },
    { label: t("Intersep::jumlah"), value: totals.interceptions },
    { label: t("Tekel::jumlah"), value: totals.tackles },
    { label: t("Nirbobol::jumlah"), value: totals.cleanSheets },
    { label: t("Kartu kuning::jumlah"), value: totals.yellowCards },
    { label: t("Kartu merah::jumlah"), value: totals.redCards },
  ];

  return (
    <div>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> {t("Kembali ke daftar pemain")}
      </Link>

      {/* Header */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={player.photoUrl} name={player.fullName} size={96} square fit="contain" className="border border-line" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink">{player.fullName}</h1>
              {player.nickname && <span className="text-sm text-ink-muted">&ldquo;{player.nickname}&rdquo;</span>}
              {player.verified && (
                <Badge tone="success" dot>
                  {t("Identitas terverifikasi")}
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary">
              <span className="font-mono text-ink-muted">{player.registrationNo}</span>
              <StatusBadge kind="position" value={player.position} />
              {player.jerseyNumber && <span>{t("No. punggung {n}", { n: player.jerseyNumber })}</span>}
              {clubs.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: crestTint(c.shortName).bg }} />
                  {c.name}
                  {i === 1 && (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">{t("Klub kedua")}</span>
                  )}
                </span>
              ))}
              {player.ageCode && <Badge tone="info">{player.ageCode}</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
              <Detail icon={Shield} label={t("Klub")}>
                {clubs.length ? clubs.map((c) => c.shortName).join(" · ") : t("Tanpa klub")}
              </Detail>
              <Detail icon={Ruler} label={t("Tinggi / Berat")}>
                {player.heightCm ? `${player.heightCm} cm` : "—"} / {player.weightKg ? `${player.weightKg} kg` : "—"}
              </Detail>
              <Detail icon={Footprints} label={t("Kaki dominan")}>
                <FootPreference foot={player.foot} size={18} showLabel className="text-ink" />
              </Detail>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Club filter — only meaningful when the player has more than one club */}
      {clubChips.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t("Statistik per klub")}</span>
          <ClubChipLink href={query("")} active={!filtered}>
            {t("Semua klub")}
          </ClubChipLink>
          {clubChips.map((c) => (
            <ClubChipLink
              key={c.id}
              href={query(`klub=${c.id}`)}
              active={selectedClub === c.id}
              color={crestTint(c.short || c.name).bg}
              note={c.tag === "utama" ? t("utama") : c.tag === "kedua" ? t("kedua") : undefined}
            >
              {c.short || c.name}
            </ClubChipLink>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Radar */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Profil Radar Performa")}</CardTitle>
            {scorePct !== null && totals.appearances > 0 ? (
              <Badge tone="brand">{t("Persentil {pct} · {line}", { pct: scorePct, line: t.dyn(LINE_LABEL[positionLine(player.position)]) })}</Badge>
            ) : filtered ? (
              <Badge tone="neutral">{chip?.short}</Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {totals.appearances > 0 ? (
              <>
                <Radar
                  axes={RADAR_AXES.map((a) => ({ key: a.key, label: t.dyn(a.label) }))}
                  series={[{ label: player.fullName, color: "var(--color-chart-1)", values: radar }]}
                />
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line-soft pt-3 text-center">
                  {[
                    [t("Gol / 90"), p90.goals],
                    [t("Assist / 90"), p90.assists],
                    [t("Umpan kunci / 90"), p90.keyPasses],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="text-sm font-semibold tabular-nums text-ink">{v}</div>
                      <div className="text-[10px] text-ink-muted">{l}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-xs text-ink-muted">
                {filtered
                  ? t("Belum ada data pertandingan saat membela {club}.", { club: chip?.name ?? "" })
                  : t("Belum ada data pertandingan untuk membentuk profil radar.")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>{filtered ? t("Statistik · {club}", { club: chip?.short ?? "" }) : t("Statistik Karier")}</CardTitle>
            <span className="text-[11px] text-ink-muted">
              {filtered ? t("Hanya saat membela klub ini") : t("Akumulasi semua klub & kompetisi")}
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {statTiles.map((s) => (
                <div key={s.label} className="rounded-lg border border-line-soft bg-surface-2/40 px-3 py-2.5">
                  <div className="text-lg font-semibold tabular-nums leading-tight text-ink">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-xs">
              <span className="text-ink-muted">{t("Rating rata-rata")}</span>
              <span className="font-semibold tabular-nums text-ink">{totals.appearances > 0 ? totals.rating.toFixed(1) : "—"}</span>
              <span className="text-ink-muted">{t("Skor")}</span>
              <span className="font-semibold tabular-nums text-brand">{Math.round(totals.score)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-tournament + badges */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("Rincian per Kompetisi")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.tournaments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2.5">{t("Kompetisi::tunggal")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Main")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Gol::jumlah")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Assist::jumlah")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Rating")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Skor")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {data.tournaments.map((st) => (
                      <tr key={st.id} className="transition-colors hover:bg-surface-2/50">
                        <td className="px-4 py-2.5">
                          <span className="block font-medium text-ink">{st.tournamentName ?? t("Kompetisi {season}", { season: st.season })}</span>
                          {st.clubShort && (
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                              <span className="size-1.5 rounded-full" style={{ background: crestTint(st.clubShort).bg }} />
                              {t("Membela {club}", { club: st.clubName ?? "" })}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{st.appearances}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{st.goals}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{st.assists}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{st.rating.toFixed(1)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{Math.round(st.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-center text-xs text-ink-muted">
                {filtered ? t("Belum ada kompetisi saat membela {club}.", { club: chip?.name ?? "" }) : t("Pemain belum tampil di kompetisi resmi.")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Lencana & Penghargaan")}</CardTitle>
          </CardHeader>
          <CardContent>
            {player.badges.length ? (
              <ul className="space-y-2">
                {player.badges.map((pb) => (
                  <li key={pb.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-warn/25 bg-warn/10 text-warn">
                      <Icon name={pb.badge.icon} className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-ink">{t.dyn(pb.badge.name)}</p>
                      <p className="text-[10px] text-ink-muted">{pb.context ?? pb.badge.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-ink-muted">{t("Belum ada lencana.")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {player.seasonHistory.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t("Perkembangan Jangka Panjang")}</CardTitle>
            <span className="text-[11px] text-ink-muted">{t("Pemantauan longitudinal antar musim")}</span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {[...player.seasonHistory]
                .sort((a, b) => a.season.localeCompare(b.season))
                .map((h) => (
                  <div key={h.id} className="min-w-[140px] flex-1 rounded-lg border border-line-soft bg-surface-2/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink">{t("Musim {season}", { season: h.season })}</span>
                      {h.ageCategoryCode && <Badge tone="neutral">{h.ageCategoryCode}</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                      <Mini label={t("Main")} value={h.appearances} />
                      <Mini label={t("Gol::jumlah")} value={h.goals} />
                      <Mini label={t("Rating")} value={h.avgRating.toFixed(1)} />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClubChipLink({
  href,
  active,
  color,
  note,
  children,
}: {
  href: string;
  active: boolean;
  color?: string | null;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
        active ? "bg-night text-white" : "bg-surface-2 text-ink-secondary hover:bg-elevated hover:text-ink",
      )}
    >
      {color !== undefined && <span className="size-2 rounded-full" style={{ background: color ?? "var(--color-brand)" }} />}
      {children}
      {note && <span className={cn("text-[10px] font-medium", active ? "text-white/60" : "text-ink-muted")}>{note}</span>}
    </Link>
  );
}

function Detail({ icon: I, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-muted">
        <I className="size-3" /> {label}
      </span>
      <span className="mt-0.5 block text-ink-secondary">{children}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-[9px] text-ink-muted">{label}</div>
    </div>
  );
}
