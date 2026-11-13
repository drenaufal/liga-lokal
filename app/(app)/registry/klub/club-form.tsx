"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { createClub, updateClub } from "./actions";
import type { FormState } from "@/lib/form";
import type { Club } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/input";
import { ImageUpload } from "@/components/app/image-upload";
import { useT } from "@/lib/i18n/client";

export function ClubForm({ club }: { club?: Club }) {
  const t = useT();
  const action = club ? updateClub.bind(null, club.id) : createClub;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  const sv = state?.values ?? {};
  const val = (key: keyof Club & string, fallback = "") => {
    if (key in sv) return sv[key];
    const v = club?.[key];
    return v == null ? fallback : String(v);
  };

  return (
    <form action={formAction} className="space-y-6">
      <Section title={t("Identitas")}>
        <div className="sm:col-span-2">
          <ImageUpload
            name="logoUrl"
            label={t("Logo SSB")}
            displayName={club?.shortName ?? "SSB"}
            shape="square"
            fit="contain"
            defaultValue={club?.logoUrl}
            hint={t("PNG transparan paling rapi · JPG/WEBP juga bisa · maks 5 MB")}
          />
          {fe.logoUrl && <p className="mt-1 text-[11px] text-danger">{fe.logoUrl}</p>}
        </div>
        <Field label={t("Nama SSB")} error={fe.name} className="sm:col-span-2">
          <Input name="name" required defaultValue={val("name")} placeholder={t("mis. SSB Garuda Muda")} />
        </Field>
        <Field label={t("Singkatan")} error={fe.shortName} hint={t("2–8 karakter, tampil di papan skor")}>
          <Input
            name="shortName"
            required
            maxLength={8}
            defaultValue={val("shortName")}
            placeholder="GMF"
            className="font-mono uppercase"
          />
        </Field>
        <Field label={t("Jenis")} error={fe.type}>
          <Select name="type" defaultValue={val("type", "club")}>
            <option value="club">{t("Klub")}</option>
            <option value="academy">{t("Akademi / SSB")}</option>
          </Select>
        </Field>
        <Field label={t("Tahun berdiri")} error={fe.foundedYear}>
          <Input name="foundedYear" type="number" min={1900} max={new Date().getFullYear()} defaultValue={val("foundedYear")} />
        </Field>
      </Section>

      <Section title={t("Afiliasi PSSI")}>
        <Field label="Askot" error={fe.askot} hint={t("Asosiasi Kota tempat SSB bernaung — isian bebas")}>
          <Input name="askot" defaultValue={val("askot")} placeholder={t("mis. Askot PSSI Depok")} />
        </Field>
        <Field label="Asprov" error={fe.asprov} hint={t("Asosiasi Provinsi — isian bebas")}>
          <Input name="asprov" defaultValue={val("asprov")} placeholder={t("mis. Asprov PSSI Jawa Barat")} />
        </Field>
      </Section>

      <Section title={t("Lokasi")}>
        <Field label={t("Alamat SSB")} error={fe.address} className="sm:col-span-2">
          <Textarea
            name="address"
            rows={3}
            maxLength={500}
            defaultValue={val("address")}
            placeholder={t("Jalan, nomor, kelurahan, kecamatan, kode pos")}
          />
        </Field>
        <Field label={t("Kota")} error={fe.city}>
          <Input name="city" required defaultValue={val("city")} placeholder={t("mis. Depok")} />
        </Field>
        <Field label={t("Provinsi")} error={fe.province}>
          <Input name="province" defaultValue={val("province")} placeholder={t("mis. Jawa Barat")} />
        </Field>
      </Section>

      <Section title={t("Kontak sekretariat")}>
        <Field label={t("Nama kontak")} error={fe.contactName}>
          <Input name="contactName" defaultValue={val("contactName")} />
        </Field>
        <Field label={t("Telepon")} error={fe.contactPhone}>
          <Input name="contactPhone" defaultValue={val("contactPhone")} placeholder="08xx" />
        </Field>
        <Field label="Email" error={fe.contactEmail} className="sm:col-span-2">
          <Input name="contactEmail" type="email" defaultValue={val("contactEmail")} placeholder="sekretariat@ssb.or.id" />
        </Field>
      </Section>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : club ? <Save /> : <Plus />}
          {club ? t("Simpan perubahan") : t("Daftarkan SSB")}
        </Button>
        {club && (
          <Button variant="ghost" href={`/registry/klub/${club.id}`}>
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
