"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { POSITION } from "@/lib/status";
import { LINE_LABEL, type PositionLine } from "@/lib/positions";

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

export function PlayerPicker({
  players,
  selectedId,
  paramName = "player",
}: {
  players: P[];
  selectedId?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      if ((params.get("q") ?? "") !== q) router.push(`${pathname}?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pick = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(paramName, id);
    router.push(`${pathname}?${next.toString()}`);
  };

  const filters: PositionLine[] = ["GK", "DF", "MF", "FW"];
  const activePos = params.get("position");

  return (
    <div>
      <div className="border-b border-line-soft p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama pemain…"
            className="h-8 w-full rounded-lg border border-line bg-base/60 pl-8 pr-2 text-xs text-ink outline-none focus:border-brand/50"
          />
        </div>
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                activePos === f ? next.delete("position") : next.set("position", f);
                router.push(`${pathname}?${next.toString()}`);
              }}
              className={cn(
                "flex-1 rounded-md border px-1 py-1 text-[10px] font-medium transition-colors",
                activePos === f
                  ? "border-brand/50 bg-brand/10 text-ink"
                  : "border-line text-ink-muted",
              )}
            >
              {LINE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <ul className="max-h-[260px] overflow-y-auto p-1.5 lg:max-h-[480px]">
        {players.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => pick(p.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                p.id === selectedId ? "bg-brand/10" : "hover:bg-surface-2",
              )}
            >
              <Avatar src={p.photoUrl} name={p.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                <span className="block truncate text-[10px] text-ink-muted">
                  {p.club} · {POSITION[p.position].label} · {p.ageCode}
                </span>
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
                {Math.round(p.score)}
              </span>
            </button>
          </li>
        ))}
        {players.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-ink-muted">
            Tidak ada pemain yang cocok.
          </li>
        )}
      </ul>
    </div>
  );
}
