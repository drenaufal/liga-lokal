import Link from "next/link";
import { MapPin, Radio } from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { MATCH_STATUS, STAGE_LABEL } from "@/lib/status";
import { matchWinnerSide } from "@/lib/fixtures";
import { ClubCrest } from "./club-crest";
import { LiveCountdown } from "./match-countdown";
import styles from "./match-row.module.css";

export type MatchRowData = {
  id: string;
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

export function MatchRow({ m, showMeta = true }: { m: MatchRowData; showMeta?: boolean }) {
  const live = m.status === "live";
  const done = m.status === "completed";
  const winner = done ? matchWinnerSide(m) : null;
  const shootout = done && m.homeScore === m.awayScore && m.homePenalties != null && m.awayPenalties != null
    ? `${m.homePenalties}–${m.awayPenalties} pen` : null;

  return (
    <Link href={`/match-ops/${m.id}`} className={cn(styles.ticket, "group block min-w-0 text-ink transition-colors hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand focus-visible:outline-none")}>
      <div className="flex items-center justify-between gap-16 border-b border-ink/10 px-4 pb-2.5 pt-3.5 text-[10px] font-bold">
        <span className="min-w-0 truncate">{STAGE_LABEL[m.stage] ?? m.stage}{m.groupLabel ? ` · Grup ${m.groupLabel}` : ""}{m.stage === "league" ? ` · Pekan ${m.round}` : ""}</span>
        <span className="shrink-0">{formatDate(m.scheduledAt, { day: "numeric", month: "short" })}</span>
      </div>
      {showMeta && (m.tournamentName || m.ageCode) && <div className="px-4 pt-2 text-[10px] font-semibold text-ink">{[m.tournamentName, m.ageCode].filter(Boolean).join(" · ")}</div>}
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-4 py-4 sm:grid-cols-[64px_minmax(0,1fr)_100px]">
        <div>
          <span className="font-display text-2xl italic tabular-nums">{formatTime(m.scheduledAt)}</span>
          <span className="mt-1 block text-[9px] font-semibold text-ink">WIB</span>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <Side name={m.homeName ?? m.homePlaceholder} short={m.homeShort} logo={m.homeLogo} dim={winner === "away"} bold={winner === "home"} />
          <div className="flex flex-col items-center">
            {done || live ? <span className="font-display text-2xl leading-none tabular-nums">{m.homeScore}<span className="mx-0.5 text-ink">–</span>{m.awayScore}</span> : <span className="font-display text-lg italic text-ink">VS</span>}
            {shootout && <span className="mt-1 text-[9px] font-semibold text-ink">{shootout}</span>}
            {live && <span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-ink"><Radio className="size-2 animate-live" />{m.duration ? <LiveCountdown status={m.status} currentMinute={m.currentMinute ?? 0} clockStartedAt={m.clockStartedAt ?? null} duration={m.duration} className="text-ink" /> : <>{m.currentMinute ?? 0}&rsquo;</>}</span>}
          </div>
          <Side name={m.awayName ?? m.awayPlaceholder} short={m.awayShort} logo={m.awayLogo} dim={winner === "home"} bold={winner === "away"} />
        </div>
        {showMeta && m.venue && <div className="hidden min-w-0 sm:block"><span className="mb-1 block text-[9px] text-ink">Stadion</span><span className="line-clamp-2 text-xs font-bold italic">{m.venue}</span></div>}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        {showMeta && m.venue ? <span className="flex min-w-0 items-center gap-1 text-[10px] font-medium text-ink sm:invisible"><MapPin className="size-3 shrink-0" /><span className="truncate">{m.venue}</span></span> : <span />}
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold", live ? "bg-brand text-white" : "bg-night text-white")}>{MATCH_STATUS[m.status]?.label ?? m.status}</span>
      </div>
    </Link>
  );
}

function Side({ name, short, logo, dim, bold }: { name?: string | null; short?: string | null; logo?: string | null; dim?: boolean; bold?: boolean }) {
  return <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
    <span className="rounded-full border border-ink/20 p-1"><ClubCrest logoUrl={logo} short={short} size={32} /></span>
    <span className={cn("line-clamp-2 min-w-0 text-[10px] leading-snug", dim ? "font-normal text-ink" : bold ? "font-bold" : "font-medium text-ink")}>{name ?? "TBD"}</span>
  </div>;
}
