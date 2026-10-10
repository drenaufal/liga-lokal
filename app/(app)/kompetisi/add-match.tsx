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
 * "Tambah Pertandingan": schedules one match by hand. With several KUs (the
 * Turnamen's schedule) a picker chooses which KU it is for; the SSBs on offer
 * and the stages follow that KU.
 */
export function AddMatch({
  kus,
  options,
  variant = "primary",
}: {
  kus: AddMatchKu[];
  options: AddMatchOptions;
  variant?: "outline" | "primary";
}) {
  const [isOpen, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const writable = kus.filter((k) => k.status !== "archived");
  const [kuId, setKuId] = React.useState(writable[0]?.id ?? "");
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

  const submit = () =>
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
        if (res.warnings.length) toast.warn("Pertandingan ditambahkan", res.warnings.join(" · "));
        else toast.success("Pertandingan ditambahkan");
        setOpen(false);
        // keep the KU and date for the next one, clear who plays
        setForm((f) => ({ ...f, homeClubId: "", awayClubId: "", bracketSlot: "" }));
        setErrors({});
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Gagal menambah pertandingan");
      }
    });

  const teams = ku?.teams ?? [];
  const isCup = ku?.format === "cup";
  const disabledReason =
    writable.length === 0
      ? "Semua KU sudah diarsipkan"
      : kus.every((k) => k.teams.length < 2)
        ? "Tambahkan minimal 2 SSB peserta dahulu"
        : null;

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined}>
        <CalendarPlus className="size-3.5" /> Tambah Pertandingan
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
          title="Tambah Pertandingan"
          description="Susun jadwal satu pertandingan. Waktu dibaca sebagai WIB; wasit dan venue boleh diisi nanti."
          className="max-w-xl"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {writable.length > 1 && (
                <Field label="KU" className="sm:col-span-2">
                  <Select value={ku?.id ?? ""} onChange={(e) => changeKu(e.target.value)} aria-label="Pilih KU">
                    {writable.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="Tuan rumah" error={errors.homeClubId}>
                <Select value={form.homeClubId} onChange={(e) => set("homeClubId", e.target.value)}>
                  <option value="">Pilih SSB…</option>
                  {teams.map((t) => (
                    <option key={t.clubId} value={t.clubId} disabled={t.clubId === form.awayClubId}>
                      {t.name} ({t.short})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tamu" error={errors.awayClubId}>
                <Select value={form.awayClubId} onChange={(e) => set("awayClubId", e.target.value)}>
                  <option value="">Pilih SSB…</option>
                  {teams.map((t) => (
                    <option key={t.clubId} value={t.clubId} disabled={t.clubId === form.homeClubId}>
                      {t.name} ({t.short})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tanggal" error={errors.date}>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Jam kick-off (WIB)" error={errors.time}>
                <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
              </Field>

              <Field label="Fase" error={errors.stage}>
                <Select value={stage} onChange={(e) => setStage(e.target.value)}>
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s] ?? s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={isCup ? "Putaran" : "Pekan"}
                error={errors.round}
                hint={isCup ? "Putaran 1 = babak pertama" : undefined}
              >
                <Input type="number" min={1} max={99} value={form.round} onChange={(e) => set("round", e.target.value)} />
              </Field>

              <Field label="Venue (opsional)" error={errors.venueId}>
                <Select value={form.venueId} onChange={(e) => set("venueId", e.target.value)}>
                  <option value="">Belum ditentukan</option>
                  {options.venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.city}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Wasit (opsional)" error={errors.refereeId}>
                <Select value={form.refereeId} onChange={(e) => set("refereeId", e.target.value)}>
                  <option value="">Belum ditugaskan</option>
                  {options.referees.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.level})
                    </option>
                  ))}
                </Select>
              </Field>

              {isCup && (
                <Field
                  label="Slot bagan (opsional)"
                  error={errors.bracketSlot}
                  hint="Mis. QF1, SF2, F1 — memosisikan pertandingan di Bagan Cup"
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

            {formError && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={submit} disabled={pending || !ku}>
                {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus className="size-4" />}
                Simpan pertandingan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
