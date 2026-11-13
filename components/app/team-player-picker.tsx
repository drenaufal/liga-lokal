"use client";

import * as React from "react";
import { Check, Search, TriangleAlert, X } from "lucide-react";
import { LINE_LABEL, LINE_ORDER, positionLine, positionText, type PositionLine } from "@/lib/positions";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/client";

export type PickerPlayer = { id: string; name: string; position: string; jersey: number | null };
export type SquadRole = "starter" | "substitute";
/** Players absent from the map are not in the squad. */
export type SquadMap = Record<string, SquadRole>;

const LINES: PositionLine[] = ["GK", "DF", "MF", "FW"];

/** Starters beyond the limit or a second starting keeper make a squad invalid. */
export function squadProblems(players: PickerPlayer[], squad: SquadMap, limit: number | null | undefined, t: TFunction) {
  const starters = players.filter((p) => squad[p.id] === "starter");
  const problems: string[] = [];
  if (limit && starters.length > limit) problems.push(t("Starter melebihi batas {limit} pemain.", { limit }));
  if (starters.filter((p) => positionLine(p.position) === "GK").length > 1) problems.push(t("Hanya satu kiper boleh menjadi starter."));
  return problems;
}

/**
 * One team's player chooser.
 *
 * `benchRest` (match-ops): tapping a player makes them a starter; everyone not
 * picked is a substitute automatically. Otherwise (DSP) each player is marked
 * starter or cadangan; a player with neither is not in the squad, and tapping
 * the active choice again clears it.
 */
export function TeamPlayerPicker({
  title,
  players,
  squad,
  onChange,
  benchRest,
  starterLimit,
  squadLimit,
  disabled,
}: {
  title: React.ReactNode;
  players: PickerPlayer[];
  squad: SquadMap;
  onChange: (next: SquadMap) => void;
  benchRest?: boolean;
  starterLimit?: number | null;
  squadLimit?: number | null;
  disabled?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const [line, setLine] = React.useState<PositionLine | "all">("all");
  const starters = players.filter((p) => squad[p.id] === "starter");
  const bench = benchRest ? players.length - starters.length : players.filter((p) => squad[p.id] === "substitute").length;
  const total = starters.length + bench;
  const problems = squadProblems(players, squad, starterLimit, t);
  const full = !!starterLimit && starters.length >= starterLimit;
  const q = query.trim().toLowerCase();

  const set = (id: string, role: SquadRole | "out") => {
    const next = { ...squad };
    if (role === "out") delete next[id];
    else next[id] = role;
    onChange(next);
  };
  const tap = (id: string) => {
    if (squad[id] === "starter") set(id, benchRest ? "out" : "substitute");
    else if (!full) set(id, "starter");
  };

  const visible = players.filter(
    (p) => (line === "all" || positionLine(p.position) === line) && (!q || `${p.name} ${p.jersey ?? ""}`.toLowerCase().includes(q)),
  );
  const groups = LINES.map((l) => ({ line: l, rows: visible.filter((p) => positionLine(p.position) === l) }))
    .filter((g) => g.rows.length)
    .sort((a, b) => LINE_ORDER[a.line] - LINE_ORDER[b.line]);

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface">
      <header className="space-y-3 border-b border-line p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold tabular-nums">
            <span
              className={cn(
                "rounded-full px-2.5 py-1",
                problems.length || (starterLimit && starters.length > starterLimit)
                  ? "bg-danger/12 text-danger"
                  : full ? "bg-success/12 text-success"
                  : starters.length ? "bg-brand-soft text-brand-dark" : "bg-warn/15 text-warn",
              )}
            >
              {t("Starter")} {starters.length}{starterLimit ? `/${starterLimit}` : ""}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-secondary">{t("Cadangan")} {bench}</span>
            {!!squadLimit && (
              <span className={cn("rounded-full px-2.5 py-1", total > squadLimit ? "bg-warn/15 text-warn" : "bg-surface-2 text-ink-muted")}>
                {t("Skuad")} {total}/{squadLimit}
              </span>
            )}
          </div>
        </div>

        {!!starterLimit && (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className={cn("h-full rounded-full transition-all", starters.length > starterLimit ? "bg-danger" : full ? "bg-success" : "bg-brand")}
              style={{ width: `${Math.min(100, (starters.length / starterLimit) * 100)}%` }}
            />
          </div>
        )}

        {/* Starters at a glance */}
        <div className="flex min-h-7 flex-wrap items-center gap-1.5" aria-live="polite">
          {starters.length ? (
            starters.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => tap(p.id)}
                aria-label={t("Keluarkan {name} dari starter", { name: p.name })}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-night py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-night-2 disabled:opacity-60"
              >
                <span className="tabular-nums text-night-muted">{p.jersey ?? "–"}</span>
                <span className="truncate">{p.name.split(" ")[0]}</span>
                <X className="size-3 shrink-0 text-night-muted" />
              </button>
            ))
          ) : (
            <span className="text-xs text-ink-muted">
              {benchRest ? t("Ketuk pemain untuk menjadikannya starter. Sisanya otomatis cadangan.") : t("Belum ada starter dipilih.")}
            </span>
          )}
        </div>

        {problems.map((m) => (
          <p key={m} role="alert" className="flex items-center gap-1.5 text-[11px] font-medium text-danger">
            <TriangleAlert className="size-3.5 shrink-0" /> {m}
          </p>
        ))}
        {full && !problems.length && !disabled && (
          <p className="text-[11px] text-ink-muted">{t("Starter sudah penuh. Lepaskan satu pemain untuk menggantinya.")}</p>
        )}
      </header>

      {/* Filter */}
      <div className="space-y-2 border-b border-line p-3">
        {players.length > 6 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Cari nama atau nomor punggung…")}
              aria-label={t("Cari pemain")}
              className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("Filter posisi")}>
          {(["all", ...LINES] as const).map((l) => {
            const count = l === "all" ? players.length : players.filter((p) => positionLine(p.position) === l).length;
            if (l !== "all" && !count) return null;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={line === l}
                onClick={() => setLine(l)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  line === l ? "bg-ink text-white" : "bg-surface-2 text-ink-secondary hover:bg-elevated",
                )}
              >
                {l === "all" ? t("Semua") : t.dyn(LINE_LABEL[l])} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
          {!benchRest && !!Object.keys(squad).length && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({})}
              className="ml-auto text-[11px] font-semibold text-ink-muted underline-offset-2 hover:text-danger hover:underline disabled:opacity-50"
            >
              {t("Kosongkan")}
            </button>
          )}
          {benchRest && !!starters.length && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({})}
              className="ml-auto text-[11px] font-semibold text-ink-muted underline-offset-2 hover:text-danger hover:underline disabled:opacity-50"
            >
              {t("Reset starter")}
            </button>
          )}
        </div>
        {!benchRest && (
          <p className="text-[11px] text-ink-muted">
            {t("Tandai tiap pemain sebagai Starter atau Cadangan. Ketuk pilihan yang aktif sekali lagi untuk membatalkan.")}
          </p>
        )}
      </div>

      {/* Players */}
      <div className="max-h-[26rem] overflow-y-auto p-1.5">
        {groups.map((g) => (
          <div key={g.line} className="mb-1 last:mb-0">
            <p className="sticky top-0 z-[1] bg-surface/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted backdrop-blur">
              {t.dyn(LINE_LABEL[g.line])} · {t("{n} starter", { n: g.rows.filter((p) => squad[p.id] === "starter").length })}
            </p>
            <ul className="space-y-1">
              {g.rows.map((p) => {
                const role = squad[p.id];
                const isStarter = role === "starter";
                const blocked = !isStarter && full;
                const num = (
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums transition-colors",
                      isStarter ? "bg-brand text-white" : role === "substitute" || benchRest ? "bg-surface-2 text-ink-secondary" : "bg-surface-2 text-ink-muted",
                    )}
                  >
                    {p.jersey ?? "–"}
                  </span>
                );
                const info = (
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                    <span className="block text-[11px] text-ink-muted">{positionText(p.position, t)}</span>
                  </span>
                );
                return (
                  <li key={p.id}>
                    {benchRest ? (
                      <button
                        type="button"
                        disabled={disabled || blocked}
                        aria-pressed={isStarter}
                        onClick={() => tap(p.id)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed",
                          isStarter ? "bg-brand-soft ring-1 ring-brand/30" : "hover:bg-surface-2",
                          blocked && "opacity-45 hover:bg-transparent",
                        )}
                      >
                        {num}
                        {info}
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            isStarter ? "bg-brand text-white" : "bg-surface-2 text-ink-muted",
                          )}
                        >
                          {isStarter && <Check className="size-3" strokeWidth={3} />}
                          {isStarter ? t("Starter") : t("Cadangan")}
                        </span>
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2.5 py-2",
                          isStarter ? "bg-brand-soft ring-1 ring-brand/30" : role ? "bg-surface-2" : "",
                        )}
                      >
                        {num}
                        {info}
                        <div role="radiogroup" aria-label={t("Peran {name}", { name: p.name })} className="flex shrink-0 overflow-hidden rounded-full border border-line bg-surface text-[11px] font-semibold">
                          {(
                            [
                              ["starter", t("Starter")],
                              ["substitute", t("Cadangan")],
                            ] as const
                          ).map(([value, label]) => {
                            const active = role === value;
                            const off = disabled || (value === "starter" && !active && full);
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={off}
                                title={active ? t("Ketuk lagi untuk membatalkan") : undefined}
                                onClick={() => set(p.id, active ? "out" : value)}
                                className={cn(
                                  "px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40",
                                  active
                                    ? value === "starter" ? "bg-brand text-white" : "bg-ink text-white"
                                    : "text-ink-muted hover:bg-surface-2",
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {!groups.length && (
          <p className="px-3 py-8 text-center text-xs text-ink-muted">
            {players.length ? t("Tidak ada pemain yang cocok dengan filter.") : t("Belum ada pemain terdaftar untuk tim dan KU ini.")}
          </p>
        )}
      </div>
    </section>
  );
}
