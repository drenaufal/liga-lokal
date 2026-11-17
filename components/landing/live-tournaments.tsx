"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Ban, CalendarClock, Trophy, Users } from "lucide-react";
import { ClubCrest } from "@/components/app/club-crest";
import { DragMarquee } from "./drag-marquee";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  FRESH_EVENT_SECONDS,
  eventAgeSeconds,
  isGoalEvent,
  minuteLabel,
  type FeaturedTournament,
  type LiveEvent,
  type LiveFeed,
  type LiveMatch,
} from "@/lib/live-feed";

const POLL_MS = 5_000;
const TOAST_MS = 7_000;
const FLASH_MS = 6_000;
const BUMP_MS = 3_000;
const MAX_TOASTS = 3;

/** Deep fills, every one with white text at 5:1 contrast or better. Same set as the match folders. */
const PALETTE = [
  ["#2f46c5", "#21328d"],
  ["#6d28d9", "#4e1c9c"],
  ["#15803d", "#0f5c2b"],
  ["#0e7490", "#0a5367"],
] as const;

type Tone = "goal" | "yellow" | "red" | "neutral";
const TONE_BUBBLE: Record<Tone, string> = {
  goal: "bg-emerald-500/15",
  yellow: "bg-amber-400/25",
  red: "bg-red-500/15",
  neutral: "bg-blue-500/15",
};
const TONE_TEXT: Record<Tone, string> = {
  goal: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-red-600",
  neutral: "text-blue-600",
};

type Confetti = { dx: number; dy: number; rot: number; color: string; size: number; delay: number };
type Toast = { id: string; event: LiveEvent; confetti: Confetti[] };
type Flash = { event: LiveEvent };

const CONFETTI_COLORS = ["#ffd23f", "#ff6b2c", "#4361ee", "#22c55e", "#e4222d", "#a855f7"];
function makeConfetti(): Confetti[] {
  return Array.from({ length: 22 }, () => ({
    dx: (Math.random() - 0.5) * 230,
    dy: -30 - Math.random() * 110,
    rot: (Math.random() - 0.5) * 900,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 5 + Math.random() * 6,
    delay: Math.random() * 0.12,
  }));
}

/** A football, drawn small enough for a badge and sharp at any size. */
function Ball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#151515" strokeWidth="1.3" />
      <path d="M12 7.3l4.1 3-1.6 4.8h-5L7.9 10.3z" fill="#151515" />
      <path d="M12 7.3V1.6M16.1 10.3l5-1.7M14.5 15.1l3 4.4M9.5 15.1l-3 4.4M7.9 10.3L2.9 8.6" stroke="#151515" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CardGlyph({ color }: { color: string }) {
  return <span aria-hidden className="block h-8 w-6 rotate-6 rounded-[4px] shadow-md ring-1 ring-black/15" style={{ background: color }} />;
}

function EventGlyph({ type }: { type: LiveEvent["type"] }) {
  if (isGoalEvent(type)) return <Ball className="size-9" />;
  if (type === "yellow_card" || type === "second_yellow") return <CardGlyph color="#ffc93c" />;
  if (type === "red_card") return <CardGlyph color="#e4222d" />;
  if (type === "substitution") return <ArrowLeftRight className="size-7 text-blue-600" />;
  return <Ban className="size-7 text-red-600" />;
}

export function LiveTournaments({ items, initialFeed }: { items: FeaturedTournament[]; initialFeed: LiveFeed }) {
  const { t } = useI18n();
  const [feed, setFeed] = React.useState(initialFeed);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [flashes, setFlashes] = React.useState<Record<string, Flash>>({});
  const [bumps, setBumps] = React.useState<Record<string, number>>({});
  /** Events already known when the page opened, or already celebrated: never played twice. */
  const seen = React.useRef(new Set(initialFeed.events.map((e) => e.id)));
  const timers = React.useRef(new Set<number>());

  const later = React.useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  /** Plays the show for events that just happened: a notice, the tournament's card, the score. */
  const celebrate = React.useCallback(
    (events: LiveEvent[]) => {
      for (const event of events) {
        const toast: Toast = { id: event.id, event, confetti: isGoalEvent(event.type) ? makeConfetti() : [] };
        setToasts((cur) => [...cur.filter((x) => x.id !== toast.id), toast].slice(-MAX_TOASTS));
        later(TOAST_MS, () => setToasts((cur) => cur.filter((x) => x.id !== toast.id)));

        setFlashes((cur) => ({ ...cur, [event.competitionId]: { event } }));
        later(FLASH_MS, () =>
          setFlashes((cur) => {
            if (cur[event.competitionId]?.event.id !== event.id) return cur; // a newer one took over
            const rest = { ...cur };
            delete rest[event.competitionId];
            return rest;
          }),
        );

        if (isGoalEvent(event.type)) {
          setBumps((cur) => ({ ...cur, [event.matchId]: (cur[event.matchId] ?? 0) + 1 }));
          later(BUMP_MS, () =>
            setBumps((cur) => {
              const rest = { ...cur };
              delete rest[event.matchId];
              return rest;
            }),
          );
        }
      }
    },
    [later],
  );

  // Poll the public live feed; nothing is fetched while the tab is hidden.
  React.useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next: LiveFeed = await res.json();
        if (stopped) return;
        const fresh = next.events.filter((e) => !seen.current.has(e.id));
        for (const e of next.events) seen.current.add(e.id);
        setFeed(next);
        // oldest first, only what just happened (a tab left open for a while does not replay history)
        const now = fresh.filter((e) => eventAgeSeconds(e, next.serverTime) <= FRESH_EVENT_SECONDS).reverse().slice(-MAX_TOASTS);
        if (now.length) celebrate(now);
      } catch {
        /* offline or the server is busy: try again on the next beat */
      }
    };
    const interval = window.setInterval(poll, POLL_MS);
    const onVisible = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVisible);
    const pending = timers.current;
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      pending.forEach((id) => window.clearTimeout(id));
      pending.clear();
    };
  }, [celebrate]);

  return (
    <>
      <DragMarquee>
        {items.map((item, i) => (
          <TournamentCard
            key={item.id}
            item={item}
            palette={PALETTE[i % PALETTE.length]}
            matches={feed.matches.filter((m) => m.competitionId === item.id)}
            flash={flashes[item.id]}
            bumps={bumps}
          />
        ))}
      </DragMarquee>

      <div
        role="status"
        aria-live="polite"
        aria-label={t("Pembaruan pertandingan langsung")}
        className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(92vw,390px)] flex-col gap-2.5"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  );
}

/** Title and colour of an event, in the visitor's language. */
function useEventCopy() {
  const { t } = useI18n();
  return (type: LiveEvent["type"]): { title: string; tone: Tone } => {
    switch (type) {
      case "goal":
        return { title: t("GOL!"), tone: "goal" };
      case "penalty_goal":
        return { title: t("GOL PENALTI!"), tone: "goal" };
      case "own_goal":
        return { title: t("GOL BUNUH DIRI"), tone: "neutral" };
      case "penalty_missed":
        return { title: t("PENALTI GAGAL"), tone: "red" };
      case "yellow_card":
        return { title: t("KARTU KUNING"), tone: "yellow" };
      case "second_yellow":
        return { title: t("KUNING KEDUA"), tone: "red" };
      case "red_card":
        return { title: t("KARTU MERAH"), tone: "red" };
      default:
        return { title: t("PERGANTIAN"), tone: "neutral" };
    }
  };
}

function ToastCard({ toast }: { toast: Toast }) {
  const { t } = useI18n();
  const copy = useEventCopy();
  const e = toast.event;
  const { title, tone } = copy(e.type);
  const goal = isGoalEvent(e.type);
  const who = e.playerName ?? (goal ? t("Pencetak gol belum dicatat") : null);

  return (
    <Link
      href={`/kompetisi/${e.competitionId}`}
      className="animate-live-toast pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 pr-4 text-ink shadow-[0_24px_50px_-18px_rgba(0,0,0,0.6)] ring-1 ring-black/10"
    >
      <span className={cn("relative grid size-16 shrink-0 place-items-center rounded-full", TONE_BUBBLE[tone])}>
        <span className={cn("grid place-items-center", goal && "animate-live-ball")}>
          <EventGlyph type={e.type} />
        </span>
        {toast.confetti.map((c, i) => (
          <span
            key={i}
            aria-hidden
            className="live-confetti absolute left-1/2 top-1/2 rounded-[2px]"
            style={
              {
                width: c.size,
                height: c.size * 0.6,
                background: c.color,
                animationDelay: `${c.delay}s`,
                "--dx": `${c.dx}px`,
                "--dy": `${c.dy}px`,
                "--rot": `${c.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-headline text-[34px] uppercase leading-none", TONE_TEXT[tone])}>{title}</span>
        <span className="mt-1 block truncate text-sm font-bold">
          {[who, e.clubShort, minuteLabel(e)].filter(Boolean).join(" · ")}
        </span>
        <span className="block truncate text-xs font-semibold text-ink-secondary">
          {e.homeShort} {e.homeScore}–{e.awayScore} {e.awayShort} · {e.competitionName}
        </span>
      </span>
    </Link>
  );
}

function TournamentCard({
  item,
  palette,
  matches,
  flash,
  bumps,
}: {
  item: FeaturedTournament;
  palette: readonly [string, string];
  matches: LiveMatch[];
  flash?: Flash;
  bumps: Record<string, number>;
}) {
  const { t, fmt } = useI18n();
  const copy = useEventCopy();
  const isLive = matches.length > 0;
  const state = isLive ? "live" : item.state === "soon" ? "soon" : "running";
  const shown = matches.slice(0, 2);
  const progress = item.total > 0 ? Math.round((item.played / item.total) * 100) : 0;

  return (
    <div className="relative">
      {flash && <span key={flash.event.id} aria-hidden className="animate-live-glow pointer-events-none absolute inset-0 rounded-[2rem]" />}
      <Link
        href={`/kompetisi/${item.id}`}
        aria-label={`${t("Buka halaman turnamen")}: ${item.name}`}
        className="group relative flex h-[350px] w-[286px] flex-col overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_26px_50px_-24px_rgba(20,20,60,0.7)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:w-[330px]"
        style={{ background: `linear-gradient(155deg, ${palette[0]} 0%, ${palette[1]} 100%)` }}
      >
        <Trophy aria-hidden className="pointer-events-none absolute -bottom-8 -right-6 size-48 text-white/[0.08]" />

        <div className="relative flex items-center justify-between gap-3">
          {state === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand">
              <span className="animate-live size-2 rounded-full bg-brand" />
              {t("LANGSUNG")} · {t("{n} laga", { n: matches.length })}
            </span>
          ) : state === "running" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide">
              {t("Berlangsung")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-block-yellow px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink">
              <CalendarClock className="size-3.5" />
              {t("Segera hadir")}
            </span>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">{item.season}</span>
        </div>

        <h3 className="relative mt-4 line-clamp-3 font-headline text-[40px] uppercase leading-[0.92]">{item.name}</h3>
        {item.organizer && <p className="relative mt-1.5 line-clamp-1 text-xs font-medium text-white/85">{item.organizer}</p>}

        {item.kus.length > 0 && (
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {item.kus.slice(0, 4).map((ku) => (
              <span key={ku} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                {ku}
              </span>
            ))}
            {item.kus.length > 4 && <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">+{item.kus.length - 4}</span>}
          </div>
        )}

        <div className="relative mt-auto">
          {state === "live" ? (
            <ul className="space-y-1.5">
              {shown.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 text-xs font-bold">
                  <ClubCrest logoUrl={m.homeLogo} short={m.homeShort} size={26} />
                  <span className="min-w-0 flex-1 truncate">{m.homeShort}</span>
                  <span
                    key={`${m.homeScore}-${m.awayScore}-${bumps[m.id] ?? 0}`}
                    className={cn("shrink-0 font-display text-lg tabular-nums leading-none", bumps[m.id] && "animate-live-score")}
                  >
                    {m.homeScore}–{m.awayScore}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right">{m.awayShort}</span>
                  <ClubCrest logoUrl={m.awayLogo} short={m.awayShort} size={26} />
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-white/80">{m.status === "halftime" ? "HT" : `${m.minute}′`}</span>
                </li>
              ))}
              {matches.length > shown.length && <li className="px-1 text-[11px] font-semibold text-white/80">+{matches.length - shown.length}</li>}
            </ul>
          ) : state === "running" ? (
            <div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{t("{played}/{total} laga selesai", { played: item.played, total: item.total })}</span>
                <span className="inline-flex items-center gap-1 text-white/85">
                  <Users className="size-3.5" />
                  {t("{n} SSB", { n: item.clubs })}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
                <div className="h-full rounded-full bg-block-yellow" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                {item.startDate ? t("Mulai {date}", { date: fmt.date(item.startDate, { day: "numeric", month: "short", year: "numeric" }) }) : t("Jadwal segera diumumkan")}
              </span>
              <span className="inline-flex items-center gap-1 text-white/85">
                <Users className="size-3.5" />
                {t("{n} SSB", { n: item.clubs })}
              </span>
            </div>
          )}

          <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide">
            {t("Lihat turnamen")}
            <span className="grid size-7 place-items-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-1">
              <ArrowRight className="size-3.5" />
            </span>
          </span>
        </div>

        {flash && <EventBurst key={flash.event.id} event={flash.event} copy={copy} />}
      </Link>
    </div>
  );
}

/** The notice that pops up on the card of the tournament where something just happened. */
function EventBurst({ event, copy }: { event: LiveEvent; copy: ReturnType<typeof useEventCopy> }) {
  const { title, tone } = copy(event.type);
  const goal = isGoalEvent(event.type);
  return (
    <div className="animate-live-burst absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-2xl bg-white p-3 text-ink shadow-[0_18px_40px_-14px_rgba(0,0,0,0.65)]">
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", TONE_BUBBLE[tone])}>
        <span className={cn("grid place-items-center", goal && "animate-live-ball")}>
          <EventGlyph type={event.type} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-headline text-3xl uppercase leading-none", TONE_TEXT[tone])}>{title}</span>
        <span className="mt-0.5 block truncate text-xs font-bold">{[event.playerName, event.clubShort, minuteLabel(event)].filter(Boolean).join(" · ")}</span>
        <span className="block truncate text-[11px] font-semibold text-ink-secondary">
          {event.homeShort} {event.homeScore}–{event.awayScore} {event.awayShort}
        </span>
      </span>
    </div>
  );
}
