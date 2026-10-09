"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ellipsis,
  Flag,
  Goal,
  Hand,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { ClubCrest } from "@/components/app/club-crest";
import { cn } from "@/lib/utils";
import { EVENT_LABEL, POSITION } from "@/lib/status";
import type { QuickType } from "@/lib/quick-events";
import { emptyTally, type PlayerTally } from "@/lib/match-tally";
import { EventForm, type ClubMini, type MatchClock, type RosterPlayer } from "./event-entry";
import { quickEvent, undoEvent } from "./actions";

export type TeamSheet = {
  club: ClubMini;
  formation: string | null;
  side: "home" | "away";
  players: RosterPlayer[];
};

export type { PlayerTally };

const GROUP_LABEL: Record<RosterPlayer["role"], string> = {
  starter: "Starter",
  substitute: "Cadangan",
  squad: "Skuad terdaftar",
};

/** Show the tap immediately; the server's numbers replace it a moment later. */
function applyQuick(cur: Record<string, PlayerTally>, a: { playerId: string; type: QuickType }) {
  const t = { ...(cur[a.playerId] ?? emptyTally()) };
  switch (a.type) {
    case "goal":
      t.goals++;
      break;
    case "assist":
      t.assists++;
      break;
    case "shot_on":
      t.shotsOn++;
      break;
    case "shot_off":
      t.shotsOff++;
      break;
    case "save":
      t.saves++;
      break;
    case "interception":
      t.interceptions++;
      break;
    case "red_card":
      t.red++;
      break;
    case "yellow_card":
      // a second yellow is a dismissal
      if (t.yellow > 0) t.red++;
      else t.yellow++;
      break;
  }
  return { ...cur, [a.playerId]: t };
}

/** A booking card glyph — lucide has no football card. */
function CardGlyph({ color }: { color: string }) {
  return <span className="inline-block h-[17px] w-[12px] rotate-6 rounded-[2px] ring-1 ring-black/10" style={{ background: color }} />;
}
const YellowCard = () => <CardGlyph color="#ffc93c" />;
const RedCard = () => <CardGlyph color="#e4222d" />;

type QuickButtonDef = {
  type: QuickType;
  label: string;
  full: string;
  icon: React.ComponentType<{ className?: string }>;
  tile: string;
  count: (t: PlayerTally) => number;
};

/** Order as requested: Goal, Assist, Shot on goal, Saves, Intercept, Shot off target, Red card, Yellow card. */
const QUICK: QuickButtonDef[] = [
  { type: "goal", label: "Gol", full: "Gol", icon: Goal, tile: "bg-brand text-white hover:bg-brand-dark", count: (t) => t.goals },
  { type: "assist", label: "Assist", full: "Assist", icon: Sparkles, tile: "bg-block-blue text-white hover:brightness-95", count: (t) => t.assists },
  { type: "shot_on", label: "Tepat", full: "Tembakan tepat sasaran", icon: Target, tile: "bg-block-mint text-ink hover:brightness-95", count: (t) => t.shotsOn },
  { type: "save", label: "Save", full: "Penyelamatan", icon: Hand, tile: "bg-block-lavender text-ink hover:brightness-95", count: (t) => t.saves },
  { type: "interception", label: "Intersep", full: "Intersep", icon: ShieldCheck, tile: "bg-block-pink text-ink hover:brightness-95", count: (t) => t.interceptions },
  { type: "shot_off", label: "Meleset", full: "Tembakan meleset", icon: ArrowUpRight, tile: "bg-block-orange text-ink hover:brightness-95", count: (t) => t.shotsOff },
  { type: "red_card", label: "Merah", full: "Kartu merah", icon: RedCard, tile: "bg-surface text-ink ring-1 ring-line hover:bg-elevated", count: (t) => t.red },
  { type: "yellow_card", label: "Kuning", full: "Kartu kuning", icon: YellowCard, tile: "bg-surface text-ink ring-1 ring-line hover:bg-elevated", count: (t) => t.yellow },
];

export function PlayerList({
  matchId,
  clock,
  home,
  away,
  tallies,
  canRecord,
  canQuick,
  hint,
}: {
  matchId: string;
  clock: MatchClock;
  home: TeamSheet;
  away: TeamSheet;
  tallies: Record<string, PlayerTally>;
  /** May open the full "Catat Kejadian" form (role allows it and the match has kicked off). */
  canRecord: boolean;
  /** May use the one-tap buttons: the match is in play. */
  canQuick: boolean;
  /** Shown instead of the usage hint when recording is unavailable. */
  hint?: string;
}) {
  // undefined = closed · null = team-level event · object = a specific player
  const [target, setTarget] = React.useState<{ id: string; clubId: string } | null | undefined>(undefined);
  const [side, setSide] = React.useState<"home" | "away">("home");
  const [, start] = React.useTransition();
  const [inFlight, setInFlight] = React.useState<ReadonlySet<string>>(new Set());
  const [shown, addOptimistic] = React.useOptimistic(tallies, applyQuick);

  const rosters = React.useMemo(
    () => ({ [home.club.id]: home.players, [away.club.id]: away.players }),
    [home, away],
  );
  const team = side === "home" ? home : away;

  const undo = (eventId: string) =>
    start(async () => {
      try {
        await undoEvent({ matchId, eventId });
        toast.success("Kejadian dibatalkan");
      } catch (e) {
        toast.error("Gagal membatalkan", e instanceof Error ? e.message : undefined);
      }
    });

  const fire = (t: TeamSheet, p: RosterPlayer, def: QuickButtonDef) => {
    const key = `${p.id}:${def.type}`;
    if (inFlight.has(key)) return; // ignore a double tap on the same button
    setInFlight((s) => new Set(s).add(key));
    start(async () => {
      addOptimistic({ playerId: p.id, type: def.type });
      try {
        const r = await quickEvent({ matchId, clubId: t.club.id, playerId: p.id, type: def.type });
        const label = EVENT_LABEL[r.type] ?? def.full;
        toast.success(
          `${label} · menit ${r.minute}'`,
          `${p.number ? `#${p.number} ` : ""}${p.name} (${t.club.short})${r.linked ? " · terhubung dengan gol/assist" : ""}`,
          { duration: 8000, action: { label: "Batalkan", onClick: () => undo(r.eventId) } },
        );
      } catch (e) {
        toast.error("Gagal mencatat", e instanceof Error ? e.message : undefined);
      } finally {
        setInFlight((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    });
  };

  const groups = (["starter", "substitute", "squad"] as const)
    .map((role) => ({ role, players: team.players.filter((p) => p.role === role) }))
    .filter((g) => g.players.length);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> Daftar Pemain
          </CardTitle>
          <CardDescription className="mt-1">
            {canQuick
              ? "Pilih klub, lalu ketuk tombol di samping nama pemain — kejadian langsung masuk lini masa pada menit berjalan."
              : canRecord
                ? "Pertandingan tidak sedang berjalan. Gunakan “Catat kejadian” untuk menambah atau mengoreksi."
                : hint}
          </CardDescription>
        </div>
        {canRecord && (
          <Button size="sm" variant="outline" onClick={() => setTarget(null)}>
            <Flag className="size-3.5" /> Kejadian Tim
          </Button>
        )}
      </CardHeader>

      <CardContent className="@container space-y-3">
        {/* Club filter */}
        <div role="tablist" aria-label="Pilih klub" className="grid grid-cols-2 gap-2">
          {[home, away].map((t) => {
            const active = side === t.side;
            return (
              <button
                key={t.club.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSide(t.side)}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                  active ? "border-night bg-night text-white" : "border-line bg-surface hover:border-ink/30",
                )}
              >
                <ClubCrest logoUrl={t.club.logo} short={t.club.short} color={t.club.color} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.club.name}</span>
                  <span className={cn("block text-[11px]", active ? "text-white/65" : "text-ink-muted")}>
                    {t.side === "home" ? "Tuan rumah" : "Tamu"}
                    {t.formation ? ` · ${t.formation}` : ""} · {t.players.length} pemain
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {groups.length === 0 && (
          <p className="rounded-2xl bg-surface-2 px-3 py-10 text-center text-xs text-ink-muted">
            Belum ada pemain terdaftar untuk {team.club.name}.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.role}>
            <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {GROUP_LABEL[g.role]} · {g.players.length}
            </p>
            <ul className="space-y-2">
              {g.players.map((p) => (
                <li key={p.id}>
                  <PlayerCard
                    p={p}
                    tally={shown[p.id]}
                    canQuick={canQuick}
                    canRecord={canRecord}
                    inFlight={inFlight}
                    onQuick={(def) => fire(team, p, def)}
                    onMore={() => setTarget({ id: p.id, clubId: team.club.id })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>

      <Dialog
        open={target !== undefined}
        onOpenChange={(v) => {
          if (!v) setTarget(undefined);
        }}
      >
        <DialogContent
          title="Catat Kejadian"
          description={
            target === null
              ? "Kejadian tim seperti tendangan sudut atau offside — atau pilih pemain secara manual."
              : "Untuk kejadian lain: pergantian, penalti, gol bunuh diri, pelanggaran — atau mengatur menit sendiri."
          }
          className="max-w-md"
        >
          {target !== undefined && (
            <EventForm
              matchId={matchId}
              clock={clock}
              homeClub={home.club}
              awayClub={away.club}
              rosters={rosters}
              player={target}
              onDone={() => setTarget(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PlayerCard({
  p,
  tally,
  canQuick,
  canRecord,
  inFlight,
  onQuick,
  onMore,
}: {
  p: RosterPlayer;
  tally?: PlayerTally;
  canQuick: boolean;
  canRecord: boolean;
  inFlight: ReadonlySet<string>;
  onQuick: (def: QuickButtonDef) => void;
  onMore: () => void;
}) {
  const t = tally ?? emptyTally();
  const sentOff = t.red > 0;

  return (
    <div className={cn("rounded-2xl bg-surface-2/70 p-3", sentOff && "bg-brand/5 ring-1 ring-brand/20")}>
      <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-night font-display text-xl leading-none text-white">
            {p.number ?? "–"}
            {p.captain && (
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-brand text-[8px] font-bold text-white">
                C
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-ink">{p.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
              <span>{POSITION[p.position]?.label ?? p.position}</span>
              {p.role === "substitute" && <span>· Cadangan</span>}
              <Tags t={t} full={!canQuick} />
            </span>
          </span>
        </div>

        {canQuick ? (
          <div className="flex items-center gap-1.5">
            <div className="grid flex-1 grid-cols-4 gap-1.5 @md:flex @4xl:flex-none @4xl:gap-1">
              {QUICK.map((def) => (
                <QuickButton
                  key={def.type}
                  def={def}
                  name={p.name}
                  count={def.count(t)}
                  disabled={sentOff || inFlight.has(`${p.id}:${def.type}`)}
                  onClick={() => onQuick(def)}
                />
              ))}
            </div>
            <MoreButton name={p.name} onClick={onMore} />
          </div>
        ) : (
          canRecord && (
            <Button size="sm" variant="outline" onClick={onMore} className="self-start @4xl:self-center">
              <Ellipsis className="size-3.5" /> Catat kejadian
            </Button>
          )
        )}
      </div>
      {sentOff && canQuick && (
        <p className="mt-2 text-[11px] font-medium text-brand">Dikeluarkan dari lapangan — tombol dinonaktifkan.</p>
      )}
    </div>
  );
}

function QuickButton({
  def,
  name,
  count,
  disabled,
  onClick,
}: {
  def: QuickButtonDef;
  name: string;
  count: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = def.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={def.full}
      aria-label={`${def.full} — ${name}${count ? ` (${count})` : ""}`}
      className={cn(
        "relative flex h-14 w-full select-none flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold leading-none outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40 @md:flex-1 @4xl:w-[3.5rem] @4xl:flex-none",
        def.tile,
      )}
    >
      <Icon className="size-[18px]" />
      {def.label}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-night px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-surface-2">
          {count}
        </span>
      )}
    </button>
  );
}

function MoreButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Kejadian lain (pergantian, penalti, gol bunuh diri, pelanggaran…)"
      aria-label={`Kejadian lain untuk ${name}`}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-secondary ring-1 ring-line transition-colors hover:bg-elevated hover:text-ink"
    >
      <Ellipsis className="size-4" />
    </button>
  );
}

/** Small status tags. While the one-tap buttons are shown they carry the counts, so only substitutions appear. */
function Tags({ t, full }: { t: PlayerTally; full: boolean }) {
  const items: React.ReactNode[] = [];
  if (full) {
    if (t.goals)
      items.push(
        <Tag key="g" className="bg-brand text-white" title={`${t.goals} gol`}>
          {t.goals > 1 ? `${t.goals} ` : ""}Gol
        </Tag>,
      );
    if (t.ownGoals)
      items.push(
        <Tag key="og" className="bg-night text-white" title={`${t.ownGoals} gol bunuh diri`}>
          OG
        </Tag>,
      );
    if (t.assists)
      items.push(
        <Tag key="a" className="bg-block-blue text-white" title={`${t.assists} assist`}>
          {t.assists > 1 ? `${t.assists} ` : ""}A
        </Tag>,
      );
    for (let i = 0; i < t.yellow; i++)
      items.push(
        <span key={`y${i}`} title="Kartu kuning" className="h-3.5 w-2.5 rounded-[2px] bg-block-yellow ring-1 ring-black/10" />,
      );
    for (let i = 0; i < t.red; i++)
      items.push(
        <span key={`r${i}`} title="Kartu merah" className="h-3.5 w-2.5 rounded-[2px] bg-brand ring-1 ring-black/10" />,
      );
  } else if (t.ownGoals) {
    items.push(
      <Tag key="og" className="bg-night text-white" title={`${t.ownGoals} gol bunuh diri`}>
        OG
      </Tag>,
    );
  }
  if (t.subOn != null)
    items.push(
      <Tag key="in" className="bg-success/12 text-success" title={`Masuk menit ${t.subOn}`}>
        <ArrowDownLeft className="size-3" />
        {t.subOn}&rsquo;
      </Tag>,
    );
  if (t.subOff != null)
    items.push(
      <Tag key="out" className="bg-danger/10 text-danger" title={`Keluar menit ${t.subOff}`}>
        <ArrowUpRight className="size-3" />
        {t.subOff}&rsquo;
      </Tag>,
    );
  if (!items.length) return null;
  return <span className="flex flex-wrap items-center gap-1">{items}</span>;
}

function Tag({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums",
        className,
      )}
    >
      {children}
    </span>
  );
}
