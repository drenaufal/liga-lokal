"use client";

import * as React from "react";
import { Users, Radio, Trophy, Loader2, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { rethrowControlFlow } from "@/lib/action-helpers";
import {
  generatePlayerReport,
  generateMatchReport,
  generateCompetitionReport,
} from "./actions";
import { useT } from "@/lib/i18n/client";

export function ReportGenerators({
  options,
}: {
  options: {
    players: { id: string; name: string }[];
    matches: { id: string; label: string }[];
    tournaments: { id: string; name: string }[];
  };
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [player, setPlayer] = React.useState(options.players[0]?.id ?? "");
  const [match, setMatch] = React.useState(options.matches[0]?.id ?? "");
  const [tour, setTour] = React.useState(options.tournaments[0]?.id ?? "");

  const run = (fn: (fd: FormData) => Promise<void>, key: string, value: string) => {
    if (!value) return;
    const fd = new FormData();
    fd.set(key, value);
    start(async () => {
      try {
        await fn(fd);
      } catch (e) {
        rethrowControlFlow(e);
        toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet" /> {t("Buat Laporan AI")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Block icon={Users} label={t("Analisis Pemain")}>
          <Select value={player} onChange={(e) => setPlayer(e.target.value)} className="text-xs">
            {options.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() => run(generatePlayerReport, "playerId", player)}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="size-3.5" />}
            {t("Analisis kekuatan & jenjang")}
          </Button>
        </Block>

        <Block icon={Radio} label={t("Ringkasan Pasca-Laga")}>
          <Select value={match} onChange={(e) => setMatch(e.target.value)} className="text-xs">
            {options.matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => run(generateMatchReport, "matchId", match)}
          >
            {t("Ringkas pola taktik")}
          </Button>
        </Block>

        <Block icon={Trophy} label={t("Wawasan Kompetisi")}>
          <Select value={tour} onChange={(e) => setTour(e.target.value)} className="text-xs">
            {options.tournaments.map((tn) => (
              <option key={tn.id} value={tn.id}>
                {tn.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => run(generateCompetitionReport, "tournamentId", tour)}
          >
            {t("Analisis tren turnamen")}
          </Button>
        </Block>
      </CardContent>
    </Card>
  );
}

function Block({
  icon: I,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        <I className="size-3" /> {label}
      </span>
      {children}
    </div>
  );
}
