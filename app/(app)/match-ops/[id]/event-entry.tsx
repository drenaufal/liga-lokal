"use client";

import * as React from "react";
import {
  Goal,
  ShieldAlert,
  Flag,
  ArrowLeftRight,
  Crosshair,
  CircleSlash,
  ShieldCheck,
  Loader2,
  Plus,
  Lock,
  Search,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ClubCrest } from "@/components/app/club-crest";
import { cn } from "@/lib/utils";
import { positionText } from "@/lib/positions";
import { elapsedMinute } from "@/lib/match-clock";
import type { ParticipationState } from "@/lib/match-participation";
import { addEvent } from "./actions";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

export type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  number: number | null;
  role: "starter" | "substitute" | "squad";
  captain?: boolean;
  state?: ParticipationState;
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
  { type: "goal", label: msg("Gol"), icon: Goal, fill: "bg-brand text-white", needsPlayer: true, related: "assist" },
  { type: "penalty_goal", label: msg("Gol Penalti"), icon: Goal, fill: "bg-brand text-white", needsPlayer: true },
  { type: "own_goal", label: msg("Gol Bunuh Diri"), icon: CircleSlash, fill: "bg-night text-white", needsPlayer: true },
  { type: "shot_on", label: msg("Tembakan Tepat"), icon: Crosshair, fill: "bg-block-blue text-white", needsPlayer: true },
  { type: "shot_off", label: msg("Tembakan Meleset"), icon: Crosshair, fill: "bg-block-lavender text-ink", needsPlayer: true },
  { type: "interception", label: msg("Intersep"), icon: ShieldCheck, fill: "bg-block-lavender text-ink", needsPlayer: true },
  { type: "yellow_card", label: msg("Kartu Kuning"), icon: YellowCard, fill: "bg-block-yellow text-ink", needsPlayer: true },
  { type: "red_card", label: msg("Kartu Merah"), icon: RedCard, fill: "bg-night text-white", needsPlayer: true },
  { type: "foul", label: msg("Pelanggaran"), icon: ShieldAlert, fill: "bg-block-orange text-ink", needsPlayer: true },
  { type: "substitution", label: msg("Pergantian"), icon: ArrowLeftRight, fill: "bg-block-pink text-ink", needsPlayer: true, related: "sub_in" },
  { type: "corner", label: msg("Tendangan Sudut"), icon: Flag, fill: "bg-night text-white" },
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
  initialType,
}: {
  matchId: string;
  clock: MatchClock;
  homeClub: ClubMini;
  awayClub: ClubMini;
  rosters: Record<string, RosterPlayer[]>;
  player?: { id: string; clubId: string } | null;
  onDone?: () => void;
  initialType?: string;
}) {
  const t = useT();
  const locked = !!player;
  const types = locked ? PLAYER_TYPES : EVENT_TYPES;
  const [pending, start] = React.useTransition();
  const [type, setType] = React.useState<string>(initialType ?? (locked ? "goal" : "corner"));
  const [clubId, setClubId] = React.useState(player?.clubId ?? homeClub.id);
  const [playerId, setPlayerId] = React.useState(player?.id ?? "");
  const [relatedId, setRelatedId] = React.useState("");
  // Every event is stamped with the match clock; the operator cannot change the minute.
  const nowMinute = () => elapsedMinute(clock, clock.cap);
  const [min, setMin] = React.useState(nowMinute);
  const ticking = clock.status === "live" && !!clock.clockStartedAt;

  React.useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setMin(elapsedMinute(clock, clock.cap)), 1000);
    return () => clearInterval(timer);
  }, [ticking, clock]);

  const meta = types.find((e) => e.type === type) ?? types[0];
  const club = clubId === homeClub.id ? homeClub : awayClub;
  const roster = rosters[clubId] ?? [];
  const selected = roster.find((p) => p.id === playerId);
  const teammates = roster
    .filter((p) => p.id !== playerId && (meta.related === "sub_in" ? p.state === "bench" || p.state === "subbed" : p.state === "playing"))
    .sort((a, b) => {
      // for a substitution, reserves who have not played come before players who were taken off
      if (meta.related === "sub_in" && a.state !== b.state) return a.state === "bench" ? -1 : 1;
      return (a.number ?? 99) - (b.number ?? 99);
    });

  const submit = () => {
    if (meta.needsPlayer && !playerId) {
      toast.error(t("Pilih pemain terlebih dahulu"));
      return;
    }
    if (meta.related === "sub_in" && !relatedId) { toast.error(t("Pilih pemain cadangan yang masuk")); return; }
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
          t("{label} dicatat · menit {min}", { label: t.dyn(meta.label), min }),
          selected ? `${selected.number ? `#${selected.number} ` : ""}${selected.name} (${club.short})` : club.name,
        );
        onDone?.();
      } catch (e) {
        toast.error(t("Gagal mencatat kejadian"), e instanceof Error ? e.message : undefined);
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
              {positionText(selected.position, t)}
              {selected.role === "substitute" ? ` · ${t("Cadangan")}` : ""}
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
        <Label>{t("Jenis kejadian")}</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("Jenis kejadian")}>
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
                {t.dyn(e.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Player picker for team-level entry */}
      {!locked && meta.needsPlayer && (
        <div>
          <Label htmlFor="event-player">{t("Pemain::jenis")}</Label>
          <Select id="event-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">{t("Pilih pemain…")}</option>
            {[...roster].filter((p) => p.state === "playing")
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

      {meta.related === "sub_in" && (
        <SubstitutePicker players={teammates} value={relatedId} onChange={setRelatedId} />
      )}

      {meta.related === "assist" && (
        <div>
          <Label htmlFor="event-related">{t("Assist oleh (opsional)")}</Label>
          <Select id="event-related" value={relatedId} onChange={(e) => setRelatedId(e.target.value)}>
            <option value="">{t("Tanpa assist")}</option>
            {teammates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ? `#${p.number} ` : ""}
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* When */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label htmlFor="event-minute">{t("Menit::waktu")}</Label>
          <div
            id="event-minute"
            role="status"
            aria-label={t("Menit {n}, terkunci", { n: min })}
            className="flex h-10 w-24 items-center justify-center gap-1.5 rounded-full border border-line bg-surface-2 font-display text-xl tabular-nums text-ink-secondary"
          >
            {min}&rsquo;
            <Lock className="size-3.5 text-ink-muted" aria-hidden />
          </div>
          <div className="mt-2 min-h-6 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-secondary">
              <Lock className="size-3" />
              {t("Terkunci · mengikuti waktu laga")}
            </span>
          </div>
        </div>
        <Button size="lg" disabled={pending || (meta.related === "sub_in" && !relatedId)} onClick={submit} className="flex-1 sm:flex-none">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("Simpan ke Lini Masa")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Search-and-pick list for the player coming on. Typing narrows the bench by
 * name or shirt number (Enter takes the first match); the list still scrolls.
 */
function SubstitutePicker({
  players,
  value,
  onChange,
}: {
  players: RosterPlayer[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const visible = q
    ? players.filter((p) => `${p.name} ${p.number ?? ""}`.toLowerCase().includes(q))
    : players;
  const chosen = players.find((p) => p.id === value);

  return (
    <div>
      <Label htmlFor="event-related">{t("Pemain masuk")}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
        <input
          id="event-related"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (visible[0]) onChange(visible[0].id);
          }}
          placeholder={t("Ketik nama atau nomor pemain cadangan…")}
          className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
        />
      </div>
      <div
        role="radiogroup"
        aria-label={t("Pemain masuk")}
        className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-1.5"
      >
        {visible.map((p) => {
          const on = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? "" : p.id)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                on ? "bg-brand-soft" : "hover:bg-surface-2",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold tabular-nums text-ink-secondary">
                {p.number ?? "–"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-muted">{p.name}</span>
                <span className="block truncate text-[11px] text-ink-muted">
                  {positionText(p.position, t)}
                  {p.state === "subbed" ? ` · ${t("Sudah diganti")}` : ""}
                </span>
              </span>
              {on && <Check className="size-4 shrink-0 text-brand" strokeWidth={3} />}
            </button>
          );
        })}
        {!visible.length && (
          <p className="px-3 py-5 text-center text-xs text-ink-muted">
            {players.length ? t("Tidak ada pemain cadangan untuk “{query}”.", { query }) : t("Tidak ada pemain cadangan yang tersedia.")}
          </p>
        )}
      </div>
      {chosen && (
        <p className="mt-1.5 text-[11px] text-ink-secondary">
          {t("Masuk:")} <span className="font-semibold text-ink">{chosen.number ? `#${chosen.number} ` : ""}{chosen.name}</span>
        </p>
      )}
    </div>
  );
}
