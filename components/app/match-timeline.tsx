"use client";

import * as React from "react";
import {
  Goal,
  Square,
  ArrowLeftRight,
  Hand,
  ShieldAlert,
  Flag,
  Ban,
  Undo2,
  Sparkles,
  Crosshair,
  CircleSlash,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_LABEL } from "@/lib/status";
import { voidEvent } from "@/app/(app)/match-ops/[id]/actions";
import { toast } from "@/components/ui/toaster";

export type TimelineEvent = {
  id: string;
  type: string;
  minute: number;
  addedTime?: number | null;
  clubId: string | null;
  playerName?: string | null;
  relatedPlayerId?: string | null;
  voided: boolean;
  detail?: Record<string, unknown> | null;
};

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  goal: Goal,
  penalty_goal: Goal,
  own_goal: CircleSlash,
  shot_on: Crosshair,
  shot_off: Crosshair,
  assist: Sparkles,
  yellow_card: Square,
  red_card: Square,
  second_yellow: Square,
  save: Hand,
  interception: ShieldCheck,
  foul: ShieldAlert,
  offside: Flag,
  corner: Flag,
  substitution: ArrowLeftRight,
  var_check: Sparkles,
};

const TONE: Record<string, string> = {
  goal: "text-brand",
  penalty_goal: "text-brand",
  own_goal: "text-danger",
  yellow_card: "text-warn",
  red_card: "text-danger",
  second_yellow: "text-danger",
  assist: "text-info",
  var_check: "text-violet",
};

export function MatchTimeline({
  events,
  matchId,
  homeClubId,
  canEdit,
  playerLookup,
}: {
  events: TimelineEvent[];
  matchId: string;
  homeClubId: string | null;
  canEdit?: boolean;
  playerLookup?: Record<string, string>;
}) {
  const [pending, start] = React.useTransition();
  const visible = events.filter((e) => e.type !== "var_check" || (e.detail as { award?: string })?.award);

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-ink-muted">
        Belum ada kejadian tercatat.
      </p>
    );
  }

  const doVoid = (id: string) => {
    const fd = new FormData();
    fd.set("eventId", id);
    fd.set("matchId", matchId);
    fd.set("reason", "Koreksi operator dari lini masa");
    start(async () => {
      try {
        await voidEvent(fd);
        toast.success("Kejadian dibatalkan");
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <ol className="relative space-y-1 before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-line-soft">
      {[...visible]
        .sort((a, b) => a.minute - b.minute)
        .map((e) => {
          const home = e.clubId === homeClubId;
          const Icon = ICON[e.type] ?? Flag;
          const award = (e.detail as { award?: string })?.award;
          return (
            <li
              key={e.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2",
                e.voided && "opacity-40",
              )}
            >
              <div className={cn("flex items-center gap-2", home ? "justify-end text-right" : "opacity-0")}>
                {home && (
                  <EventBody
                    e={e}
                    award={award}
                    Icon={Icon}
                    tone={TONE[e.type]}
                    playerLookup={playerLookup}
                    canEdit={canEdit && !e.voided}
                    onVoid={() => doVoid(e.id)}
                    pending={pending}
                  />
                )}
              </div>
              <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full bg-night text-[9px] font-bold tabular-nums text-white">
                {e.minute}&rsquo;
              </span>
              <div className={cn("flex items-center gap-2", !home ? "" : "opacity-0")}>
                {!home && (
                  <EventBody
                    e={e}
                    award={award}
                    Icon={Icon}
                    tone={TONE[e.type]}
                    playerLookup={playerLookup}
                    canEdit={canEdit && !e.voided}
                    onVoid={() => doVoid(e.id)}
                    pending={pending}
                  />
                )}
              </div>
            </li>
          );
        })}
    </ol>
  );
}

function EventBody({
  e,
  award,
  Icon,
  tone,
  playerLookup,
  canEdit,
  onVoid,
  pending,
}: {
  e: TimelineEvent;
  award?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: string;
  playerLookup?: Record<string, string>;
  canEdit?: boolean;
  onVoid?: () => void;
  pending?: boolean;
}) {
  return (
    <div className="group flex min-w-0 max-w-full items-center gap-1.5 rounded-xl px-2 py-1.5 hover:bg-surface-2">
      <Icon className={cn("size-3.5 shrink-0", tone ?? "text-ink-muted")} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-ink">
          {award ?? e.playerName ?? EVENT_LABEL[e.type]}
        </p>
        <p className="truncate text-[10px] text-ink-muted">
          {award ? "Pemain Terbaik" : EVENT_LABEL[e.type]}
          {e.relatedPlayerId && playerLookup?.[e.relatedPlayerId]
            ? ` · assist ${playerLookup[e.relatedPlayerId].split(" ").slice(-1)}`
            : ""}
        </p>
      </div>
      {canEdit && (
        <button
          onClick={onVoid}
          disabled={pending}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Batalkan kejadian"
        >
          <Ban className="size-3 text-danger" />
        </button>
      )}
    </div>
  );
}

void Undo2;
