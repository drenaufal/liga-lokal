import {
  CheckCircle2,
  Flag,
  Radio,
  Trophy,
  CalendarClock,
  Gauge,
  FileInput,
  UserCheck,
  ScrollText,
} from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { localizeAudit } from "@/lib/audit-display";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "player.verify": UserCheck,
  "player.flag": Flag,
  "match.confirm": CheckCircle2,
  "match.event.create": Radio,
  "tournament.status": Trophy,
  "fixture.generate": CalendarClock,
  "formula.activate": Gauge,
  "import.commit": FileInput,
  "referee.assign": ScrollText,
  "standings.recompute": Trophy,
};

export async function ActivityFeed({
  items,
}: {
  items: {
    id: string;
    actorName: string | null;
    actorRole: string | null;
    action: string;
    summary: string;
    createdAt: Date | string;
  }[];
}) {
  const { t, fmt, locale } = await getI18n();
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const Icon = ICONS[it.action] ?? ScrollText;
        return (
          <li key={it.id} className="flex gap-3 rounded-lg px-1.5 py-2 hover:bg-surface-2">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-secondary">{localizeAudit(t, locale, it.summary)}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                {it.actorName ?? t("Sistem")} · {fmt.relative(it.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
