import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Ruler,
  Footprints,
  ShieldCheck,
  User2,
  Phone,
  Pencil,
  Hash,
  ChevronRight,
} from "lucide-react";
import { getPlayerProfile } from "@/lib/queries/registry";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { FootPreference } from "@/components/app/foot-icon";
import { getMediaMeta } from "@/lib/media-store";
import { DocumentRow } from "@/components/app/document-row";
import { crestTint } from "@/lib/crest";
import { StatusBadge } from "@/components/app/status-badge";
import { Icon } from "@/components/app/icon";
import { Radar } from "@/components/charts/radar";
import { RADAR_AXES, radarValues, per90Summary, percentileOf } from "@/lib/player-metrics";
import { emptyTotals } from "@/lib/player-stats";
import { PLAYER_DOCUMENTS, documentCompleteness } from "@/lib/player-documents";
import { LINE_LABEL, positionLine } from "@/lib/positions";
import { cn, ageFromDob, formatDate, formatNumber } from "@/lib/utils";
import { VerificationControl } from "./verification-control";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getPlayerProfile(id);
  return { title: data?.player.fullName ?? "Pemain" };
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ klub?: string }>;
}) {
  const { id } = await params;
  const { klub } = await searchParams;
  const data = await getPlayerProfile(id, klub);
  if (!data) notFound();
  const { player, clubChips, selectedClub, peers } = data;
  const t = data.totals ?? emptyTotals();
  const user = await getCurrentUser();
  const canVerify = can(user?.role, "registry:verify");
  const canWrite = can(user?.role, "registry:write");
  const docMeta = canVerify
    ? await Promise.all(PLAYER_DOCUMENTS.map((d) => getMediaMeta(player[d.key])))
    : [];

  const chip = clubChips.find((c) => c.id === selectedClub) ?? null;
  const filtered = !!chip;
  const radar = radarValues(t);
  const p90 = per90Summary(t);
  // Percentile pools hold all-clubs career lines, so it only applies to "Semua klub".
  const scorePct = filtered
    ? null
    : percentileOf(
        t.score,
        peers.map((x) => x.score),
      );
  const completeness = documentCompleteness(player);

  const statTiles = [
    { label: "Penampilan", value: t.appearances },
    { label: "Menit", value: formatNumber(t.minutesPlayed) },
    { label: "Gol", value: t.goals },
    { label: "Assist", value: t.assists },
    { label: "Tembakan tepat", value: t.shotsOnTarget },
    { label: "Tembakan meleset", value: t.shotsOffTarget },
    { label: "Penyelamatan", value: t.saves },
    { label: "Intersep", value: t.interceptions },
    { label: "Tekel", value: t.tackles },
    { label: "Nirbobol", value: t.cleanSheets },
    { label: "Kartu kuning", value: t.yellowCards },
    { label: "Kartu merah", value: t.redCards },
  ];

  const clubs = [player.club, player.secondClub].filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div>
      <Link
        href="/registry/pemain"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke daftar pemain
      </Link>

      {/* Header */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={player.photoUrl} name={player.fullName} size={96} square className="border border-line" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                {player.fullName}
              </h1>
              {player.nickname && (
                <span className="text-sm text-ink-muted">&ldquo;{player.nickname}&rdquo;</span>
              )}
              <StatusBadge kind="verification" value={player.verificationStatus} dot />
              {canWrite && (
                <Button variant="outline" size="sm" href={`/registry/pemain/${player.id}/edit`} className="ml-auto">
                  <Pencil className="size-3.5" /> Ubah data
                </Button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary">
              <span className="font-mono text-ink-muted">{player.registrationNo}</span>
              <StatusBadge kind="position" value={player.position} />
              {player.jerseyNumber && <span>No. punggung {player.jerseyNumber}</span>}
              {clubs.map((c, i) => (
                <Link key={c.id} href={`/registry/klub/${c.id}`} className="flex items-center gap-1.5 hover:text-ink">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: crestTint(c.shortName).bg }}
                  />
                  {c.name}
                  {i === 1 && (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">
                      Klub kedua
                    </span>
                  )}
                </Link>
              ))}
              {player.ageCategory && <Badge tone="info">{player.ageCategory.code}</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
              <Detail icon={Hash} label="NISN">
                <span className="font-mono tracking-wide">{player.nisn}</span>
              </Detail>
              <Detail icon={CalendarDays} label="Tanggal lahir">
                {player.dob ? `${formatDate(player.dob)} · ${ageFromDob(player.dob)} th` : "—"}
              </Detail>
              <Detail icon={MapPin} label="Tempat lahir">{player.birthPlace ?? "—"}</Detail>
              <Detail icon={Ruler} label="Tinggi / Berat">
                {player.heightCm ? `${player.heightCm} cm` : "—"} / {player.weightKg ? `${player.weightKg} kg` : "—"}
              </Detail>
              <Detail icon={Footprints} label="Kaki dominan">
                <FootPreference foot={player.foot} size={18} showLabel className="text-ink" />
              </Detail>
              <Detail icon={User2} label="Wali">{player.guardianName ?? "—"}</Detail>
              <Detail icon={Phone} label="Kontak wali">{player.guardianPhone ?? "—"}</Detail>
              {player.verifiedAt && (
                <Detail icon={ShieldCheck} label="Diverifikasi">{formatDate(player.verifiedAt)}</Detail>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Club filter — only meaningful when the player has more than one club */}
      {clubChips.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Statistik per klub
          </span>
          <ClubChipLink href={`/registry/pemain/${id}`} active={!filtered}>
            Semua klub
          </ClubChipLink>
          {clubChips.map((c) => (
            <ClubChipLink
              key={c.id}
              href={`/registry/pemain/${id}?klub=${c.id}`}
              active={selectedClub === c.id}
              color={crestTint(c.short || c.name).bg}
              note={c.tag === "utama" ? "utama" : c.tag === "kedua" ? "kedua" : undefined}
            >
              {c.short || c.name}
            </ClubChipLink>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Radar */}
        <Card>
          <CardHeader>
            <CardTitle>Profil Radar Performa</CardTitle>
            {scorePct !== null ? (
              <Badge tone="brand">
                Persentil {scorePct} · {LINE_LABEL[positionLine(player.position)]}
              </Badge>
            ) : filtered ? (
              <Badge tone="neutral">{chip?.short}</Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {t.appearances > 0 ? (
              <>
                <Radar
                  axes={RADAR_AXES.map((a) => ({ key: a.key, label: a.label }))}
                  series={[
                    {
                      label: player.fullName,
                      color: "var(--color-chart-1)",
                      values: radar,
                    },
                  ]}
                />
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line-soft pt-3 text-center">
                  {[
                    ["Gol / 90", p90.goals],
                    ["Assist / 90", p90.assists],
                    ["Umpan kunci / 90", p90.keyPasses],
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
                  ? `Belum ada data pertandingan saat membela ${chip?.name}.`
                  : "Belum ada data pertandingan untuk membentuk profil radar."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>{filtered ? `Statistik · ${chip?.short}` : "Statistik Karier"}</CardTitle>
            <span className="text-[11px] text-ink-muted">
              {filtered ? "Hanya saat membela klub ini" : "Akumulasi semua klub & kompetisi"}
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {statTiles.map((s) => (
                <div key={s.label} className="rounded-lg border border-line-soft bg-surface-2/40 px-3 py-2.5">
                  <div className="text-lg font-semibold tabular-nums leading-tight text-ink">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-xs">
              <span className="text-ink-muted">Rating rata-rata</span>
              <span className="font-semibold tabular-nums text-ink">{t.appearances > 0 ? t.rating.toFixed(1) : "—"}</span>
              <span className="text-ink-muted">Skor</span>
              <span className="font-semibold tabular-nums text-brand">{Math.round(t.score)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Verification + documents */}
        <Card>
          <CardHeader>
            <CardTitle>Verifikasi & Dokumen</CardTitle>
            <span className="text-[11px] tabular-nums text-ink-muted">
              {completeness.have}/{completeness.total} lengkap
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Progress
                value={(completeness.have / completeness.total) * 100}
                tone={completeness.have === completeness.total ? "success" : completeness.have >= 3 ? "warn" : "danger"}
              />
              <ul className="mt-3 space-y-1.5">
                {PLAYER_DOCUMENTS.map((d, i) => (
                  <DocumentRow
                    key={d.key}
                    label={d.label}
                    url={player[d.key]}
                    meta={docMeta[i] ?? null}
                    canView={canVerify}
                    editHref={canWrite ? `/registry/pemain/${player.id}/edit` : null}
                  />
                ))}
              </ul>
            </div>
            {canVerify ? (
              <VerificationControl
                playerId={player.id}
                current={player.verificationStatus}
                notes={player.verificationNotes}
              />
            ) : (
              <div className="space-y-2">
                <StatusBadge kind="verification" value={player.verificationStatus} dot />
                {player.verificationNotes && (
                  <p className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5 text-xs text-ink-secondary">
                    {player.verificationNotes}
                  </p>
                )}
                <p className="text-[11px] text-ink-muted">
                  Anda tidak memiliki izin mengubah status verifikasi.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-tournament + badges + history */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rincian per Kompetisi</CardTitle>
            <span className="text-[11px] text-ink-muted">Klik kompetisi untuk melihat detail pertandingan</span>
          </CardHeader>
          <CardContent className="p-0">
            {data.tournaments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2.5">Kompetisi</th>
                      <th className="px-3 py-2.5 text-right">Main</th>
                      <th className="px-3 py-2.5 text-right">Gol</th>
                      <th className="px-3 py-2.5 text-right">Assist</th>
                      <th className="px-3 py-2.5 text-right">Rating</th>
                      <th className="px-3 py-2.5 text-right">Skor</th>
                      <th className="w-8 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {data.tournaments.map((st) => {
                      const href = `/registry/pemain/${player.id}/kompetisi/${st.tournamentId}`;
                      return (
                        <tr key={st.id} className="group relative transition-colors hover:bg-surface-2/50">
                          <td className="px-4 py-2.5">
                            <Link href={href} className="block font-medium text-ink after:absolute after:inset-0 group-hover:text-brand">
                              {st.tournamentName ?? `Kompetisi ${st.season}`}
                            </Link>
                            {st.clubShort && (
                              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{ background: crestTint(st.clubShort).bg }}
                                />
                                Membela {st.clubName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{st.appearances}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{st.goals}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{st.assists}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{st.rating.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                            {Math.round(st.score)}
                          </td>
                          <td className="px-2 py-2.5 text-ink-muted group-hover:text-brand">
                            <ChevronRight className="size-4" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-center text-xs text-ink-muted">
                {filtered
                  ? `Belum ada kompetisi saat membela ${chip?.name}.`
                  : "Pemain belum tampil di kompetisi resmi."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lencana & Penghargaan</CardTitle>
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
                      <p className="text-xs font-medium text-ink">{pb.badge.name}</p>
                      <p className="text-[10px] text-ink-muted">{pb.context ?? pb.badge.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-ink-muted">Belum ada lencana.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {player.seasonHistory.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Perkembangan Jangka Panjang</CardTitle>
            <span className="text-[11px] text-ink-muted">Pemantauan longitudinal antar musim</span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {[...player.seasonHistory]
                .sort((a, b) => a.season.localeCompare(b.season))
                .map((h) => (
                  <div
                    key={h.id}
                    className="min-w-[140px] flex-1 rounded-lg border border-line-soft bg-surface-2/40 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink">Musim {h.season}</span>
                      <Badge tone="neutral">{h.ageCategoryCode}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                      <Mini label="Main" value={h.appearances} />
                      <Mini label="Gol" value={h.goals} />
                      <Mini label="Rating" value={h.avgRating.toFixed(1)} />
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
      {color !== undefined && (
        <span className="size-2 rounded-full" style={{ background: color ?? "var(--color-brand)" }} />
      )}
      {children}
      {note && (
        <span className={cn("text-[10px] font-medium", active ? "text-white/60" : "text-ink-muted")}>{note}</span>
      )}
    </Link>
  );
}

function Detail({
  icon: I,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
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
