"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Loader2,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { DURATION_PRESETS, MAX_MATCH_MINUTES, MIN_MATCH_MINUTES } from "@/lib/match-clock";
import { Countdown, useClockView } from "@/components/app/match-countdown";
import { cn } from "@/lib/utils";
import { ClubCrest } from "@/components/app/club-crest";
import {
  startMatch,
  pauseClock,
  resumeSecondHalf,
  endMatch,
} from "./actions";

const PERIOD_LABEL: Record<string, string> = {
  not_started: "Belum Dimulai",
  first_half: "Babak Pertama",
  halftime: "Jeda",
  second_half: "Babak Kedua",
  extra_time: "Perpanjangan Waktu",
  penalties: "Adu Penalti",
  full_time: "Selesai",
};

export function ConsoleControls({
  matchId,
  status,
  period,
  currentMinute,
  clockStartedAt,
  duration,
  homeShort,
  awayShort,
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  canOperate,
  canStart = true,
  startHint,
  meta,
}: {
  matchId: string;
  status: string;
  period: string;
  currentMinute: number;
  clockStartedAt: string | null;
  /** Match length in minutes (set at kick-off, else the age-category default). */
  duration: number;
  homeShort: string | null;
  awayShort: string | null;
  homeName: string | null;
  awayName: string | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore: number;
  awayScore: number;
  canOperate: boolean;
  /** Kick-off is allowed (referee and operator are assigned). */
  canStart?: boolean;
  /** Why kick-off is blocked, shown under the button. */
  startHint?: string;
  meta: React.ReactNode;
}) {
  const [pending, start] = React.useTransition();
  const view = useClockView({ status, currentMinute, clockStartedAt }, duration);
  const timeUp = status === "live" && view.expired;
  const [startOpen, setStartOpen] = React.useState(false);

  const run = (fn: (id: string) => Promise<void>, msg: string) =>
    start(async () => {
      try {
        await fn(matchId);
        toast.success(msg);
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-night p-5 text-white sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl"
      />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        <TeamCol name={homeName} short={homeShort} logo={homeLogo} align="right" />
        <div className="flex flex-col items-center">
          {status === "live" && (
            <span className="mb-2 flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-white">
              <Radio className="size-2.5 animate-live" /> LANGSUNG
            </span>
          )}
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="font-display text-6xl leading-none tabular-nums text-white sm:text-7xl">
              {homeScore}
            </span>
            <span className="font-display text-4xl leading-none text-night-muted sm:text-5xl">:</span>
            <span className="font-display text-6xl leading-none tabular-nums text-white sm:text-7xl">
              {awayScore}
            </span>
          </div>
          {status === "live" || status === "halftime" ? (
            <Countdown view={view} variant="hero" halftime={status === "halftime"} className="mt-2" />
          ) : (
            <span className="mt-2 rounded-full bg-night-2 px-3 py-1 text-xs font-semibold text-night-muted">
              {status === "completed" ? "Selesai" : PERIOD_LABEL[period]}
            </span>
          )}
        </div>
        <TeamCol name={awayName} short={awayShort} logo={awayLogo} align="left" />
      </div>

      {timeUp && (
        <p className="relative mt-4 rounded-2xl bg-brand/20 px-4 py-2.5 text-center text-xs font-semibold text-white">
          Waktu pertandingan habis{view.overtimeMin > 0 ? ` · tambahan waktu +${view.overtimeMin}'` : ""}.{" "}
          {canOperate
            ? "Pertandingan baru selesai setelah Anda menekan “Akhiri Pertandingan”."
            : "Menunggu operator mengakhiri pertandingan."}
        </p>
      )}

      <div className="relative mt-5">{meta}</div>

      {canOperate && status !== "completed" && (
        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-night-line pt-5">
          {status === "scheduled" && (
            <>
              <Button size="sm" disabled={pending || !canStart} onClick={() => setStartOpen(true)}>
                <Play className="size-3.5" />
                Mulai Pertandingan
              </Button>
              {!canStart && (
                <a
                  href="#penugasan"
                  className="basis-full text-center text-[11px] font-medium text-white/75 underline-offset-2 hover:text-white hover:underline"
                >
                  {startHint ?? "Tugaskan wasit dan operator terlebih dahulu"} ↓
                </a>
              )}
            </>
          )}
          {status === "live" && period === "first_half" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(pauseClock, "Turun minum")}>
              <Pause className="size-3.5" /> Akhiri Babak 1
            </Button>
          )}
          {(status === "halftime" || (status === "live" && period === "halftime")) && (
            <Button size="sm" disabled={pending} onClick={() => run(resumeSecondHalf, "Babak 2 dimulai")}>
              <SkipForward className="size-3.5" /> Mulai Babak 2
            </Button>
          )}
          {status === "live" && (
            <Button
              size="sm"
              variant={timeUp ? "primary" : "secondary"}
              className={timeUp ? undefined : "border-0 bg-night-2 text-white hover:bg-night-line"}
              disabled={pending}
              onClick={() => run(endMatch, "Peluit panjang")}
            >
              <Square className="size-3.5" /> Akhiri Pertandingan
            </Button>
          )}
        </div>
      )}

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent
          title="Mulai Pertandingan"
          description="Tentukan durasi pertandingan. Waktu berjalan otomatis dan dipakai saat mencatat kejadian."
          className="max-w-sm"
        >
          <StartForm
            initial={duration}
            pending={pending}
            onStart={(d) => {
              start(async () => {
                try {
                  await startMatch(matchId, d);
                  toast.success("Kick-off!", `Durasi ${d} menit`);
                  setStartOpen(false);
                } catch (e) {
                  toast.error("Gagal", e instanceof Error ? e.message : undefined);
                }
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StartForm({
  initial,
  pending,
  onStart,
}: {
  initial: number;
  pending: boolean;
  onStart: (duration: number) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const valid = Number.isInteger(value) && value >= MIN_MATCH_MINUTES && value <= MAX_MATCH_MINUTES;
  const presets = DURATION_PRESETS.includes(initial) ? DURATION_PRESETS : [...DURATION_PRESETS, initial].sort((a, b) => a - b);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onStart(value);
      }}
    >
      <div>
        <Label htmlFor="match-duration">Durasi pertandingan (menit)</Label>
        <div className="flex items-center gap-3">
          <input
            id="match-duration"
            type="number"
            inputMode="numeric"
            min={MIN_MATCH_MINUTES}
            max={MAX_MATCH_MINUTES}
            value={Number.isNaN(value) ? "" : value}
            onChange={(e) => setValue(e.target.value === "" ? NaN : Number(e.target.value))}
            className="h-14 w-28 rounded-2xl border border-line bg-surface text-center font-display text-3xl tabular-nums text-ink outline-none focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
          />
          <p className="text-xs leading-relaxed text-ink-muted">
            Dua babak @ {valid ? Math.ceil(value / 2) : "–"} menit.
            <br />
            Bawaan kategori usia: {initial} menit.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Durasi umum">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue(p)}
              aria-pressed={value === p}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                value === p ? "bg-night text-white" : "bg-surface-2 text-ink-secondary hover:bg-elevated",
              )}
            >
              {p}&rsquo;
            </button>
          ))}
        </div>
        {!valid && (
          <p className="mt-2 text-[11px] text-danger">
            Isi durasi antara {MIN_MATCH_MINUTES} dan {MAX_MATCH_MINUTES} menit.
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !valid}>
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        Kick-off
      </Button>
    </form>
  );
}

function TeamCol({
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
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5 text-center sm:flex-row sm:gap-3",
        align === "right" ? "sm:flex-row-reverse sm:text-right" : "sm:text-left",
      )}
    >
      <ClubCrest
        logoUrl={logo}
        short={short}
        size={56}
        className="text-sm ring-4 ring-white/10"
      />
      <span className="line-clamp-2 min-w-0 text-sm font-semibold text-white sm:text-base">{name}</span>
    </div>
  );
}
