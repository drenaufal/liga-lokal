import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Radio } from "lucide-react";
import { getPlayerTournamentDetail, type PlayerMatchRow } from "@/lib/queries/registry";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { ClubCrest } from "@/components/app/club-crest";
import { StatusBadge } from "@/components/app/status-badge";
import { EVENT_LABEL, STAGE_LABEL } from "@/lib/status";
import { cn, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; tid: string }>;
}): Promise<Metadata> {
  const { id, tid } = await params;
  const d = await getPlayerTournamentDetail(id, tid);
  return { title: d ? `${d.player.fullName} · ${d.tournament.name}` : "Detail kompetisi" };
}

const ACTION_TONE: Record<string, string> = {
  goal: "bg-brand text-white",
  penalty_goal: "bg-brand text-white",
  own_goal: "bg-night text-white",
  assist: "bg-block-blue text-white",
  yellow_card: "bg-block-yellow text-ink",
  second_yellow: "bg-block-yellow text-ink",
  red_card: "bg-night text-white",
  save: "bg-block-mint text-ink",
  interception: "bg-block-lavender text-ink",
  shot_on: "bg-surface-2 text-ink-secondary",
  shot_off: "bg-surface-2 text-ink-muted",
};

export default async function PlayerCompetitionPage({
  params,
}: {
  params: Promise<{ id: string; tid: string }>;
}) {
  const { id, tid } = await params;
  const d = await getPlayerTournamentDetail(id, tid);
  if (!d) notFound();
  const { player, tournament: t, stat, club, matches } = d;

  const recorded = matches.filter((m) => m.involved).length;
  const tiles = stat
    ? [
        ["Main", stat.appearances],
        ["Menit", stat.minutesPlayed],
        ["Gol", stat.goals],
        ["Assist", stat.assists],
        ["Tembakan tepat", stat.shotsOnTarget],
        ["Penyelamatan", stat.saves],
        ["Intersep", stat.interceptions],
        ["Kartu", `${stat.yellowCards} / ${stat.redCards}`],
        ["Rating", stat.rating.toFixed(1)],
        ["Skor", Math.round(stat.score)],
      ]
    : [];

  return (
    <div>
      <Link
        href={`/registry/pemain/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke profil {player.fullName}
      </Link>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar src={player.photoUrl} name={player.fullName} size={64} square className="border border-line" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Detail pertandingan pemain</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{player.fullName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
              <StatusBadge kind="position" value={player.position} />
              {player.jerseyNumber && <span>No. {player.jerseyNumber}</span>}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-surface-2 p-3 sm:max-w-xs">
            <Link href={`/kompetisi/${t.id}`} className="block truncate text-sm font-semibold text-ink hover:text-brand">
              {t.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
              <StatusBadge kind="tournament" value={t.status} dot />
              {t.ageCode && <Badge tone="info">{t.ageCode}</Badge>}
            </div>
            {club && (
              <Link
                href={`/registry/klub/${club.id}`}
                className="mt-2 flex items-center gap-2 text-xs text-ink-secondary hover:text-ink"
              >
                <ClubCrest logoUrl={club.logoUrl} short={club.shortName} color={club.primaryColor} size={22} />
                Membela <span className="font-semibold text-ink">{club.name}</span>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {tiles.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {tiles.map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-line-soft bg-surface px-3 py-2.5">
              <div className="text-lg font-semibold tabular-nums leading-tight text-ink">{value}</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pertandingan{club ? ` ${club.shortName}` : ""}</CardTitle>
          <span className="text-[11px] text-ink-muted">
            {matches.length > 0
              ? `${recorded} dari ${matches.length} laga punya catatan kejadian pemain`
              : "Belum ada pertandingan"}
          </span>
        </CardHeader>
        <CardContent className="p-2 sm:p-3">
          {matches.length === 0 ? (
            <EmptyState
              title="Belum ada pertandingan yang dimainkan"
              description="Pertandingan klub di kompetisi ini akan muncul di sini setelah dimulai."
            />
          ) : (
            <ul className="space-y-1.5">
              {matches.map((m) => (
                <MatchLine key={m.id} m={m} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-muted">
        Rincian dibentuk dari kejadian yang dicatat operator di konsol pertandingan. Laga tanpa catatan berarti belum ada
        kejadian atas nama pemain ini.
      </p>
    </div>
  );
}

function MatchLine({ m }: { m: PlayerMatchRow }) {
  const live = m.status === "live" || m.status === "halftime";
  const result = live ? null : m.scoreFor > m.scoreAgainst ? "M" : m.scoreFor < m.scoreAgainst ? "K" : "S";
  const stage =
    m.stage === "league"
      ? `Pekan ${m.round}`
      : `${STAGE_LABEL[m.stage] ?? m.stage}${m.groupLabel ? ` · Grup ${m.groupLabel}` : ""}`;

  return (
    <li>
      <Link
        href={`/match-ops/${m.id}`}
        className={cn(
          "group flex flex-col gap-3 rounded-2xl border px-3 py-3 transition-colors hover:border-brand/40 sm:flex-row sm:items-center",
          m.involved ? "border-line bg-surface" : "border-line-soft bg-surface-2/40",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ClubCrest logoUrl={m.opponentLogo} short={m.opponentShort} color={m.opponentColor} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              <span className="font-normal text-ink-muted">{m.isHome ? "vs" : "@"}</span> {m.opponentName ?? "—"}
            </p>
            <p className="truncate text-[11px] text-ink-muted">
              {stage} · {formatDateTime(m.scheduledAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <span className="flex items-center gap-2 rounded-full bg-night px-3 py-1 font-display text-lg leading-none tabular-nums text-white">
            {m.scoreFor}
            <span className="text-white/40">:</span>
            {m.scoreAgainst}
          </span>
          {live ? (
            <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-bold text-white">
              <Radio className="size-2.5 animate-live" /> LIVE
            </span>
          ) : (
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                result === "M" && "bg-success/15 text-success",
                result === "S" && "bg-surface-2 text-ink-secondary",
                result === "K" && "bg-danger/12 text-danger",
              )}
              title={result === "M" ? "Menang" : result === "K" ? "Kalah" : "Seri"}
            >
              {result}
            </span>
          )}
          {m.lineupRole && (
            <Badge tone={m.lineupRole === "starter" ? "success" : "neutral"}>
              {m.lineupRole === "starter" ? "Starter" : "Cadangan"}
            </Badge>
          )}
        </div>

        <div className="flex min-w-[8rem] flex-wrap items-center gap-1 sm:max-w-[16rem] sm:justify-end">
          {m.actions.length === 0 ? (
            <span className="text-[11px] text-ink-muted">Tidak ada catatan</span>
          ) : (
            m.actions.map((a, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold tabular-nums",
                  ACTION_TONE[a.type] ?? "bg-surface-2 text-ink-secondary",
                )}
              >
                {a.minute}&rsquo; {EVENT_LABEL[a.type] ?? a.type}
              </span>
            ))
          )}
        </div>
        <ChevronRight className="hidden size-4 shrink-0 text-ink-muted group-hover:text-brand sm:block" />
      </Link>
    </li>
  );
}
