"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { positionText } from "@/lib/positions";
import { useT } from "@/lib/i18n/client";

type P = {
  id: string;
  name: string;
  club: string | null;
  position: string;
  ageCode: string | null;
  photoUrl: string | null;
  goals: number;
  assists: number;
  score: number;
};

/** Gold, silver and bronze for ranks 1–3. */
const CROWNS = [
  { fill: "#ffc93c", stroke: "#a06a00" },
  { fill: "#d6dae1", stroke: "#646b78" },
  { fill: "#f0a46a", stroke: "#94491a" },
] as const;

export function PlayerPicker({
  players,
  selectedId,
  paramName = "player",
  rankOffset,
}: {
  players: P[];
  selectedId?: string;
  paramName?: string;
  /**
   * Set when the list is ranked by score: the number of players ranked before the first one shown
   * (the page offset). The top three get a crown.
   */
  rankOffset?: number;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pick = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(paramName, id);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div>
      <ul className="max-h-[260px] overflow-y-auto p-1.5 lg:max-h-[480px]">
        {players.map((p, i) => {
          const rank = rankOffset === undefined ? null : rankOffset + i + 1;
          const crown = rank !== null && rank <= CROWNS.length ? CROWNS[rank - 1] : null;
          return (
            <li key={p.id}>
              <button
                onClick={() => pick(p.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                  p.id === selectedId ? "bg-brand/10" : "hover:bg-surface-2",
                )}
              >
                <span className="relative shrink-0 pt-1">
                  <Avatar src={p.photoUrl} name={p.name} size={28} />
                  {crown && (
                    <span
                      role="img"
                      title={t("Peringkat {n}", { n: rank! })}
                      aria-label={t("Peringkat {n}", { n: rank! })}
                      className="absolute -left-1.5 -top-1 grid -rotate-[18deg] place-items-center drop-shadow-sm"
                    >
                      <Crown className="size-4" fill={crown.fill} stroke={crown.stroke} strokeWidth={1.75} aria-hidden />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                  <span className="block truncate text-[10px] text-ink-muted">
                    {p.club} · {positionText(p.position, t)} · {p.ageCode}
                  </span>
                </span>
                <span className={cn("shrink-0 text-[10px] tabular-nums", crown ? "font-semibold text-ink" : "text-ink-muted")}>
                  {Math.round(p.score)}
                </span>
              </button>
            </li>
          );
        })}
        {players.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-ink-muted">
            {t("Tidak ada pemain yang cocok.")}
          </li>
        )}
      </ul>
    </div>
  );
}
