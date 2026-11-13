"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ClipboardList, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { saveDsp } from "./actions";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PersonPicker, type PickerItem } from "@/components/app/person-picker";
import { TeamPlayerPicker, squadProblems, type SquadMap } from "@/components/app/team-player-picker";
import { toast } from "@/components/ui/toaster";
import type { DspSelection } from "@/lib/dsp";
import { useI18n } from "@/lib/i18n/client";

/** A coach fills the DSP under their own account; an admin picks the responsible coach. */
export type DspCoach =
  | { kind: "self"; name: string; photo?: string | null; detail?: string | null }
  | { kind: "pick"; options: PickerItem[]; initialId: string | null; fallbackName: string };

export function DspForm({ matchId, clubId, clubName, coach, players, initial, submission, locked, rules }: {
  matchId: string; clubId?: string; clubName: string; coach: DspCoach;
  players: { id: string; name: string; position: string; jersey: number | null }[];
  initial: DspSelection[]; submission: { coachName: string; submittedAt: string } | null;
  locked: boolean; rules?: { playersOnField: number; maxSquad: number } | null;
}) {
  const { t, fmt } = useI18n();
  const [squad, setSquad] = useState<SquadMap>(() => Object.fromEntries(initial.map((s) => [s.playerId, s.role])));
  const [coachId, setCoachId] = useState(coach.kind === "pick" ? coach.initialId : null);
  const [manualName, setManualName] = useState(coach.kind === "pick" ? coach.fallbackName : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const entries = Object.entries(squad);
  const starters = entries.filter(([, r]) => r === "starter").length;
  const problems = squadProblems(players, squad, rules?.playersOnField, t);
  const overSquad = !!rules && entries.length > rules.maxSquad;
  const needsManual = coach.kind === "pick" && !coach.options.length;
  const hasCoach = coach.kind === "self" || (needsManual ? manualName.trim().length >= 2 : !!coachId);
  const blocker = locked ? t("DSP terkunci") : !starters ? t("Pilih minimal satu starter") : problems[0] ?? (overSquad ? t("Maksimal {n} pemain", { n: rules!.maxSquad }) : !hasCoach ? t("Pilih pelatih penanggung jawab") : null);

  const submit = () => start(async () => {
    setError("");
    try {
      await saveDsp({
        matchId,
        ...(clubId ? { clubId } : {}),
        ...(coach.kind === "pick" ? (needsManual ? { coachName: manualName.trim() } : { coachId: coachId! }) : {}),
        selections: entries.map(([playerId, role]) => ({ playerId, role })),
      });
      toast.success(t("DSP berhasil disubmit"), t("{starters} starter · {subs} cadangan", { starters, subs: entries.length - starters }));
    } catch (e) { setError(e instanceof Error ? e.message : t("Gagal submit DSP")); }
  });

  return <Card>
    <CardHeader className="flex-wrap">
      <div>
        <CardTitle className="flex items-center gap-2"><ClipboardList className="size-4" /> {t("Form DSP · {club}", { club: clubName })}</CardTitle>
        <CardDescription className="mt-1">{locked ? t("Pertandingan sudah dimulai. DSP terkunci.") : t("Pilih starter dan cadangan dari klub. DSP dapat direvisi sampai pertandingan dimulai.")}</CardDescription>
      </div>
      {locked ? <Badge tone="neutral"><LockKeyhole className="size-3" /> {t("Terkunci")}</Badge>
        : submission ? <Badge tone="success"><CheckCircle2 className="size-3" /> {t("Sudah submit · {date}", { date: fmt.dateTime(submission.submittedAt) })}</Badge>
        : <Badge tone="warn" dot>{t("Belum disubmit")}</Badge>}
    </CardHeader>
    <CardContent className="space-y-5">
      {/* Who is responsible */}
      {coach.kind === "self" ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-3.5 py-3">
          <Avatar src={coach.photo} name={coach.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{t("Pelatih penanggung jawab")}</p>
            <p className="truncate text-sm font-bold text-ink">{coach.name}</p>
            {coach.detail && <p className="truncate text-[11px] text-ink-secondary">{coach.detail}</p>}
          </div>
          <Badge tone="brand"><ShieldCheck className="size-3" /> {t("Akun Anda")}</Badge>
        </div>
      ) : needsManual ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary"><UserRound className="size-3.5" /> {t("Pelatih penanggung jawab")}</p>
          <Input aria-label={t("Nama pelatih")} value={manualName} onChange={(e) => setManualName(e.target.value)} maxLength={200} disabled={pending || locked} placeholder={t("Ketik nama pelatih")} />
          <p className="text-[11px] text-ink-muted">{t("Belum ada pelatih terdaftar untuk SSB ini. Tambahkan pelatih di Registry → Pelatih agar bisa dipilih.")}</p>
        </div>
      ) : (
        <PersonPicker mode="single" legend={t("Pelatih penanggung jawab")} icon={<UserRound className="size-3.5" />}
          items={coach.options} value={coachId ? [coachId] : []} onChange={([id]) => setCoachId(id ?? null)}
          disabled={pending || locked} noneLabel={t("Pilih pelatih SSB ini")} placeholder={t("Cari nama pelatih…")} maxListHeight="max-h-52"
          help={t("Admin dapat mengisi DSP atas nama pelatih SSB.")} />
      )}

      <fieldset disabled={pending || locked} className="min-w-0">
        <legend className="sr-only">{t("Susunan pemain")}</legend>
        <TeamPlayerPicker title={t("Pemain {club}", { club: clubName })} players={players} squad={squad} onChange={setSquad}
          starterLimit={rules?.playersOnField} squadLimit={rules?.maxSquad} disabled={pending || locked} />
      </fieldset>

      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || !!blocker} onClick={submit}>
          {pending ? <Loader2 className="animate-spin" /> : locked ? <LockKeyhole className="size-4" /> : <CheckCircle2 className="size-4" />}
          {pending ? t("Menyimpan…") : locked ? t("DSP terkunci") : submission ? t("Submit revisi DSP") : t("Submit DSP")}
        </Button>
        {blocker && !locked && <span className="text-[11px] font-medium text-warn">{blocker}</span>}
      </div>
    </CardContent>
  </Card>;
}
