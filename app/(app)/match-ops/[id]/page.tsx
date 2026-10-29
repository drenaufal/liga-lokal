import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Flag as FlagIcon, CalendarClock, UserCog } from "lucide-react";
import { getMatchConsole, getOfficialOptions } from "@/lib/queries/match";
import { requireCapability, getClubScope } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { DEFAULT_MATCH_MINUTES, clockCap } from "@/lib/match-clock";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { MatchStatistics } from "@/components/app/match-statistics";
import { buildMatchStatistics } from "@/lib/match-statistics";
import { GoalScorers } from "@/components/app/goal-scorers";
import { MatchTimeline } from "@/components/app/match-timeline";
import { ConsoleControls } from "./console-controls";
import type { RosterPlayer } from "./event-entry";
import { SquadSelection } from "./squad-selection";
import { PlayerList } from "./player-list";
import { AssignmentCard } from "./assignment-card";
import { buildTallies } from "@/lib/match-tally";
import { withAutomaticSaves } from "@/lib/automatic-saves";
import { participationAt } from "@/lib/match-participation";
import { ResultControl } from "./result-control";
import { isCupStage } from "@/lib/cup-advance";
import { STAGE_LABEL } from "@/lib/status";
import { LINE_ORDER, positionLine } from "@/lib/positions";
import { inClubScope } from "@/lib/club-scope";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await getMatchConsole(id);
  return {
    title: d ? `${d.homeShort} v ${d.awayShort}` : (await getI18n()).t("Pertandingan::tunggal"),
  };
}

export default async function MatchConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("match:view");
  const { id } = await params;
  const d = await getMatchConsole(id);
  if (!d || !inClubScope(await getClubScope(), d.m.homeClubId, d.m.awayClubId)) notFound();
  const { m } = d;
  const canOperate = can(user, "match:operate");
  const canEvents = can(user, "match:events");
  const canVoid = can(user, "match:void");
  const canConfirm = can(user, "match:confirm");
  const canAmend = can(user, "match:amend");
  const canAssign = can(user, "match:assign");
  const canSquad = can(user, "match:squad");
  const squadReady = [m.homeClubId, m.awayClubId].every((id) => id && d.lineups.some((l) => l.clubId === id));
  const assigned = !!m.refereeId && d.operators.length > 0 && squadReady;
  const officialOptions = canAssign && m.status === "scheduled" ? await getOfficialOptions() : null;

  const duration = m.durationMinutes ?? d.ageDuration?.matchDuration ?? DEFAULT_MATCH_MINUTES;
  const clock = {
    status: m.status,
    currentMinute: m.currentMinute,
    clockStartedAt: m.clockStartedAt ? new Date(m.clockStartedAt).toISOString() : null,
    cap: clockCap(duration),
  };
  const playerLookup = Object.fromEntries([
    ...d.squads.map((s) => [s.id, s.name]),
    ...d.lineups.map((l) => [l.playerId, l.name]),
  ]);

  // Only the players selected for this match appear on the team sheet.
  const byPitchOrder = (a: RosterPlayer, b: RosterPlayer) =>
    LINE_ORDER[positionLine(a.position)] - LINE_ORDER[positionLine(b.position)] || (a.number ?? 99) - (b.number ?? 99);
  const evs = d.events.filter((e) => !e.voided);
  const states = participationAt(d.lineups, evs);
  const rosterFor = (clubId: string | null): RosterPlayer[] => {
    if (!clubId) return [];
    const lineup = d.lineups.filter((l) => l.clubId === clubId);
    if (lineup.length) {
      return lineup
        .map((l) => ({
          id: l.playerId,
          name: l.name,
          position: l.position,
          number: l.shirtNumber,
          role: l.role,
          captain: l.isCaptain,
          state: states.get(l.playerId),
        }))
        .sort(byPitchOrder);
    }
    return [];
  };

  // Per-player counters for the list (assists come from the paired "assist" events).
  const tallies = buildTallies(withAutomaticSaves(evs, d.lineups));

  const canRecord = canEvents && m.status !== "scheduled";
  // one-tap buttons only while the match is in play; afterwards corrections go through the full form
  const canQuick = canEvents && (m.status === "live" || m.status === "halftime");

  const stats = buildMatchStatistics(evs, m.homeClubId, m.awayClubId);
  const showStats = m.status === "live" || m.status === "halftime" || m.status === "completed";

  return (
    <div>
      {(m.status === "scheduled" || m.status === "live" || m.status === "halftime") && <AutoRefresh seconds={5} />}
      <Link
        href="/match-ops"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Semua pertandingan")}
      </Link>

      {/* Scoreboard */}
      <ConsoleControls
        matchId={id}
        status={m.status}
        period={m.period}
        currentMinute={m.currentMinute}
        clockStartedAt={clock.clockStartedAt}
        duration={duration}
        homeShort={d.homeShort}
        awayShort={d.awayShort}
        homeName={d.homeName}
        awayName={d.awayName}
        homeLogo={d.homeLogo}
        awayLogo={d.awayLogo}
        homeScore={m.homeScore}
        awayScore={m.awayScore}
        canOperate={canOperate}
        canStart={assigned}
        startHint={
          !squadReady ? t("Pilih pemain kedua tim terlebih dahulu") :
          !m.refereeId && !d.operators.length
            ? t("Tugaskan wasit dan operator terlebih dahulu")
            : !m.refereeId
              ? t("Tugaskan wasit terlebih dahulu")
              : t("Tugaskan operator terlebih dahulu")
        }
        meta={
          <div className="w-full">
          <div className="mb-3 grid grid-cols-2 gap-6 text-center text-white">
            <div><GoalScorers goals={d.goals.filter((g) => g.clubId === m.homeClubId)} /></div>
            <div><GoalScorers goals={d.goals.filter((g) => g.clubId === m.awayClubId)} /></div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-night-muted">
            <Link href={`/kompetisi/ku/${d.tournamentId}`} className="font-semibold text-white hover:underline">
              {d.tournamentName}
            </Link>
            <span>· {t.dyn(STAGE_LABEL[m.stage] ?? m.stage)}{m.groupLabel ? ` ${t("Grup {label}", { label: m.groupLabel })}` : ""}</span>
            {d.venue && <span className="flex items-center gap-1"><MapPin className="size-3" />{d.venue}</span>}
            {d.referee && <span className="flex items-center gap-1"><FlagIcon className="size-3" />{d.referee}</span>}
            {d.operators.length > 0 && <span className="flex items-center gap-1"><UserCog className="size-3" />{d.operators.map((o) => o.name).join(", ")}</span>}
            <span className="flex items-center gap-1"><CalendarClock className="size-3" />{fmt.dateTime(m.scheduledAt)}</span>
            <StatusBadge kind="result" value={m.resultStatus} />
          </div>
          </div>
        }
      />

      <div className="mt-4 min-w-0 space-y-4">
          <AssignmentCard
            key={`${m.refereeId ?? "-"}:${d.operators.map((o) => o.id).sort().join(":")}`}
            matchId={id}
            referee={m.refereeId && d.referee ? { id: m.refereeId, name: d.referee } : null}
            operators={d.operators}
            options={officialOptions}
            scheduled={m.status === "scheduled"}
          />

          {canSquad && m.status === "scheduled" && m.homeClubId && m.awayClubId && <SquadSelection
            key={`${d.lineups.length}:${d.lineups.filter((l) => l.role === "starter").map((l) => l.playerId).sort().join(":")}`}
            matchId={id}
            teams={[{ id: m.homeClubId, name: d.homeName ?? t("Tuan rumah") }, { id: m.awayClubId, name: d.awayName ?? t("Tamu") }]}
            players={d.squads}
            savedCount={d.lineups.length}
            initialStarters={d.lineups.filter((l) => l.role === "starter").map((l) => l.playerId)}
            starterLimit={d.ageDuration?.playersOnField}
            squadLimit={d.ageDuration?.maxSquad}
          />}
          {/* Squad list — click a player to record an event (replaces the tactical board) */}
          {m.homeClubId && m.awayClubId && (
            <PlayerList
              matchId={id}
              clock={clock}
              home={{
                club: { id: m.homeClubId, short: d.homeShort ?? "H", name: d.homeName ?? t("Tuan rumah"), logo: d.homeLogo },
                side: "home",
                players: rosterFor(m.homeClubId),
              }}
              away={{
                club: { id: m.awayClubId, short: d.awayShort ?? "A", name: d.awayName ?? t("Tamu"), logo: d.awayLogo },
                side: "away",
                players: rosterFor(m.awayClubId),
              }}
              tallies={tallies}
              canRecord={canRecord}
              canQuick={canQuick}
              hint={
                canEvents
                  ? t("Pencatatan kejadian aktif setelah pertandingan dimulai.")
                  : t("Susunan pemain kedua tim.")
              }
            />
          )}

          {/* Result validation */}
          {m.status === "completed" && (
            <ResultControl
              matchId={id}
              resultStatus={m.resultStatus}
              homeScore={m.homeScore}
              awayScore={m.awayScore}
              canConfirm={canConfirm}
              canAmend={canAmend}
              amendmentReason={m.amendmentReason}
              isCup={isCupStage(m.stage)}
              homeShort={d.homeShort}
              awayShort={d.awayShort}
              homePenalties={m.homePenalties}
              awayPenalties={m.awayPenalties}
            />
          )}

        {/* Timeline and statistics sit below the team sheets so the player list can use the full width */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <Card className={showStats ? undefined : "lg:col-span-2"}>
            <CardHeader>
              <CardTitle>{t("Lini Masa Kejadian")}</CardTitle>
              <span className="text-[11px] text-ink-muted">{t("{n} kejadian", { n: evs.length })}</span>
            </CardHeader>
            <CardContent className="max-h-[60dvh] overflow-y-auto">
              <MatchTimeline
                events={d.events}
                matchId={id}
                homeClubId={m.homeClubId}
                canEdit={canVoid}
                playerLookup={playerLookup}
              />
            </CardContent>
          </Card>
          {showStats && <MatchStatistics stats={stats} homeShort={d.homeShort} awayShort={d.awayShort} />}
        </div>
      </div>
    </div>
  );
}

