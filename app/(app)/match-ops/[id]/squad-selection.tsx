"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Users } from "lucide-react";
import { saveMatchSquad } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { TeamPlayerPicker, squadProblems, type SquadMap } from "@/components/app/team-player-picker";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/client";

type Player = { id: string; name: string; clubId: string; jersey: number | null; position: string };

/**
 * Operator view of the match squad. Picking a player makes them a starter;
 * everyone registered for the team who is not picked plays as cadangan.
 */
export function SquadSelection({ matchId, teams, players, initialStarters, savedCount, starterLimit, squadLimit }: {
  matchId: string; teams: { id: string; name: string }[]; players: Player[];
  initialStarters: string[]; savedCount: number;
  starterLimit?: number | null; squadLimit?: number | null;
}) {
  const t = useT();
  const toMap = (ids: string[]): SquadMap => Object.fromEntries(ids.map((id) => [id, "starter" as const]));
  const [squad, setSquad] = useState<SquadMap>(() => toMap(initialStarters));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const starters = useMemo(() => Object.keys(squad).filter((id) => squad[id] === "starter"), [squad]);
  const byTeam = teams.map((tm) => ({ team: tm, players: players.filter((p) => p.clubId === tm.id) }));
  const initialKey = [...initialStarters].sort().join(":");
  // saved once with every registered player counted (starters + cadangan)
  const dirty = [...starters].sort().join(":") !== initialKey || savedCount !== players.length;
  const missing = byTeam.filter((x) => !x.players.some((p) => squad[p.id] === "starter"));
  const problems = byTeam.flatMap((x) => squadProblems(x.players, squad, starterLimit, t));
  const canSave = !pending && dirty && !missing.length && !problems.length;

  const submit = () => start(async () => {
    setError(null);
    try {
      await saveMatchSquad(matchId, players.map((p) => p.id), starters);
      toast.success(t("Pemain pertandingan disimpan"), t("{starters} starter · {subs} cadangan", { starters: starters.length, subs: players.length - starters.length }));
    } catch (e) { setError(e instanceof Error ? e.message : t("Gagal menyimpan pemain")); }
  });

  return <Card id="pemain" className="scroll-mt-24">
    <CardHeader className="flex-wrap">
      <div>
        <CardTitle className="flex items-center gap-2"><Users className="size-4" /> {t("Pilih pemain pertandingan")}</CardTitle>
        <CardDescription className="mt-1">{rich(t("Ketuk pemain untuk menjadikannya <b>starter</b>. Pemain yang tidak dipilih otomatis menjadi <b>cadangan</b>."), { b: (c) => <strong className="font-semibold text-ink">{c}</strong> })}</CardDescription>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
        {byTeam.map(({ team, players: list }) => {
          const n = list.filter((p) => squad[p.id] === "starter").length;
          return <span key={team.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-secondary">{team.name}: <span className="tabular-nums text-ink">{t("{starters} starter · {subs} cadangan", { starters: n, subs: list.length - n })}</span></span>;
        })}
      </div>
    </CardHeader>
    <CardContent>
      <div className="grid gap-4 xl:grid-cols-2">
        {byTeam.map(({ team, players: list }) => <TeamPlayerPicker key={team.id} benchRest disabled={pending}
          title={team.name} players={list} starterLimit={starterLimit} squadLimit={squadLimit}
          squad={Object.fromEntries(list.map((p) => [p.id, squad[p.id] ?? "substitute"] as const).filter(([, r]) => r === "starter"))}
          onChange={(next) => setSquad((old) => ({ ...Object.fromEntries(Object.entries(old).filter(([id]) => !list.some((p) => p.id === id))), ...next }))} />)}
      </div>
      <p className="mt-3 text-xs text-ink-muted">{t("Perubahan starter membatalkan status submit DSP tim yang diubah agar pelatih dapat meninjaunya kembali.")}</p>
      {missing.length > 0 && <p role="status" className="mt-2 text-xs font-medium text-warn">{t("Pilih minimal satu starter untuk {teams}.", { teams: missing.map((x) => x.team.name).join(t(" dan ")) })}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={!canSave}>
          {pending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
          {pending ? t("Menyimpan…") : t("Simpan pemain")}
        </Button>
        {!dirty && !missing.length && <span className="text-[11px] text-ink-muted">{t("Tersimpan.")}</span>}
        {dirty && <span className="text-[11px] font-medium text-warn">{t("Ada perubahan yang belum disimpan.")}</span>}
      </div>
    </CardContent>
  </Card>;
}
