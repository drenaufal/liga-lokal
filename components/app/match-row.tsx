import { Radio, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MATCH_STATUS, STAGE_LABEL } from "@/lib/status";
import { matchWinnerSide, placeholderLabel } from "@/lib/fixtures";
import { ClubCrest } from "./club-crest";
import { MemberLink } from "./member-link";
import { isGuest } from "@/lib/auth/session";
import { LiveCountdown } from "./match-countdown";
import styles from "./match-row.module.css";
import { GoalScorers } from "./goal-scorers";
import type { MatchGoal } from "@/lib/queries/match-goals";
import { getI18n, getT } from "@/lib/i18n/server";

export type MatchRowData = {
  id: string;
  homeClubId?: string | null;
  awayClubId?: string | null;
  goals?: MatchGoal[];
  homeDspSubmitted?: boolean;
  awayDspSubmitted?: boolean;
  stage: string;
  round: number;
  groupLabel?: string | null;
  bracketSlot?: string | null;
  scheduledAt: Date | string;
  status: string;
  currentMinute?: number | null;
  clockStartedAt?: Date | string | null;
  duration?: number;
  homeScore: number;
  awayScore: number;
  /** Shoot-out score of a level Cup match. */
  homePenalties?: number | null;
  awayPenalties?: number | null;
  homeShort?: string | null;
  homeName?: string | null;
  homeLogo?: string | null;
  awayShort?: string | null;
  awayName?: string | null;
  awayLogo?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
  venue?: string | null;
  /** Age group of the KU, when the list spans several. */
  ageCode?: string | null;
  tournamentName?: string | null;
};

/** Overlapping folder cards, including rows wrapped with management controls. */
export function MatchStack({ children }: { children: React.ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

export async function MatchRow({ m, showMeta = true }: { m: MatchRowData; showMeta?: boolean }) {
  const { t, fmt } = await getI18n();
  // DSP progress is for the people who run the match; visitors only see the match.
  const showDsp = !(await isGuest());
  const live = m.status === "live";
  const done = m.status === "completed";
  const winner = done ? matchWinnerSide(m) : null;
  const homeGoals = (m.goals ?? []).filter((g) => g.clubId === m.homeClubId);
  const awayGoals = (m.goals ?? []).filter((g) => g.clubId === m.awayClubId);
  const hasGoals = homeGoals.length > 0 || awayGoals.length > 0;
  const longGoalList = homeGoals.length > 5 || awayGoals.length > 5;
  const shootout = done && m.homeScore === m.awayScore && m.homePenalties != null && m.awayPenalties != null
    ? t("{home}–{away} pen", { home: m.homePenalties, away: m.awayPenalties }) : null;

  return (
    <MemberLink href={`/match-ops/${m.id}`} className={cn(styles.ticket, "group block min-w-0 transition-colors hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand focus-visible:outline-none")}>
      {/* Wide cards: each club's badge, huge and faded, fills the flank beside its scorers. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden @4xl:block">
        {m.homeClubId && <ClubCrest logoUrl={m.homeLogo} short={m.homeShort} size={380} className="absolute -left-24 top-1/2 -translate-y-1/2 opacity-[0.11]" />}
        {m.awayClubId && <ClubCrest logoUrl={m.awayLogo} short={m.awayShort} size={380} className="absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.11]" />}
      </div>
      <div className="flex items-center justify-between gap-16 border-b border-current/15 px-4 pb-2.5 pt-3.5 text-[10px] font-bold">
        <span className="min-w-0 truncate">{t.dyn(STAGE_LABEL[m.stage] ?? m.stage)}{m.groupLabel ? ` · ${t("Grup {label}", { label: m.groupLabel })}` : ""}{m.stage === "league" ? ` · ${t("Pekan {round}", { round: m.round })}` : ""}</span>
        <span className="shrink-0">{fmt.date(m.scheduledAt, { day: "numeric", month: "short" })}</span>
      </div>
      {showMeta && (m.tournamentName || m.ageCode) && <div className="px-4 pt-2 text-[10px] font-semibold">{[m.tournamentName, m.ageCode].filter(Boolean).join(" · ")}</div>}
      <div className={styles.body}>
        <div className={cn(styles.matchInfo, "grid grid-cols-2 items-center gap-3 px-4 py-4 @lg:grid-cols-[80px_minmax(0,1fr)_80px]")}>
          <div className={cn(styles.time, "order-1")}>
            <span className="font-display text-2xl italic tabular-nums @4xl:text-3xl">{fmt.time(m.scheduledAt)}</span>
            <span className="ml-1 text-[9px] font-semibold @lg:ml-0 @lg:mt-1 @lg:block">WIB</span>
          </div>
          <div className={cn(styles.teams, "order-3 col-span-2 mx-auto grid w-full max-w-lg min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 @lg:order-2 @lg:col-span-1 @4xl:max-w-none @4xl:gap-6")}>
            <Side name={m.homeName ?? placeholderLabel(t, m.homePlaceholder)} short={m.homeShort} logo={m.homeLogo} dim={winner === "away"} bold={winner === "home"} dsp={showDsp && m.homeClubId ? !!m.homeDspSubmitted : undefined} />
            <div className="flex flex-col items-center">
              {done || live ? <span className="whitespace-nowrap rounded-2xl bg-black/20 px-4 py-2 font-display text-4xl leading-none tabular-nums @4xl:px-6 @4xl:py-3 @4xl:text-6xl">{m.homeScore}<span className="mx-1">–</span>{m.awayScore}</span> : <span className="rounded-full bg-black/20 px-4 py-2 font-display text-2xl italic @4xl:px-5 @4xl:text-3xl">VS</span>}
              {shootout && <span className="mt-1 text-[9px] font-semibold">{shootout}</span>}
              {live && <span className="mt-1 flex items-center gap-1 text-[9px] font-bold"><Radio className="size-2 animate-live" />{m.duration ? <LiveCountdown status={m.status} currentMinute={m.currentMinute ?? 0} clockStartedAt={m.clockStartedAt ?? null} duration={m.duration} className="text-current" /> : <>{m.currentMinute ?? 0}&rsquo;</>}</span>}
            </div>
            <Side name={m.awayName ?? placeholderLabel(t, m.awayPlaceholder)} short={m.awayShort} logo={m.awayLogo} dim={winner === "home"} bold={winner === "away"} dsp={showDsp && m.awayClubId ? !!m.awayDspSubmitted : undefined} />
          </div>
          {showMeta && m.venue && <div className={cn(styles.venue, "order-2 min-w-0 text-right @lg:order-3")}><span className="mb-1 block text-[9px]">{t("Stadion")}</span><span className="line-clamp-2 text-xs font-bold italic">{m.venue}</span></div>}
        </div>
        {hasGoals && <div className={cn(styles.scorers, "mx-4 grid gap-4 border-t border-current/15 py-3 @lg:grid-cols-2 @lg:gap-6", longGoalList ? "grid-cols-1" : "grid-cols-2")}>
          <div className={cn(styles.homeGoals, "min-w-0")}>
            <span className={cn(styles.scorerLabel, "block text-[9px] font-bold uppercase tracking-wide")}>{m.homeName ?? placeholderLabel(t, m.homePlaceholder) ?? t("Tuan rumah")}</span>
            <GoalScorers goals={homeGoals} />
          </div>
          <div className={cn(styles.awayGoals, "min-w-0")}>
            <span className={cn(styles.scorerLabel, "block text-[9px] font-bold uppercase tracking-wide")}>{m.awayName ?? placeholderLabel(t, m.awayPlaceholder) ?? t("Tamu")}</span>
            <GoalScorers goals={awayGoals} />
          </div>
        </div>}
      </div>
      <div className="flex justify-end px-4 pb-3">
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold", live ? "bg-white text-brand" : "bg-night text-white")}>{t.dyn(MATCH_STATUS[m.status]?.label ?? m.status)}</span>
      </div>
    </MemberLink>
  );
}

async function Side({ name, short, logo, dim, bold, dsp }: { name?: string | null; short?: string | null; logo?: string | null; dim?: boolean; bold?: boolean; dsp?: boolean }) {
  const t = await getT();
  return <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
    {dsp !== undefined && <span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold", dsp ? "bg-white text-success" : "bg-black/10")} title={dsp ? t("DSP sudah submit") : t("DSP belum submit")}>{dsp ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}DSP {dsp ? t("Sudah submit") : t("Belum submit")}</span>}
    <span className="rounded-full bg-white/20 p-2 ring-1 ring-white/30 @4xl:p-3"><ClubCrest logoUrl={logo} short={short} size="var(--crest)" className="[--crest:88px] @lg:[--crest:112px] @4xl:[--crest:148px] @6xl:[--crest:176px]" /></span>
    <span className={cn("line-clamp-2 min-w-0 text-sm leading-snug @lg:text-base @4xl:line-clamp-3 @4xl:text-lg", dim ? "font-normal" : bold ? "font-bold" : "font-semibold")}>{name ?? "TBD"}</span>
  </div>;
}
