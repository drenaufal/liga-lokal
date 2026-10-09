"use client";

import * as React from "react";
import { Timer } from "lucide-react";
import { clockView, formatCountdown, type ClockState, type ClockView } from "@/lib/match-clock";
import { cn } from "@/lib/utils";

/**
 * Live view of a match clock that counts DOWN from the match length. When it
 * reaches 00:00 it stays there and counts stoppage (+N') — the match itself is
 * only finished when an operator ends it.
 */
export function useClockView(
  clock: { status: string; currentMinute: number; clockStartedAt: Date | string | null },
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

/** Presentational countdown. */
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
  const time = formatCountdown(view.remainingSec);
  const label = view.expired ? "Waktu habis" : halftime ? "Jeda" : "Sisa waktu";

  if (variant === "hero") {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <span
          suppressHydrationWarning
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-2xl leading-none tabular-nums",
            view.expired ? "bg-brand text-white" : "bg-white text-ink",
          )}
        >
          <Timer className={cn("size-4", view.running && !view.expired && "animate-live")} aria-hidden />
          {time}
          {view.expired && view.overtimeMin > 0 && <span className="text-base">+{view.overtimeMin}&rsquo;</span>}
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
      title={`${label} · berjalan ${Math.floor(view.elapsedSec / 60)}'`}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums",
        view.expired ? "text-danger" : "text-brand",
        className,
      )}
    >
      <Timer className={cn("size-3", view.running && !view.expired && "animate-live")} aria-hidden />
      {time}
      {view.expired && view.overtimeMin > 0 && <span>+{view.overtimeMin}&rsquo;</span>}
    </span>
  );
}

/** Self-ticking inline countdown for lists and cards. */
export function LiveCountdown({
  status,
  currentMinute,
  clockStartedAt,
  duration,
  className,
}: {
  status: string;
  currentMinute: number;
  clockStartedAt: Date | string | null;
  duration: number;
  className?: string;
}) {
  const view = useClockView({ status, currentMinute, clockStartedAt }, duration);
  return <Countdown view={view} className={className} />;
}
