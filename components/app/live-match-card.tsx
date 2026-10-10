import Link from "next/link";
import { Radio, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClubCrest } from "./club-crest";
import { LiveCountdown } from "./match-countdown";

export type LiveMatch = {
  id: string;
  minute: number | null;
  status?: string;
  clockStartedAt?: Date | string | null;
  /** Match length in minutes, for the countdown. */
  duration?: number;
  homeScore: number;
  awayScore: number;
  period: string;
  home: string | null;
  homeShort: string | null;
  homeLogo?: string | null;
  away: string | null;
  awayShort: string | null;
  awayLogo?: string | null;
  tournament: string;
  venue?: string | null;
};

const PERIOD_LABEL: Record<string, string> = {
  first_half: "Babak 1",
  halftime: "Jeda",
  second_half: "Babak 2",
  extra_time: "Perpanjangan Waktu",
  penalties: "Adu Penalti",
};

export function LiveMatchCard({ m, compact }: { m: LiveMatch; compact?: boolean }) {
  return (
    <Link
      href={`/match-ops/${m.id}`}
      className="group block rounded-2xl bg-night p-4 text-white transition-transform hover:-translate-y-0.5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-white">
          <Radio className="size-3 animate-live" />
          LANGSUNG
          {m.duration ? (
            <>
              {" · "}
              <LiveCountdown
                status={m.status ?? "live"}
                currentMinute={m.minute ?? 0}
                clockStartedAt={m.clockStartedAt ?? null}
                duration={m.duration}
                className="text-white [&>span]:text-white"
              />
            </>
          ) : (
            <> · {m.minute}&rsquo;</>
          )}
        </span>
        <span className="truncate text-[11px] text-night-muted">{m.tournament}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
        <TeamSide name={m.home} short={m.homeShort} logo={m.homeLogo} align="left" />
        <div className="flex flex-col items-center pt-1">
          <span className="font-display text-4xl leading-none tracking-wide tabular-nums text-white">
            {m.homeScore}<span className="mx-1.5 text-night-muted">:</span>{m.awayScore}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-night-muted">
            {PERIOD_LABEL[m.period] ?? "Berlangsung"}
          </span>
        </div>
        <TeamSide name={m.away} short={m.awayShort} logo={m.awayLogo} align="right" />
      </div>

      {!compact && m.venue && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-night-line pt-2.5 text-[11px] text-night-muted">
          <MapPin className="size-3" />
          {m.venue}
        </div>
      )}
    </Link>
  );
}

function TeamSide({
  name,
  short,
  logo,
  align,
}: {
  name: string | null;
  short: string | null;
  logo?: string | null;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-2 text-center", align === "right" && "order-last")}>
      <ClubCrest logoUrl={logo} short={short} size={44} />
      <span className="line-clamp-2 text-xs font-semibold leading-snug text-white">{name}</span>
    </div>
  );
}
