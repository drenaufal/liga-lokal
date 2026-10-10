"use client";

import * as React from "react";
import {
  Goal,
  Hand,
  ShieldAlert,
  Flag,
  ArrowLeftRight,
  Crosshair,
  CircleSlash,
  ShieldCheck,
  Loader2,
  Plus,
  Minus,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ClubCrest } from "@/components/app/club-crest";
import { cn } from "@/lib/utils";
import { POSITION } from "@/lib/status";
import { elapsedMinute } from "@/lib/match-clock";
import { addEvent } from "./actions";

export type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  number: number | null;
  role: "starter" | "substitute" | "squad";
  captain?: boolean;
};
export type ClubMini = {
  id: string;
  short: string;
  name: string;
  logo?: string | null;
};

/** Running clock of the match, so the form can default to "now". */
export type MatchClock = {
  status: string;
  currentMinute: number;
  clockStartedAt: string | null;
  cap: number;
};

type EventType = {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Fill used when the tile is selected; its text colour clears 4.5:1 on it. */
  fill: string;
  needsPlayer?: boolean;
  related?: "assist" | "sub_in";
};

/** A booking card glyph — lucide has no football card. */
function CardGlyph({ className, color }: { className?: string; color: string }) {
  return (
    <span
      className={cn("inline-block h-[15px] w-[11px] rotate-6 rounded-[2px] ring-1 ring-black/10", className)}
      style={{ background: color }}
    />
  );
}
const YellowCard = ({ className }: { className?: string }) => (
  <CardGlyph className={className} color="#ffc93c" />
);
const RedCard = ({ className }: { className?: string }) => (
  <CardGlyph className={className} color="#e4222d" />
);

const EVENT_TYPES: EventType[] = [
  { type: "goal", label: "Gol", icon: Goal, fill: "bg-brand text-white", needsPlayer: true, related: "assist" },
  { type: "penalty_goal", label: "Gol Penalti", icon: Goal, fill: "bg-brand text-white", needsPlayer: true },
  { type: "own_goal", label: "Gol Bunuh Diri", icon: CircleSlash, fill: "bg-night text-white", needsPlayer: true },
  { type: "shot_on", label: "Tembakan Tepat", icon: Crosshair, fill: "bg-block-blue text-white", needsPlayer: true },
  { type: "shot_off", label: "Tembakan Meleset", icon: Crosshair, fill: "bg-block-lavender text-ink", needsPlayer: true },
  { type: "save", label: "Penyelamatan", icon: Hand, fill: "bg-block-mint text-ink", needsPlayer: true },
  { type: "interception", label: "Intersep", icon: ShieldCheck, fill: "bg-block-lavender text-ink", needsPlayer: true },
  { type: "yellow_card", label: "Kartu Kuning", icon: YellowCard, fill: "bg-block-yellow text-ink", needsPlayer: true },
  { type: "red_card", label: "Kartu Merah", icon: RedCard, fill: "bg-night text-white", needsPlayer: true },
  { type: "foul", label: "Pelanggaran", icon: ShieldAlert, fill: "bg-block-orange text-ink", needsPlayer: true },
  { type: "substitution", label: "Pergantian", icon: ArrowLeftRight, fill: "bg-block-pink text-ink", needsPlayer: true, related: "sub_in" },
  { type: "corner", label: "Tendangan Sudut", icon: Flag, fill: "bg-night text-white" },
  { type: "offside", label: "Offside", icon: Flag, fill: "bg-night text-white" },
];

const PLAYER_TYPES = EVENT_TYPES.filter((e) => e.needsPlayer);

/**
 * "Catat Kejadian" form. With `player` set it records an event for that
 * player (opened from the squad list); without it, it is the team-level
 * entry with a club toggle and an optional player picker.
 */
export function EventForm({
  matchId,
  clock,
  homeClub,
  awayClub,
  rosters,
  player,
  onDone,
}: {
  matchId: string;
  clock: MatchClock;
  homeClub: ClubMini;
  awayClub: ClubMini;
  rosters: Record<string, RosterPlayer[]>;
  player?: { id: string; clubId: string } | null;
  onDone?: () => void;
}) {
  const locked = !!player;
  const types = locked ? PLAYER_TYPES : EVENT_TYPES;
  const [pending, start] = React.useTransition();
  const [type, setType] = React.useState<string>(locked ? "goal" : "corner");
  const [clubId, setClubId] = React.useState(player?.clubId ?? homeClub.id);
  const [playerId, setPlayerId] = React.useState(player?.id ?? "");
  const [relatedId, setRelatedId] = React.useState("");
  // The minute follows the match clock until the operator edits it.
  const nowMinute = () => elapsedMinute(clock, clock.cap);
  const [min, setMin] = React.useState(nowMinute);
  const [manual, setManual] = React.useState(false);
  const ticking = clock.status === "live" && !!clock.clockStartedAt;

  React.useEffect(() => {
    if (manual || !ticking) return;
    const t = setInterval(() => setMin(elapsedMinute(clock, clock.cap)), 1000);
    return () => clearInterval(t);
  }, [manual, ticking, clock]);

  const editMinute = (v: number) => {
    setManual(true);
    setMin(Math.max(0, Math.min(130, v)));
  };
  const syncMinute = () => {
    setManual(false);
    setMin(nowMinute());
  };

  const meta = types.find((e) => e.type === type) ?? types[0];
  const club = clubId === homeClub.id ? homeClub : awayClub;
  const roster = rosters[clubId] ?? [];
  const selected = roster.find((p) => p.id === playerId);
  const teammates = roster
    .filter((p) => p.id !== playerId)
    .sort((a, b) => {
      // for a substitution, the bench comes first
      if (meta.related === "sub_in" && a.role !== b.role) return a.role === "substitute" ? -1 : 1;
      return (a.number ?? 99) - (b.number ?? 99);
    });

  const submit = () => {
    if (meta.needsPlayer && !playerId) {
      toast.error("Pilih pemain terlebih dahulu");
      return;
    }
    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set("type", meta.type);
    fd.set("clubId", clubId);
    fd.set("minute", String(min));
    if (meta.needsPlayer && playerId) fd.set("playerId", playerId);
    if (meta.related && relatedId) fd.set("relatedPlayerId", relatedId);
    start(async () => {
      try {
        await addEvent(fd);
        toast.success(
          `${meta.label} dicatat · menit ${min}`,
          selected ? `${selected.number ? `#${selected.number} ` : ""}${selected.name} (${club.short})` : club.name,
        );
        onDone?.();
      } catch (e) {
        toast.error("Gagal mencatat kejadian", e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Who */}
      {locked && selected ? (
        <div className="flex items-center gap-3.5 rounded-2xl bg-surface-2 p-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-night font-display text-2xl leading-none text-white">
            {selected.number ?? "–"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{selected.name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {POSITION[selected.position]?.label ?? selected.position}
              {selected.role === "substitute" ? " · Cadangan" : ""}
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-center gap-1">
            <ClubCrest logoUrl={club.logo} short={club.short} size={34} />
            <span className="text-[10px] font-semibold text-ink-muted">{club.short}</span>
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[homeClub, awayClub].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setClubId(c.id);
                setPlayerId("");
                setRelatedId("");
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-semibold transition-colors",
                clubId === c.id
                  ? "border-night bg-night text-white"
                  : "border-line text-ink-secondary hover:border-ink/30",
              )}
            >
              <ClubCrest logoUrl={c.logo} short={c.short} size={26} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* What */}
      <div>
        <Label>Jenis kejadian</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Jenis kejadian">
          {types.map((e) => {
            const on = meta.type === e.type;
            return (
              <button
                key={e.type}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setType(e.type);
                  setRelatedId("");
                }}
                className={cn(
                  "flex min-h-[68px] flex-col items-start justify-between gap-2 rounded-2xl p-3 text-left text-[11px] font-semibold leading-tight transition-all",
                  on
                    ? cn(e.fill, "shadow-[0_10px_24px_-14px_rgba(20,20,20,0.8)]")
                    : "bg-surface-2 text-ink-secondary hover:bg-elevated",
                )}
              >
                <e.icon className="size-4" />
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Player picker for team-level entry */}
      {!locked && meta.needsPlayer && (
        <div>
          <Label htmlFor="event-player">Pemain</Label>
          <Select id="event-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Pilih pemain…</option>
            {[...roster]
              .sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number ? `#${p.number} ` : ""}
                  {p.name} ({p.position})
                </option>
              ))}
          </Select>
        </div>
      )}

      {meta.related && (
        <div>
          <Label htmlFor="event-related">
            {meta.related === "sub_in" ? "Pemain masuk" : "Assist oleh (opsional)"}
          </Label>
          <Select id="event-related" value={relatedId} onChange={(e) => setRelatedId(e.target.value)}>
            <option value="">{meta.related === "sub_in" ? "Pilih pemain masuk…" : "Tanpa assist"}</option>
            {teammates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ? `#${p.number} ` : ""}
                {p.name}
                {meta.related === "sub_in" && p.role === "substitute" ? " · cadangan" : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* When */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label htmlFor="event-minute">Menit</Label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Kurangi menit"
              onClick={() => editMinute(min - 1)}
              className="grid size-10 place-items-center rounded-full border border-line text-ink-secondary transition-colors hover:border-ink/30 hover:text-ink"
            >
              <Minus className="size-4" />
            </button>
            <input
              id="event-minute"
              type="number"
              inputMode="numeric"
              value={min}
              onChange={(e) => editMinute(Number(e.target.value) || 0)}
              min={0}
              max={130}
              className="h-10 w-16 rounded-full border border-line bg-surface text-center font-display text-xl tabular-nums text-ink outline-none focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
            />
            <button
              type="button"
              aria-label="Tambah menit"
              onClick={() => editMinute(min + 1)}
              className="grid size-10 place-items-center rounded-full border border-line text-ink-secondary transition-colors hover:border-ink/30 hover:text-ink"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="mt-2 min-h-6 text-[11px]">
            {manual ? (
              <button
                type="button"
                onClick={syncMinute}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-secondary hover:bg-elevated"
              >
                <Timer className="size-3" /> Pakai waktu laga ({nowMinute()}&rsquo;)
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand-dark">
                <Timer className="size-3" />
                {ticking ? "Otomatis · mengikuti waktu laga" : "Otomatis · waktu laga"}
              </span>
            )}
          </div>
        </div>
        <Button size="lg" disabled={pending} onClick={submit} className="flex-1 sm:flex-none">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Simpan ke Lini Masa
        </Button>
      </div>
    </div>
  );
}
