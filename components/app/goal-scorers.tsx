import type { MatchGoal } from "@/lib/queries/match-goals";
import { cn } from "@/lib/utils";
import styles from "./goal-scorers.module.css";
import { getT } from "@/lib/i18n/server";

export async function GoalScorers({ goals }: { goals: MatchGoal[] }) {
  const t = await getT();
  if (!goals.length) return null;
  const columns = goals.length > 5;
  return <ul
    className={cn(styles.list, columns && styles.columns, "mt-2 text-[10px] font-medium leading-relaxed @4xl:text-sm")}
    style={columns ? { gridTemplateRows: `repeat(${Math.ceil(goals.length / 2)}, auto)` } : undefined}
  >
    {goals.map((g) => <li key={g.id} className="min-w-0 break-words">
      <span>{g.playerName ?? t("Pencetak gol belum dicatat")}{g.number != null ? ` (#${g.number})` : ""}</span>{" "}
      <span className="inline-block whitespace-nowrap font-bold tabular-nums">{g.minute}{g.addedTime ? `+${g.addedTime}` : ""}′{g.ownGoal ? ` ${t("(BD)")}` : ""}</span>
    </li>)}
  </ul>;
}
