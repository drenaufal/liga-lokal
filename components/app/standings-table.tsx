import Link from "next/link";
import { cn } from "@/lib/utils";
import { ClubCrest } from "./club-crest";

export type StandingRowData = {
  clubId: string;
  name: string;
  short: string;
  logo?: string | null;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string[];
  rank: number;
};

const FORM_TONE: Record<string, string> = {
  M: "bg-success/20 text-success",
  S: "bg-warn/20 text-warn",
  K: "bg-danger/20 text-danger",
};

export function StandingsTable({
  rows,
  advancePerGroup = 0,
}: {
  rows: StandingRowData[];
  advancePerGroup?: number;
}) {
  const groups = [...new Set(rows.map((r) => r.group))].sort();

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          {g !== "-" && (
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Grup {g}
            </h4>
          )}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2/40 text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Klub</th>
                  <th className="px-2 py-2 text-right">M</th>
                  <th className="px-2 py-2 text-right">Mn</th>
                  <th className="px-2 py-2 text-right">S</th>
                  <th className="px-2 py-2 text-right">K</th>
                  <th className="px-2 py-2 text-right">GM</th>
                  <th className="px-2 py-2 text-right">GK</th>
                  <th className="px-2 py-2 text-right">SG</th>
                  <th className="px-2 py-2 text-right font-bold text-ink-secondary">Poin</th>
                  <th className="hidden px-2 py-2 text-center sm:table-cell">5 Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows
                  .filter((r) => r.group === g)
                  .map((r) => {
                    const advancing = advancePerGroup > 0 && r.rank <= advancePerGroup;
                    return (
                      <tr key={r.clubId} className="hover:bg-surface-2/40">
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              "inline-flex size-5 items-center justify-center rounded text-[10px] font-semibold tabular-nums",
                              advancing
                                ? "bg-brand/15 text-brand"
                                : "text-ink-muted",
                            )}
                          >
                            {r.rank}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/registry/klub/${r.clubId}`}
                            className="flex items-center gap-2 hover:text-brand"
                          >
                            <ClubCrest logoUrl={r.logo} short={r.short} size={20} />
                            <span className="truncate font-medium text-ink">{r.name}</span>
                          </Link>
                        </td>
                        <Cell>{r.played}</Cell>
                        <Cell>{r.won}</Cell>
                        <Cell>{r.drawn}</Cell>
                        <Cell>{r.lost}</Cell>
                        <Cell>{r.goalsFor}</Cell>
                        <Cell>{r.goalsAgainst}</Cell>
                        <Cell>
                          {r.goalsFor - r.goalsAgainst > 0 ? "+" : ""}
                          {r.goalsFor - r.goalsAgainst}
                        </Cell>
                        <td className="px-2 py-2 text-right font-bold tabular-nums text-ink">
                          {r.points}
                        </td>
                        <td className="hidden px-2 py-2 sm:table-cell">
                          <div className="flex justify-center gap-0.5">
                            {r.form.slice(-5).map((f, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "grid size-4 place-items-center rounded text-[9px] font-bold",
                                  FORM_TONE[f] ?? "bg-surface-2 text-ink-muted",
                                )}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {advancePerGroup > 0 && g !== "-" && (
            <p className="mt-1.5 text-[10px] text-ink-muted">
              <span className="mr-1 inline-block size-2 rounded-full bg-brand/40 align-middle" />
              {advancePerGroup} tim teratas lolos ke babak gugur
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2 text-right tabular-nums text-ink-secondary">{children}</td>;
}
