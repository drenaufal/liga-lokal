"use client";

import * as React from "react";
import { ChevronRight, Loader2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { setTournamentStatus } from "./actions";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

const FLOW = [
  "draft",
  "registration",
  "verification",
  "ready",
  "ongoing",
  "completed",
  "archived",
] as const;

/** The steps drawn in the progress bar; "archived" is a side exit after the last one. */
const STEPS = FLOW.slice(0, 6);

const LABEL: Record<string, string> = {
  draft: msg("Draf"),
  registration: msg("Registrasi"),
  verification: msg("Verifikasi"),
  ready: msg("Siap"),
  ongoing: msg("Berlangsung"),
  completed: msg("Selesai"),
  archived: msg("Arsip"),
};

export function LifecycleControl({
  tournamentId,
  status,
}: {
  tournamentId: string;
  status: string;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const idx = FLOW.indexOf(status as (typeof FLOW)[number]);
  const next = FLOW[idx + 1];

  const move = (target: string) => {
    const fd = new FormData();
    fd.set("id", tournamentId);
    fd.set("status", target);
    start(async () => {
      try {
        await setTournamentStatus(fd);
        toast.success(t("Status diubah ke {status}", { status: t.dyn(LABEL[target]) }));
      } catch (e) {
        toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2.5">
        {/* one bar per step: filled up to and including the current one */}
        <ol className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <li
              key={s}
              title={t.dyn(LABEL[s])}
              aria-current={i === idx ? "step" : undefined}
              className={cn("h-1.5 w-5 rounded-full sm:w-7", i <= idx ? "bg-brand" : "bg-elevated", i === idx && "ring-2 ring-brand/25")}
            >
              <span className="sr-only">{t.dyn(LABEL[s])}</span>
            </li>
          ))}
        </ol>
        <span className="text-[11px] text-ink-muted">{t("Tahap {status}", { status: t.dyn(LABEL[status] ?? status) })}</span>
      </div>
      <div className="flex gap-2">
        {next && next !== "archived" && (
          <Button size="sm" disabled={pending} onClick={() => move(next)}>
            {pending ? <Loader2 className="animate-spin" /> : <ChevronRight />}
            {t("Lanjut ke {status}", { status: t.dyn(LABEL[next]) })}
          </Button>
        )}
        {status === "completed" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => move("archived")}>
            <Archive className="size-3.5" /> {t("Arsipkan")}
          </Button>
        )}
      </div>
    </div>
  );
}
