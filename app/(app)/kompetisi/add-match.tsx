"use client";

import * as React from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { STAGES_BY_FORMAT, defaultStage } from "@/lib/ku";
import { STAGE_LABEL } from "@/lib/status";
import { createMatch } from "./ku/[id]/actions";
import { useT } from "@/lib/i18n/client";

export type AddMatchKu = {
  id: string;
  /** "KU-14" or the full name — what the picker shows. */
  label: string;
  format: string;
  /** Older cups still have a group stage. */
  hasGroups: boolean;
  status: string;
  teams: { clubId: string; short: string; name: string }[];
};

export type AddMatchOptions = {
  venues: { id: string; name: string; city: string }[];
  referees: { id: string; name: string; level: string }[];
};

/** Tomorrow in WIB as YYYY-MM-DD — the default date of a new match. */
function tomorrowWib() {
  const d = new Date(Date.now() + 7 * 3_600_000 + 86_400_000);
  return d.toISOString().slice(0, 10);
}

const EMPTY = {
  homeClubId: "",
  awayClubId: "",
  date: "",
  time: "15:30",
  round: "1",
  venueId: "",
  refereeId: "",
  bracketSlot: "",
};

/**
 * t("Tambah Pertandingan"): schedules one match by hand. With several KUs (the
 * Turnamen's schedule) a picker chooses which KU it is for; the SSBs on offer
 * and the stages follow that KU.
 */
export function AddMatch({
  kus,
  options,
  variant = "primary",
  defaultKuId,
}: {
  kus: AddMatchKu[];
  options: AddMatchOptions;
  variant?: "outline" | "primary";
  /** The KU the picker starts on — the one the page is already filtered to. */
  defaultKuId?: string;
}) {
  const t = useT();
  const [isOpen, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const writable = kus.filter((k) => k.status !== "archived");
  const [kuId, setKuId] = React.useState((writable.find((k) => k.id === defaultKuId) ?? writable[0])?.id ?? "");
  const ku = writable.find((k) => k.id === kuId) ?? writable[0];
  const stages = ku ? [...(STAGES_BY_FORMAT[ku.format] ?? ["league"]), ...(ku.hasGroups ? ["group"] : [])] : [];
  const [stage, setStage] = React.useState(ku ? defaultStage(ku.format, ku.teams.length) : "league");
  const [form, setForm] = React.useState({ ...EMPTY, date: tomorrowWib() });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const set = (k: keyof typeof EMPTY, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  // switching KU changes who can play and which stages exist
  const changeKu = (id: string) => {
    const next = writable.find((k) => k.id === id);
    setKuId(id);
    setStage(next ? defaultStage(next.format, next.teams.length) : "league");
    setForm((f) => ({ ...f, homeClubId: "", awayClubId: "", bracketSlot: "" }));
    setErrors({});
    setFormError(null);
  };

  // `again` keeps the dialog open for the next match — a round is usually entered in one go
  const submit = (again = false) =>
    start(async () => {
      if (!ku) return;
      setFormError(null);
      try {
        const res = await createMatch(ku.id, {
          homeClubId: form.homeClubId,
          awayClubId: form.awayClubId,
          date: form.date,
          time: form.time,
          stage,
          round: Number(form.round),
          venueId: form.venueId || null,
          refereeId: form.refereeId || null,
          bracketSlot: form.bracketSlot || null,
        });
        if (!res.ok) {
          setErrors(res.fieldErrors);
          setFormError(res.error);
          return;
        }
        if (res.warnings.length) toast.warn(t("Pertandingan ditambahkan"), res.warnings.join(" · "));
        else toast.success(t("Pertandingan ditambahkan"));
        setOpen(again);
        // keep the KU and date for the next one, clear who plays
        setForm((f) => ({ ...f, homeClubId: "", awayClubId: "", bracketSlot: "" }));
        setErrors({});
      } catch (e) {
        setFormError(e instanceof Error ? e.message : t("Gagal menambah pertandingan"));
      }
    });

  const teams = ku?.teams ?? [];
  const isCup = ku?.format === "cup";
  const canSave = !pending && !!ku && !!form.homeClubId && !!form.awayClubId;
  const disabledReason =
    writable.length === 0
      ? t("Semua KU sudah diarsipkan")
      : kus.every((k) => k.teams.length < 2)
        ? t("Tambahkan minimal 2 SSB peserta dahulu")
        : null;

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined}>
        <CalendarPlus className="size-3.5" /> {t("Tambah Pertandingan")}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setErrors({});
            setFormError(null);
          }
        }}
      >
        <DialogContent
          title={t("Tambah Pertandingan")}
          description={t("Susun jadwal satu pertandingan. Waktu dibaca sebagai WIB; wasit dan venue boleh diisi nanti.")}
          className="max-w-xl"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {writable.length > 1 && (
                <Field label={t("KU::bidang")} className="sm:col-span-2">
                  <Select value={ku?.id ?? ""} onChange={(e) => changeKu(e.target.value)} aria-label={t("Pilih KU")}>
                    {writable.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label={t("Tuan rumah")} error={errors.homeClubId}>
                <Select value={form.homeClubId} onChange={(e) => set("homeClubId", e.target.value)}>
                  <option value="">{t("Pilih SSB…")}</option>
                  {teams.map((tm) => (
                    <option key={tm.clubId} value={tm.clubId} disabled={tm.clubId === form.awayClubId}>
                      {tm.name} ({tm.short})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("Tamu")} error={errors.awayClubId}>
                <Select value={form.awayClubId} onChange={(e) => set("awayClubId", e.target.value)}>
                  <option value="">{t("Pilih SSB…")}</option>
                  {teams.map((tm) => (
                    <option key={tm.clubId} value={tm.clubId} disabled={tm.clubId === form.homeClubId}>
                      {tm.name} ({tm.short})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t("Tanggal")} error={errors.date}>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label={t("Jam kick-off (WIB)")} error={errors.time}>
                <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
              </Field>

              <Field label={t("Fase")} error={errors.stage}>
                <Select value={stage} onChange={(e) => setStage(e.target.value)}>
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {t.dyn(STAGE_LABEL[s] ?? s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={isCup ? t("Putaran") : t("Pekan")}
                error={errors.round}
                hint={isCup ? t("Putaran 1 = babak pertama") : undefined}
              >
                <Input type="number" min={1} max={99} value={form.round} onChange={(e) => set("round", e.target.value)} />
              </Field>

              <Field label={t("Venue (opsional)")} error={errors.venueId}>
                <Select value={form.venueId} onChange={(e) => set("venueId", e.target.value)}>
                  <option value="">{t("Belum ditentukan")}</option>
                  {options.venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.city}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("Wasit (opsional)")} error={errors.refereeId}>
                <Select value={form.refereeId} onChange={(e) => set("refereeId", e.target.value)}>
                  <option value="">{t("Belum ditugaskan")}</option>
                  {options.referees.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.level})
                    </option>
                  ))}
                </Select>
              </Field>

              {isCup && (
                <Field
                  label={t("Slot bagan (opsional)")}
                  error={errors.bracketSlot}
                  hint={t("Mis. QF1, SF2, F1 — memosisikan pertandingan di Bagan Cup")}
                  className="sm:col-span-2"
                >
                  <Input
                    value={form.bracketSlot}
                    onChange={(e) => set("bracketSlot", e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="QF1"
                    className="font-mono uppercase"
                  />
                </Field>
              )}
            </div>

            {ku && teams.length < 2 && (
              <p className="rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
                {t("KU ini baru punya {n} SSB peserta. Tambahkan minimal 2 di tab Peserta dahulu.", { n: teams.length })}
              </p>
            )}

            {formError && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("Batal")}
              </Button>
              <Button variant="outline" onClick={() => submit(true)} disabled={!canSave}>
                {t("Simpan & tambah lagi")}
              </Button>
              <Button onClick={() => submit()} disabled={!canSave}>
                {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus className="size-4" />}
                {t("Simpan pertandingan")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
