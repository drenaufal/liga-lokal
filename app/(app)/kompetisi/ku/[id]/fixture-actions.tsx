"use client";

import * as React from "react";
import { CalendarPlus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { generateFixtures, recomputeStandings } from "./actions";

export function GenerateFixturesButton({ tournamentId }: { tournamentId: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", tournamentId);
        start(async () => {
          try {
            await generateFixtures(fd);
            toast.success("Jadwal pertandingan dibuat");
          } catch (e) {
            toast.error("Gagal", e instanceof Error ? e.message : undefined);
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus className="size-3.5" />}
      Buat Jadwal Otomatis
    </Button>
  );
}

export function RecomputeStandingsButton({ tournamentId }: { tournamentId: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", tournamentId);
        start(async () => {
          try {
            await recomputeStandings(fd);
            toast.success("Klasemen diperbarui");
          } catch (e) {
            toast.error("Gagal", e instanceof Error ? e.message : undefined);
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-3.5" />}
      Hitung Ulang Klasemen
    </Button>
  );
}
