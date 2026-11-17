"use client";

import * as React from "react";
import { CalendarPlus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { generateFixtures, recomputeStandings } from "./actions";
import { useT } from "@/lib/i18n/client";

export function GenerateFixturesButton({ tournamentId }: { tournamentId: string }) {
  const t = useT();
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
            toast.success(t("Jadwal pertandingan dibuat"));
          } catch (e) {
            toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus className="size-3.5" />}
      {t("Buat Jadwal Otomatis")}
    </Button>
  );
}

export function RecomputeStandingsButton({ tournamentId }: { tournamentId: string }) {
  const t = useT();
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
            toast.success(t("Klasemen diperbarui"));
          } catch (e) {
            toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-3.5" />}
      {t("Hitung Ulang Klasemen")}
    </Button>
  );
}
