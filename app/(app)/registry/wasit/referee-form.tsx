"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Save, UserPlus } from "lucide-react";
import { createReferee, updateReferee } from "./actions";
import type { FormState } from "@/lib/form";
import type { Referee } from "@/lib/db/schema";
import { REFEREE_LICENSE_LEVELS, REFEREE_SPECIALTIES, refereeSpecialtyLabel } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { ImageUpload } from "@/components/app/image-upload";
import { useT } from "@/lib/i18n/client";

export function RefereeForm({ referee }: { referee?: Referee }) {
  const t = useT();
  const action = referee ? updateReferee.bind(null, referee.id) : createReferee;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  const sv = state?.values ?? {};
  const val = (key: keyof Referee & string, fallback = "") => {
    if (key in sv) return sv[key];
    const v = referee?.[key];
    return v == null ? fallback : String(v);
  };
  const revoked = state?.values ? sv.revoked === "on" : referee?.status === "revoked";

  return (
    <form action={formAction} className="space-y-6">
      <Section title={t("Identitas")}>
        <div className="sm:col-span-2">
          <ImageUpload
            name="photoUrl"
            label={t("Foto wasit")}
            displayName={referee?.fullName ?? t("Wasit Baru")}
            defaultValue={referee?.photoUrl}
          />
          {fe.photoUrl && <p className="mt-1 text-[11px] text-danger">{fe.photoUrl}</p>}
        </div>
        <Field label={t("Nama lengkap")} error={fe.fullName} className="sm:col-span-2">
          <Input name="fullName" required defaultValue={val("fullName")} placeholder={t("mis. Rudi Hermawan")} />
        </Field>
        <Field label={t("Tanggal lahir")} error={fe.dob}>
          <Input name="dob" type="date" defaultValue={val("dob")} />
        </Field>
        <Field label={t("Kota domisili")} error={fe.city}>
          <Input name="city" defaultValue={val("city")} />
        </Field>
        <Field
          label={t("Asal Askot")}
          error={fe.askot}
          hint={t("Asosiasi Kota PSSI tempat wasit bernaung — isian bebas")}
          className="sm:col-span-2"
        >
          <Input name="askot" defaultValue={val("askot")} placeholder={t("mis. Askot PSSI Bekasi")} />
        </Field>
      </Section>

      <Section title={t("Lisensi wasit")}>
        <Field label={t("Peran")} error={fe.specialty}>
          <Select name="specialty" defaultValue={val("specialty", referee ? "" : REFEREE_SPECIALTIES[0])}>
            <option value="">—</option>
            {REFEREE_SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {refereeSpecialtyLabel(t, s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Tingkat lisensi")} error={fe.licenseLevel}>
          <Select name="licenseLevel" required defaultValue={val("licenseLevel", REFEREE_LICENSE_LEVELS[0])}>
            {REFEREE_LICENSE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t.dyn(l)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Nomor lisensi")} error={fe.licenseNumber} className="sm:col-span-2">
          <Input
            name="licenseNumber"
            required
            defaultValue={val("licenseNumber")}
            placeholder={t("mis. WST-2026-1001")}
            className="font-mono uppercase"
          />
        </Field>
        <Field label={t("Tanggal terbit")} error={fe.licenseIssuedAt}>
          <Input name="licenseIssuedAt" type="date" defaultValue={val("licenseIssuedAt")} />
        </Field>
        <Field label={t("Berlaku sampai")} error={fe.licenseExpiry} hint={t("Status Aktif / Akan Kedaluwarsa dihitung otomatis")}>
          <Input name="licenseExpiry" type="date" required defaultValue={val("licenseExpiry")} />
        </Field>
        <label className="flex items-start gap-2 rounded-lg border border-line-soft bg-surface-2/40 p-3 text-xs sm:col-span-2">
          <input
            type="checkbox"
            name="revoked"
            defaultChecked={revoked}
            className="mt-0.5 size-3.5 accent-[var(--color-danger)]"
          />
          <span>
            <span className="font-medium text-ink">{t("Lisensi dicabut")}</span>
            <span className="block text-[11px] text-ink-muted">
              {t("Tandai bila lisensi dicabut/dibekukan — wasit tidak dapat ditugaskan ke pertandingan.")}
            </span>
          </span>
        </label>
      </Section>

      <Section title={t("Kontak")}>
        <Field label={t("Telepon")} error={fe.phone}>
          <Input name="phone" defaultValue={val("phone")} placeholder="08xx" />
        </Field>
        <Field label="Email" error={fe.email}>
          <Input name="email" type="email" defaultValue={val("email")} />
        </Field>
      </Section>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : referee ? <Save /> : <UserPlus />}
          {referee ? t("Simpan perubahan") : t("Daftarkan wasit")}
        </Button>
        {referee && (
          <Button variant="ghost" href={`/registry/wasit/${referee.id}`}>
            {t("Batal")}
          </Button>
        )}
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
