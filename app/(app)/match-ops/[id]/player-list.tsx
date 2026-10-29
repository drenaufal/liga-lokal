"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronDown,
  Ellipsis,
  Flag,
  Users,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { MATCH_EVENT_STYLE } from "@/components/app/match-event-style";
import { ClubCrest } from "@/components/app/club-crest";
import { cn } from "@/lib/utils";
import { EVENT_LABEL } from "@/lib/status";
import { positionText } from "@/lib/positions";
import { useT } from "@/lib/i18n/client";
import { msg, type MessageId } from "@/lib/i18n/translate";
import type { QuickType } from "@/lib/quick-events";
import { emptyTally, type PlayerTally } from "@/lib/match-tally";
import { EventForm, type ClubMini, type MatchClock, type RosterPlayer } from "./event-entry";
import { quickEvent, undoEvent } from "./actions";

export type TeamSheet = {
  club: ClubMini;
  side: "home" | "away";
  players: RosterPlayer[];
};

export type { PlayerTally };

const GROUP_LABEL = { playing: msg("Di lapangan"), bench: msg("Cadangan"), off: msg("Sudah keluar") };

/** Show the tap immediately; the server's numbers replace it a moment later. */
function applyQuick(cur: Record<string, PlayerTally>, a: { playerId: string; type: QuickType }) {
  const tally = { ...(cur[a.playerId] ?? emptyTally()) };
  switch (a.type) {
    case "goal":
      tally.goals++;
      break;
    case "assist":
      tally.assists++;
      break;
    case "shot_on":
      tally.shotsOn++;
      break;
    case "shot_off":
      tally.shotsOff++;
      break;
    case "interception":
      tally.interceptions++;
      break;
    case "red_card":
      tally.red++;
      break;
    case "yellow_card":
      // a second yellow is a dismissal
      if (tally.yellow > 0) tally.red++;
      else tally.yellow++;
      break;
  }
  return { ...cur, [a.playerId]: tally };
}

type QuickButtonDef = {
  type: QuickType;
  label: MessageId;
  full: MessageId;
  icon: React.ComponentType<{ className?: string }>;
  tile: string;
  count: (tally: PlayerTally) => number;
};

/** Saves are derived from opposing shots and have no recording button. Labels are message ids. */
const QUICK: QuickButtonDef[] = [
  { type: "goal", label: msg("Gol"), full: msg("Gol"), ...MATCH_EVENT_STYLE.goal, count: (x) => x.goals },
  { type: "assist", label: msg("Assist"), full: msg("Assist"), ...MATCH_EVENT_STYLE.assist, count: (x) => x.assists },
  { type: "shot_on", label: msg("Tepat"), full: msg("Tembakan tepat sasaran"), ...MATCH_EVENT_STYLE.shot_on, count: (x) => x.shotsOn },
  { type: "interception", label: msg("Intersep::tombol"), full: msg("Intersep"), ...MATCH_EVENT_STYLE.interception, count: (x) => x.interceptions },
  { type: "shot_off", label: msg("Meleset"), full: msg("Tembakan meleset"), ...MATCH_EVENT_STYLE.shot_off, count: (x) => x.shotsOff },
  { type: "red_card", label: msg("Merah"), full: msg("Kartu merah"), ...MATCH_EVENT_STYLE.red_card, count: (x) => x.red },
  { type: "yellow_card", label: msg("Kuning"), full: msg("Kartu kuning"), ...MATCH_EVENT_STYLE.yellow_card, count: (x) => x.yellow },
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
  const t = useT();
  // undefined = closed · null = team-level event · object = a specific player
  const [target, setTarget] = React.useState<{ id: string; clubId: string } | null | undefined>(undefined);
  const [side, setSide] = React.useState<"home" | "away">("home");
  const [benchOpen, setBenchOpen] = React.useState(false);
  const [initialType, setInitialType] = React.useState<string | undefined>();
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
        toast.success(t("Kejadian dibatalkan"));
      } catch (e) {
        toast.error(t("Gagal membatalkan"), e instanceof Error ? e.message : undefined);
      }
    });

  const fire = (sheet: TeamSheet, p: RosterPlayer, def: QuickButtonDef) => {
    const key = `${p.id}:${def.type}`;
    if (inFlight.has(key)) return; // ignore a double tap on the same button
    setInFlight((s) => new Set(s).add(key));
    start(async () => {
      addOptimistic({ playerId: p.id, type: def.type });
      try {
        const r = await quickEvent({ matchId, clubId: sheet.club.id, playerId: p.id, type: def.type });
        const label = EVENT_LABEL[r.type] ? t.dyn(EVENT_LABEL[r.type]) : t(def.full);
        toast.success(
          t("{label} · menit {minute}'", { label, minute: r.minute }),
          `${p.number ? `#${p.number} ` : ""}${p.name} (${sheet.club.short})${r.linked ? ` · ${t("terhubung dengan gol/assist")}` : ""}`,
          { duration: 8000, action: { label: t("Batalkan"), onClick: () => undo(r.eventId) } },
        );
      } catch (e) {
        toast.error(t("Gagal mencatat"), e instanceof Error ? e.message : undefined);
      } finally {
        setInFlight((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    });
  };

  const groups = (["playing", "bench", "off"] as const)
    .map((role) => ({ role, players: team.players.filter((p) => p.state === role) }))
    .filter((g) => g.players.length);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> {t("Daftar Pemain")}
          </CardTitle>
          <CardDescription className="mt-1">
            {canQuick
              ? t("Pilih klub, lalu ketuk tombol di samping nama pemain — kejadian langsung masuk lini masa pada menit berjalan.")
              : canRecord
                ? t("Pertandingan tidak sedang berjalan. Gunakan “Catat kejadian” untuk menambah atau mengoreksi.")
                : hint}
          </CardDescription>
        </div>
        {canRecord && (
          <Button size="sm" variant="outline" onClick={() => { setInitialType(undefined); setTarget(null); }}>
            <Flag className="size-3.5" /> {t("Kejadian Tim")}
          </Button>
        )}
      </CardHeader>

      <CardContent className="@container space-y-3">
        {/* Club filter */}
        <div role="tablist" aria-label={t("Pilih klub")} className="grid grid-cols-2 gap-2">
          {[home, away].map((sheet) => {
            const active = side === sheet.side;
            return (
              <button
                key={sheet.club.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSide(sheet.side)}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                  active ? "border-night bg-night text-white" : "border-line bg-surface hover:border-ink/30",
                )}
              >
                <ClubCrest logoUrl={sheet.club.logo} short={sheet.club.short} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{sheet.club.name}</span>
                  <span className={cn("block text-[11px]", active ? "text-white/65" : "text-ink-muted")}>
                    {sheet.side === "home" ? t("Tuan rumah") : t("Tamu")} · {t("{n} pemain", { n: sheet.players.length })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {groups.length === 0 && (
          <div className="rounded-2xl bg-surface-2 px-3 py-10 text-center text-xs text-ink-muted">
            <p>{t("Belum ada pemain dipilih untuk {club} pada pertandingan ini.", { club: team.club.name })}</p>
            <p className="mt-2">{t("Pilih pemain di bagian “Pilih pemain pertandingan” sebelum kick-off.")}</p>
          </div>
        )}

        {groups.map((g) => {
          const collapsible = g.role === "bench";
          const open = !collapsible || benchOpen;
          const heading = `${t.dyn(GROUP_LABEL[g.role])} · ${g.players.length}`;
          return (
          <section key={g.role}>
            {collapsible ? (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setBenchOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
              >
                {heading}
                <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
              </button>
            ) : (
              <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{heading}</p>
            )}
            {open && <ul className="space-y-2">
              {g.players.map((p) => (
                <li key={p.id}>
                  <PlayerCard
                    p={p}
                    tally={shown[p.id]}
                    canQuick={canQuick}
                    canRecord={canRecord}
                    inFlight={inFlight}
                    onQuick={(def) => fire(team, p, def)}
                    onMore={() => { setInitialType(undefined); setTarget({ id: p.id, clubId: team.club.id }); }}
                    onSubstitute={() => { setInitialType("substitution"); setTarget({ id: p.id, clubId: team.club.id }); }}
                  />
                </li>
              ))}
            </ul>}
          </section>
          );
        })}
      </CardContent>

      <Dialog
        open={target !== undefined}
        onOpenChange={(v) => {
          if (!v) setTarget(undefined);
        }}
      >
        <DialogContent
          title={t("Catat Kejadian")}
          description={
            target === null
              ? t("Kejadian tim seperti tendangan sudut atau offside — atau pilih pemain secara manual.")
              : t("Untuk kejadian lain: pergantian, penalti, gol bunuh diri, pelanggaran — atau mengatur menit sendiri.")
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
              initialType={initialType}
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
  onSubstitute,
}: {
  p: RosterPlayer;
  tally?: PlayerTally;
  canQuick: boolean;
  canRecord: boolean;
  inFlight: ReadonlySet<string>;
  onQuick: (def: QuickButtonDef) => void;
  onMore: () => void;
  onSubstitute: () => void;
}) {
  const t = useT();
  const tl = tally ?? emptyTally();
  const sentOff = tl.red > 0;
  const inactive = sentOff || p.state !== "playing";

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
            <span className={cn("block truncate text-base font-semibold", p.state === "bench" ? "text-ink-muted" : "text-ink")}>
              {p.name}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
              <span>{positionText(p.position, t)}</span>
              {p.state === "bench" && <span>· {t("Cadangan")}</span>}
              {tl.saves > 0 && <span className="font-semibold text-success">· {t("{n} save", { n: tl.saves })}</span>}
              <Tags tally={tl} full={!canQuick} />
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
                  count={def.count(tl)}
                  disabled={inactive || inFlight.has(`${p.id}:${def.type}`)}
                  onClick={() => onQuick(def)}
                />
              ))}
            </div>
            <button type="button" disabled={inactive} onClick={onSubstitute} title={t("Pergantian")} aria-label={t("Ganti {name}", { name: p.name })} className="grid size-10 shrink-0 place-items-center rounded-full bg-block-pink text-ink disabled:opacity-40"><ArrowLeftRight className="size-4" /></button>
            <MoreButton name={p.name} onClick={onMore} disabled={inactive} />
          </div>
        ) : (
          canRecord && (
            <Button size="sm" variant="outline" disabled={inactive} onClick={onMore} className="self-start @4xl:self-center">
              <Ellipsis className="size-3.5" /> {t("Catat kejadian")}
            </Button>
          )
        )}
      </div>
      {sentOff && canQuick && (
        <p className="mt-2 text-[11px] font-medium text-brand">{t("Dikeluarkan dari lapangan — tombol dinonaktifkan.")}</p>
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
  const t = useT();
  const Icon = def.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t(def.full)}
      aria-label={`${t(def.full)} — ${name}${count ? ` (${count})` : ""}`}
      className={cn(
        "relative flex h-14 w-full select-none flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold leading-none outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40 @md:flex-1 @4xl:w-[3.5rem] @4xl:flex-none",
        def.tile,
      )}
    >
      <Icon className="size-[18px]" />
      {t(def.label)}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-night px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-surface-2">
          {count}
        </span>
      )}
    </button>
  );
}

function MoreButton({ name, onClick, disabled }: { name: string; onClick: () => void; disabled: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t("Kejadian lain (pergantian, penalti, gol bunuh diri, pelanggaran…)")}
      aria-label={t("Kejadian lain untuk {name}", { name })}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-secondary ring-1 ring-line transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40"
    >
      <Ellipsis className="size-4" />
    </button>
  );
}

/** Small status tags. While the one-tap buttons are shown they carry the counts, so only substitutions appear. */
function Tags({ tally, full }: { tally: PlayerTally; full: boolean }) {
  const t = useT();
  const items: React.ReactNode[] = [];
  if (full) {
    if (tally.goals)
      items.push(
        <Tag key="g" className="bg-brand text-white" title={t("{n} gol", { n: tally.goals })}>
          {tally.goals > 1 ? `${tally.goals} ` : ""}{t("Gol")}
        </Tag>,
      );
    if (tally.ownGoals)
      items.push(
        <Tag key="og" className="bg-night text-white" title={t("{n} gol bunuh diri", { n: tally.ownGoals })}>
          OG
        </Tag>,
      );
    if (tally.assists)
      items.push(
        <Tag key="a" className="bg-block-blue text-white" title={t("{n} assist", { n: tally.assists })}>
          {tally.assists > 1 ? `${tally.assists} ` : ""}A
        </Tag>,
      );
    for (let i = 0; i < tally.yellow; i++)
      items.push(
        <span key={`y${i}`} title={t("Kartu kuning")} className="h-3.5 w-2.5 rounded-[2px] bg-block-yellow ring-1 ring-black/10" />,
      );
    for (let i = 0; i < tally.red; i++)
      items.push(
        <span key={`r${i}`} title={t("Kartu merah")} className="h-3.5 w-2.5 rounded-[2px] bg-brand ring-1 ring-black/10" />,
      );
  } else if (tally.ownGoals) {
    items.push(
      <Tag key="og" className="bg-night text-white" title={t("{n} gol bunuh diri", { n: tally.ownGoals })}>
        OG
      </Tag>,
    );
  }
  if (tally.subOn != null)
    items.push(
      <Tag key="in" className="bg-success/12 text-success" title={t("Masuk menit {n}", { n: tally.subOn })}>
        <ArrowDownLeft className="size-3" />
        {tally.subOn}&rsquo;
      </Tag>,
    );
  if (tally.subOff != null)
    items.push(
      <Tag key="out" className="bg-danger/10 text-danger" title={t("Keluar menit {n}", { n: tally.subOff })}>
        <ArrowUpRight className="size-3" />
        {tally.subOff}&rsquo;
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
