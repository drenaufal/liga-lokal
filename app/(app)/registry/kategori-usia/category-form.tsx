"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { createCategory, updateCategory } from "./actions";
import { MAX_CATEGORY_AGE, MIN_CATEGORY_AGE, type CategoryDefaults } from "./shared";
import type { FormState } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/input";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/client";

export function CategoryForm({
  categoryId,
  defaults,
}: {
  /** Present when editing. */
  categoryId?: string;
  defaults: CategoryDefaults;
}) {
  const t = useT();
  const action = categoryId ? updateCategory.bind(null, categoryId) : createCategory;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  const sv = state?.values ?? {};
  const val = (key: keyof CategoryDefaults) => (key in sv ? sv[key] : String(defaults[key]));

  const [maxAge, setMaxAge] = React.useState(Number(val("maxAge")));
  const [half, setHalf] = React.useState(Number(val("halfDuration")));
  const year = new Date().getFullYear();
  const ageOk = maxAge >= MIN_CATEGORY_AGE && maxAge <= MAX_CATEGORY_AGE;

  return (
    <form action={formAction} className="space-y-6">
      <Section title={t("Kelompok umur")}>
        <Field label={t("Kode")} error={fe.code} hint={t("Tampil di daftar pemain & kompetisi")}>
          <Input name="code" required maxLength={12} defaultValue={val("code")} placeholder="KU-18" className="font-mono uppercase" />
        </Field>
        <Field label={t("Nama kategori")} error={fe.label}>
          <Input name="label" required defaultValue={val("label")} placeholder="Kelompok Umur 18" />
        </Field>
        <Field
          label={t("Usia maksimal")}
          error={fe.maxAge}
          hint={t("{min}–{max} tahun", { min: MIN_CATEGORY_AGE, max: MAX_CATEGORY_AGE })}
        >
          <Input
            name="maxAge"
            type="number"
            required
            min={MIN_CATEGORY_AGE}
            max={MAX_CATEGORY_AGE}
            defaultValue={val("maxAge")}
            onChange={(e) => setMaxAge(Number(e.target.value))}
          />
        </Field>
        <p className="rounded-lg border border-line-soft bg-surface-2/40 px-3 py-2 text-[11px] text-ink-muted sm:col-span-2">
          {ageOk ? (
            <>
              {rich(t("Pemain kelahiran <b>{year}</b> atau setelahnya (usia ≤ {age} tahun) boleh bermain di kategori ini (acuan musim {season}).", { year: year - maxAge, age: maxAge, season: year }), {
                b: (c) => <strong className="text-ink">{c}</strong>,
              })}
            </>
          ) : (
            <>{t("Usia maksimal harus antara {min} dan {max} tahun.", { min: MIN_CATEGORY_AGE, max: MAX_CATEGORY_AGE })}</>
          )}
        </p>
      </Section>

      <Section title={t("Aturan pertandingan")}>
        <Field label={t("Durasi per babak (menit)")} error={fe.halfDuration} hint={half > 0 ? t("Total {n} menit (2 babak)", { n: half * 2 }) : undefined}>
          <Input
            name="halfDuration"
            type="number"
            required
            min={5}
            max={60}
            defaultValue={val("halfDuration")}
            onChange={(e) => setHalf(Number(e.target.value))}
          />
        </Field>
        <Field label={t("Pemain di lapangan (per tim)")} error={fe.playersOnField}>
          <Input name="playersOnField" type="number" required min={4} max={11} defaultValue={val("playersOnField")} />
        </Field>
        <Field label={t("Skuad maksimal")} error={fe.maxSquad}>
          <Input name="maxSquad" type="number" required min={5} max={40} defaultValue={val("maxSquad")} />
        </Field>
        <Field label={t("Ukuran bola")} error={fe.ballSize}>
          <Select name="ballSize" defaultValue={val("ballSize")}>
            <option value="3">No. 3</option>
            <option value="4">No. 4</option>
            <option value="5">No. 5</option>
          </Select>
        </Field>
        <Field label={t("Pergantian pemain")} error={fe.substitutions} className="sm:col-span-2">
          <Input name="substitutions" required defaultValue={val("substitutions")} placeholder={t("mis. Maksimal 5 pemain (3 kesempatan)")} />
        </Field>
        <Field label={t("Lapangan::jenis")} error={fe.fieldType} className="sm:col-span-2">
          <Input name="fieldType" required defaultValue={val("fieldType")} placeholder={t("mis. Lapangan penuh")} />
        </Field>
        <Field label={t("Catatan aturan khusus")} error={fe.notes} hint={t("Satu aturan per baris")} className="sm:col-span-2">
          <Textarea name="notes" defaultValue={val("notes")} placeholder={t("Aturan pertandingan mengikuti Laws of the Game\nKartu akumulatif berlaku")} />
        </Field>
      </Section>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : categoryId ? <Save /> : <Plus />}
          {categoryId ? t("Simpan perubahan") : t("Tambah kategori")}
        </Button>
        <Button variant="ghost" href="/registry/kategori-usia">
          {t("Batal")}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
