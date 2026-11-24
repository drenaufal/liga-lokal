"use client";

import * as React from "react";
import { Timer } from "lucide-react";
import { clockView, formatClock, type ClockState, type ClockView } from "@/lib/match-clock";
import { cn } from "@/lib/utils";

/**
 * Live view of a match clock that counts UP per half. In half 1 it runs from 00:00
 * to halfDuration (e.g. 20:00). In half 2 it runs from halfDuration (e.g. 20:00)
 * to fullDuration (e.g. 40:00). When the half's time is reached, the display stops
 * at the limit and stays live until an operator ends the half.
 */
export function useClockView(
  clock: { status: string; currentMinute: number; clockStartedAt: Date | string | null; period?: string | null },
  duration: number,
): ClockView {
  const state: ClockState = clock;
  const [now, setNow] = React.useState(() => Date.now());
  const running = state.status === "live" && !!state.clockStartedAt;

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  return clockView(state, duration, now);
}

type Variant = "hero" | "inline";

/** Presentational match clock timer. */
export function Countdown({
  view,
  variant = "inline",
  halftime,
  className,
}: {
  view: ClockView;
  variant?: Variant;
  /** Clock is stopped for the break — show it frozen, not ticking. */
  halftime?: boolean;
  className?: string;
}) {
  const time = formatClock(view.displaySec);
  const isSecondHalf = view.period === "second_half";
  const label = halftime
    ? "Jeda"
    : view.expired
      ? isSecondHalf
        ? "Waktu pertandingan habis"
        : "Waktu babak 1 habis"
      : isSecondHalf
        ? "Babak 2"
        : "Babak 1";

  if (variant === "hero") {
    return (
      <div className="flex flex-col items-center">
        <span
          suppressHydrationWarning
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-2xl leading-none tabular-nums",
            view.expired ? "bg-brand text-white" : "bg-white text-ink",
          )}
        >
          <Timer className={cn("size-4", view.running && !view.expired && "animate-live")} aria-hidden />
          {time}
        </span>
        <span className={cn("mt-1.5 text-[11px] font-semibold", view.expired ? "text-white" : "text-night-muted")}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <span
      suppressHydrationWarning
      title={`${label} · ${time}`}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums",
        view.expired ? "text-danger" : "text-brand",
        className,
      )}
    >
      <Timer className={cn("size-3", view.running && !view.expired && "animate-live")} aria-hidden />
      {time}
    </span>
  );
}

/** Self-ticking inline timer for lists and cards. */
export function LiveCountdown({
  status,
  currentMinute,
  clockStartedAt,
  duration,
  period,
  className,
}: {
  status: string;
  currentMinute: number;
  clockStartedAt: Date | string | null;
  duration: number;
  period?: string | null;
  className?: string;
}) {
  const view = useClockView({ status, currentMinute, clockStartedAt, period }, duration);
  return <Countdown view={view} className={className} />;
}
