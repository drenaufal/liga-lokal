import Link from "next/link";
import { CheckCircle2, Circle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { MATCH_STATUS, STAGE_LABEL } from "@/lib/status";
import { matchWinnerSide, placeholderLabel } from "@/lib/fixtures";
import { isGuest } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import type { MatchGoal } from "@/lib/queries/match-goals";
import { ClubCrest } from "./club-crest";
import { LiveCountdown } from "./match-countdown";
import type { MatchRowData } from "./match-row";

type Translate = Awaited<ReturnType<typeof getI18n>>["t"];

/**
 * A schedule / results list as a compact table — one line per match, the same information the
 * match cards carry: kick-off, stage, both clubs with the score (or the shoot-out), scorers,
 * status, and for people who run the match whether each club has submitted its DSP.
 *
 * From `sm` up a row reads left to right (clubs either side of the score). On a phone the two
 * clubs are stacked with their score at the end of each line and the status moves under the time.
 *
 * `showDate` / `showStage` drop a column the surrounding group heading already says;
 * `showMeta` adds the age group, tournament and stadium. `actions` renders a control per row.
 */
export async function MatchTable({
  matches,
  showDate = true,
  showStage = true,
  showMeta = false,
  actions,
}: {
  matches: MatchRowData[];
  showDate?: boolean;
  showStage?: boolean;
  showMeta?: boolean;
  actions?: (m: MatchRowData) => React.ReactNode;
}) {
  const { t, fmt } = await getI18n();
  // DSP progress is for the people who run the match; visitors only see the match.
  const guest = await isGuest();
  const actionCells = actions ? matches.map(actions) : [];
  const withActions = actionCells.some(Boolean);

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("Jadwal & Hasil")}</caption>
        <thead className="border-b border-line text-left text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
          <tr>
            <th scope="col" className="whitespace-nowrap px-2 py-2">{t("Waktu")}</th>
            {showStage && <th scope="col" className="hidden whitespace-nowrap px-2 py-2 md:table-cell">{t("Babak::fase")}</th>}
            <th scope="col" className="px-2 py-2 sm:text-center">{t("Pertandingan")}</th>
            {showMeta && <th scope="col" className="hidden whitespace-nowrap px-2 py-2 lg:table-cell">{t("KU & Stadion")}</th>}
            <th scope="col" className="hidden whitespace-nowrap px-2 py-2 text-right sm:table-cell">{t("Status")}</th>
            {withActions && <th scope="col" className="w-10 px-1 py-2"><span className="sr-only">{t("Aksi")}</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {matches.map((m, i) => {
            const live = m.status === "live";
            const done = m.status === "completed";
            const inPlay = live || m.status === "halftime";
            const scored = done || inPlay;
            const winner = done ? matchWinnerSide(m) : null;
            const stage = stageText(t, m);
            const homeName = m.homeName ?? placeholderLabel(t, m.homePlaceholder) ?? "TBD";
            const awayName = m.awayName ?? placeholderLabel(t, m.awayPlaceholder) ?? "TBD";
            const homeGoals = (m.goals ?? []).filter((g) => g.clubId === m.homeClubId);
            const awayGoals = (m.goals ?? []).filter((g) => g.clubId === m.awayClubId);
            const meta = [m.tournamentName, m.ageCode].filter(Boolean).join(" · ");
            const shootout = done && m.homeScore === m.awayScore && m.homePenalties != null && m.awayPenalties != null
              ? t("{home}–{away} pen", { home: m.homePenalties, away: m.awayPenalties })
              : null;
            const homeDsp = !guest && m.homeClubId ? !!m.homeDspSubmitted : undefined;
            const awayDsp = !guest && m.awayClubId ? !!m.awayDspSubmitted : undefined;
            const status = (
              <Badge tone={MATCH_STATUS[m.status]?.tone ?? "neutral"} dot={live}>
                {t.dyn(MATCH_STATUS[m.status]?.label ?? m.status)}
              </Badge>
            );
            const liveClock = live && (
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-brand">
                <Radio className="size-2.5 animate-live" aria-hidden />
                {m.duration ? (
                  <LiveCountdown status={m.status} currentMinute={m.currentMinute ?? 0} clockStartedAt={m.clockStartedAt ?? null} duration={m.duration} />
                ) : (
                  <>{m.currentMinute ?? 0}&rsquo;</>
                )}
              </span>
            );

            const body = (
              <>
                {/* sm and up: clubs either side of the score */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2.5">
                    <Team name={homeName} short={m.homeShort} logo={m.homeLogo} side="home" dim={winner === "away"} bold={winner === "home"} dsp={homeDsp} t={t} />
                    <div className="flex min-w-14 flex-col items-center">
                      {scored ? (
                        <span className={cn("whitespace-nowrap rounded-lg px-2.5 py-1 font-display text-xl leading-none tabular-nums", live ? "bg-brand text-white" : "bg-night text-white")}>
                          {m.homeScore}<span className="mx-0.5 opacity-60">–</span>{m.awayScore}
                        </span>
                      ) : (
                        <span className="rounded-lg bg-surface-2 px-2.5 py-1 font-display text-sm italic text-ink-muted">VS</span>
                      )}
                      {shootout && <span className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-ink-secondary">{shootout}</span>}
                    </div>
                    <Team name={awayName} short={m.awayShort} logo={m.awayLogo} side="away" dim={winner === "home"} bold={winner === "away"} dsp={awayDsp} t={t} />
                  </div>
                  {(homeGoals.length > 0 || awayGoals.length > 0) && (
                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] gap-x-2.5 text-[11px] leading-snug text-ink-secondary">
                      <Scorers goals={homeGoals} align="right" t={t} />
                      <span aria-hidden />
                      <Scorers goals={awayGoals} align="left" t={t} />
                    </div>
                  )}
                  {/* below lg the age group / stadium column is hidden: say it here */}
                  {showMeta && (meta || m.venue) && (
                    <p className="mt-1 truncate text-center text-[10.5px] text-ink-muted lg:hidden">{[meta, m.venue].filter(Boolean).join(" · ")}</p>
                  )}
                </div>

                {/* phone: one line per club, score at the end */}
                <div className="sm:hidden">
                  <TeamLine name={homeName} short={m.homeShort} logo={m.homeLogo} score={scored ? m.homeScore : null} dim={winner === "away"} bold={winner === "home"} dsp={homeDsp} t={t} />
                  <TeamLine name={awayName} short={m.awayShort} logo={m.awayLogo} score={scored ? m.awayScore : null} dim={winner === "home"} bold={winner === "away"} dsp={awayDsp} t={t} />
                  {shootout && <p className="mt-0.5 text-right text-[10px] font-semibold text-ink-secondary">{shootout}</p>}
                  {(homeGoals.length > 0 || awayGoals.length > 0) && (
                    <div className="mt-1.5 space-y-1 text-[11px] leading-snug text-ink-secondary">
                      {[
                        { key: "h", short: m.homeShort ?? homeName, goals: homeGoals },
                        { key: "a", short: m.awayShort ?? awayName, goals: awayGoals },
                      ]
                        .filter((s) => s.goals.length)
                        .map((s) => (
                          <p key={s.key} className="break-words">
                            <span className="font-bold text-ink">{s.short}</span>{" "}
                            {s.goals.map((g, gi) => (
                              <span key={g.id}>
                                {gi > 0 && ", "}
                                {g.playerName ?? t("Pencetak gol belum dicatat")}{" "}
                                <span className="whitespace-nowrap font-bold tabular-nums text-ink">
                                  {g.minute}
                                  {g.addedTime ? `+${g.addedTime}` : ""}′{g.ownGoal ? ` ${t("(BD)")}` : ""}
                                </span>
                              </span>
                            ))}
                          </p>
                        ))}
                    </div>
                  )}
                  {showMeta && (meta || m.venue) && <p className="mt-1 text-[10.5px] text-ink-muted">{[meta, m.venue].filter(Boolean).join(" · ")}</p>}
                </div>
              </>
            );

            return (
              <tr key={m.id} className={cn("align-top transition-colors hover:bg-surface-2/70", inPlay && "bg-brand/5")}>
                <td className="w-[5.5rem] whitespace-nowrap px-2 py-2.5 sm:w-auto">
                  {showDate && (
                    <div className="text-xs font-semibold text-ink">{fmt.date(m.scheduledAt, { weekday: "short", day: "numeric", month: "short" })}</div>
                  )}
                  <div className={cn("tabular-nums", showDate ? "text-[11px] text-ink-muted" : "text-xs font-semibold text-ink")}>
                    {fmt.time(m.scheduledAt)} <span className="text-[9px] font-semibold text-ink-muted">WIB</span>
                  </div>
                  {/* the stage / status columns are hidden on narrow screens: say them here */}
                  {showStage && <div className="mt-0.5 truncate text-[10px] text-ink-muted md:hidden">{stage}</div>}
                  <div className="mt-1.5 sm:hidden">
                    {status}
                    {liveClock}
                  </div>
                </td>
                {showStage && <td className="hidden whitespace-nowrap px-2 py-2.5 text-[11px] leading-snug text-ink-secondary md:table-cell">{stage}</td>}
                <td className="w-full px-2 py-2.5">
                  {guest ? (
                    <div>{body}</div>
                  ) : (
                    <Link href={`/match-ops/${m.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand" title={`${homeName} vs ${awayName}`}>
                      {body}
                    </Link>
                  )}
                </td>
                {showMeta && (
                  <td className="hidden max-w-48 px-2 py-2.5 text-[11px] leading-snug lg:table-cell">
                    {meta && <div className="truncate font-medium text-ink-secondary">{meta}</div>}
                    {m.venue && <div className="truncate text-ink-muted">{m.venue}</div>}
                  </td>
                )}
                <td className="hidden whitespace-nowrap px-2 py-2.5 text-right sm:table-cell">
                  {status}
                  {liveClock && <div className="flex justify-end">{liveClock}</div>}
                </td>
                {withActions && <td className="px-1 py-2 text-right">{actionCells[i]}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "Fase grup · Grup A · Pekan 3": where the match sits in its KU. */
function stageText(t: Translate, m: MatchRowData) {
  const stage = t.dyn(STAGE_LABEL[m.stage] ?? m.stage);
  return [
    stage,
    m.groupLabel ? t("Grup {label}", { label: m.groupLabel }) : null,
    m.stage === "league" ? t("Pekan {round}", { round: m.round }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function nameClass(dim?: boolean, bold?: boolean) {
  return dim ? "font-normal text-ink-muted" : bold ? "font-bold text-ink" : "font-semibold text-ink";
}

/** Whether this club has submitted its DSP; undefined hides the mark (visitors, or no club yet). */
function DspMark({ dsp, t, compact }: { dsp?: boolean; t: Translate; compact?: boolean }) {
  if (dsp === undefined) return null;
  return (
    <span
      title={dsp ? t("DSP sudah submit") : t("DSP belum submit")}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
        dsp ? "bg-success/12 text-success" : "bg-surface-2 text-ink-muted",
      )}
    >
      {dsp ? <CheckCircle2 className={compact ? "size-3.5" : "size-2.5"} aria-hidden /> : <Circle className={compact ? "size-3.5" : "size-2.5"} aria-hidden />}
      {!compact && "DSP"}
      <span className="sr-only">{dsp ? t("DSP sudah submit") : t("DSP belum submit")}</span>
    </span>
  );
}

function Team({
  name,
  short,
  logo,
  side,
  dim,
  bold,
  dsp,
  t,
}: {
  name: string;
  short?: string | null;
  logo?: string | null;
  side: "home" | "away";
  dim?: boolean;
  bold?: boolean;
  dsp?: boolean;
  t: Translate;
}) {
  const home = side === "home";
  return (
    <div className={cn("flex min-w-0 items-center gap-2", home && "flex-row-reverse")}>
      <ClubCrest logoUrl={logo} short={short} size={28} />
      <div className={cn("min-w-0", home ? "text-right" : "text-left")}>
        <span className={cn("block truncate text-[13px] leading-tight", nameClass(dim, bold))}>{name}</span>
        {dsp !== undefined && <span className="mt-0.5 block"><DspMark dsp={dsp} t={t} /></span>}
      </div>
    </div>
  );
}

/** Phone layout: crest, name (and DSP mark), then the score. */
function TeamLine({
  name,
  short,
  logo,
  score,
  dim,
  bold,
  dsp,
  t,
}: {
  name: string;
  short?: string | null;
  logo?: string | null;
  score: number | null;
  dim?: boolean;
  bold?: boolean;
  dsp?: boolean;
  t: Translate;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5">
      <ClubCrest logoUrl={logo} short={short} size={24} />
      <span className={cn("min-w-0 flex-1 text-[13px] leading-tight [overflow-wrap:anywhere]", nameClass(dim, bold))}>{name}</span>
      <DspMark dsp={dsp} t={t} compact />
      {score !== null && <span className={cn("w-6 shrink-0 text-right font-display text-xl leading-none tabular-nums", dim ? "text-ink-muted" : "text-ink")}>{score}</span>}
    </div>
  );
}

function Scorers({ goals, align, t }: { goals: MatchGoal[]; align: "left" | "right"; t: Translate }) {
  if (!goals.length) return <span />;
  return (
    <ul className={cn("min-w-0", align === "right" ? "text-right" : "text-left")}>
      {goals.map((g) => (
        <li key={g.id} className="break-words">
          <span>{g.playerName ?? t("Pencetak gol belum dicatat")}</span>{" "}
          <span className="whitespace-nowrap font-bold tabular-nums text-ink">
            {g.minute}
            {g.addedTime ? `+${g.addedTime}` : ""}′{g.ownGoal ? ` ${t("(BD)")}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
