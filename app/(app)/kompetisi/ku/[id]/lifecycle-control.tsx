"use client";

import * as React from "react";
import { ChevronRight, Loader2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { setTournamentStatus } from "./actions";

const FLOW = [
  "draft",
  "registration",
  "verification",
  "ready",
  "ongoing",
  "completed",
  "archived",
] as const;

const LABEL: Record<string, string> = {
  draft: "Draf",
  registration: "Registrasi",
  verification: "Verifikasi",
  ready: "Siap",
  ongoing: "Berlangsung",
  completed: "Selesai",
  archived: "Arsip",
};

export function LifecycleControl({
  tournamentId,
  status,
}: {
  tournamentId: string;
  status: string;
}) {
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
        toast.success(`Status diubah ke ${LABEL[target]}`);
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-1 text-[10px] text-ink-muted">
        {FLOW.slice(0, 6).map((s, i) => (
          <React.Fragment key={s}>
            <span className={i <= idx ? "text-brand" : ""}>{LABEL[s]}</span>
            {i < 5 && <ChevronRight className="size-2.5" />}
          </React.Fragment>
        ))}
      </div>
      <div className="flex gap-2">
        {next && next !== "archived" && (
          <Button size="sm" disabled={pending} onClick={() => move(next)}>
            {pending ? <Loader2 className="animate-spin" /> : <ChevronRight />}
            Lanjut ke {LABEL[next]}
          </Button>
        )}
        {status === "completed" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => move("archived")}>
            <Archive className="size-3.5" /> Arsipkan
          </Button>
        )}
      </div>
    </div>
  );
}
