"use client";

import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Pencil, Plus, Save, UserPlus } from "lucide-react";
import { createLoginAction, createUnitAction, updateLoginAction, updateUnitAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/lib/i18n/client";

export type UnitData = { id: string; code: string; name: string; description: string | null; programWeeks: number; active: boolean };
export type LoginData = { userId: string; name: string; email: string; active: boolean };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</legend>
      {hint && <p className="mb-3 mt-1 text-[11px] text-ink-muted">{hint}</p>}
      <div className={`grid gap-4 sm:grid-cols-2 ${hint ? "" : "mt-3"}`}>{children}</div>
    </fieldset>
  );
}

/** Shared wiring: run the action, toast and close on success, show the error otherwise. */
function useFormAction(
  action: (prev: import("@/lib/form").FormState, data: FormData) => Promise<import("@/lib/form").FormState>,
  successMessage: string,
  onDone: () => void,
) {
  const [state, run, pending] = useActionState(action, undefined);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state) {
      toast.success(successMessage);
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, successMessage, onDone]);
  return { state, run, pending, fe: state?.fieldErrors ?? {}, val: (key: string, fallback = "") => state?.values?.[key] ?? fallback };
}

function Footer({ pending, saveLabel, error, onCancel }: { pending: boolean; saveLabel: string; error?: string; onCancel: () => void }) {
  const t = useT();
  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {pending ? t("Menyimpan…") : saveLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          {t("Batal")}
        </Button>
      </div>
    </>
  );
}

function LoginFields({ fe, val, existing, prefix = "" }: { fe: Record<string, string>; val: (k: string, f?: string) => string; existing?: LoginData; prefix?: string }) {
  const t = useT();
  const name = (n: string) => (prefix ? `${prefix}${n[0].toUpperCase()}${n.slice(1)}` : n);
  return (
    <>
      <Field label={t("Nama akun")} error={fe[name("name")]} hint={t("mis. Admin Unit Parfum")}>
        <Input name={name("name")} maxLength={200} defaultValue={val(name("name"), existing?.name ?? "")} required={!prefix} />
      </Field>
      <Field label={t("Email login")} error={fe[name("email")]}>
        <Input name={name("email")} type="email" autoComplete="off" maxLength={255} defaultValue={val(name("email"), existing?.email ?? "")} required={!prefix} />
      </Field>
      <Field
        label={existing ? t("Kata sandi baru") : t("Kata sandi")}
        error={fe[name("password")]}
        hint={existing ? t("Kosongkan untuk mempertahankan. Minimal 8 karakter jika diubah.") : t("Minimal 8 karakter.")}
        className="sm:col-span-2"
      >
        <Input name={name("password")} type="password" autoComplete="new-password" minLength={8} maxLength={72} required={!existing && !prefix} />
      </Field>
    </>
  );
}

function UnitCreateForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { state, run, pending, fe, val } = useFormAction(createUnitAction, t("Unit bisnis ditambahkan"), onDone);
  return (
    <form action={run} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <Section title={t("Unit bisnis")}>
          <Field label={t("Nama unit")} error={fe.name}>
            <Input name="name" required maxLength={120} defaultValue={val("name")} placeholder={t("mis. Parfum")} />
          </Field>
          <Field label={t("Kode")} error={fe.code} hint={t("Huruf/angka tanpa spasi; dipakai di tautan filter. Tidak dapat diubah.")}>
            <Input name="code" required maxLength={24} defaultValue={val("code")} placeholder="PARFUM" className="uppercase" />
          </Field>
          <Field label={t("Minggu program")} error={fe.programWeeks} hint={t("Berapa minggu pertandingan berjalan. Dipakai untuk RAB dan kisi match fee.")}>
            <Input name="programWeeks" type="number" min={1} max={52} required defaultValue={val("programWeeks", "10")} />
          </Field>
          <Field label={t("Keterangan")} error={fe.description} hint={t("Opsional")}>
            <Textarea name="description" rows={2} maxLength={300} defaultValue={val("description")} />
          </Field>
        </Section>
        <Section title={t("Akun login pertama")} hint={t("Opsional. Akun ini hanya bisa melihat dan mengisi data unit ini. Login tambahan bisa dibuat nanti.")}>
          <LoginFields fe={fe} val={val} prefix="login" />
        </Section>
      </fieldset>
      <Footer pending={pending} saveLabel={t("Tambah unit bisnis")} error={state?.error} onCancel={onDone} />
    </form>
  );
}

export function UnitCreate() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> {t("Tambah unit bisnis")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl" title={t("Tambah unit bisnis")} description={t("Daftarkan unit bisnis baru beserta akun loginnya.")}>
          <UnitCreateForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function UnitEditForm({ unit, onDone }: { unit: UnitData; onDone: () => void }) {
  const t = useT();
  const { state, run, pending, fe, val } = useFormAction(updateUnitAction.bind(null, unit.id), t("Unit bisnis diperbarui"), onDone);
  return (
    <form action={run} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <Section title={unit.code}>
          <Field label={t("Nama unit")} error={fe.name}>
            <Input name="name" required maxLength={120} defaultValue={val("name", unit.name)} />
          </Field>
          <Field label={t("Minggu program")} error={fe.programWeeks}>
            <Input name="programWeeks" type="number" min={1} max={52} required defaultValue={val("programWeeks", String(unit.programWeeks))} />
          </Field>
          <Field label={t("Keterangan")} error={fe.description} className="sm:col-span-2">
            <Textarea name="description" rows={2} maxLength={300} defaultValue={val("description", unit.description ?? "")} />
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
            <input name="active" type="checkbox" defaultChecked={state?.values ? state.values.active === "on" : unit.active} />
            {t("Unit aktif")}
            <span className="font-normal text-ink-muted">{t("· unit nonaktif tidak menerima data baru")}</span>
          </label>
        </Section>
      </fieldset>
      <Footer pending={pending} saveLabel={t("Simpan perubahan")} error={state?.error} onCancel={onDone} />
    </form>
  );
}

export function UnitEdit({ unit }: { unit: UnitData }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" /> {t("Ubah unit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl" title={t("Ubah unit bisnis")} description={unit.name}>
          <UnitEditForm unit={unit} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function LoginCreateForm({ unitId, onDone }: { unitId: string; onDone: () => void }) {
  const t = useT();
  const { state, run, pending, fe, val } = useFormAction(createLoginAction.bind(null, unitId), t("Akun login ditambahkan"), onDone);
  return (
    <form action={run} className="space-y-6">
      <fieldset disabled={pending}>
        <Section title={t("Akun login")}>
          <LoginFields fe={fe} val={val} />
        </Section>
      </fieldset>
      <Footer pending={pending} saveLabel={t("Tambah akun")} error={state?.error} onCancel={onDone} />
    </form>
  );
}

export function LoginCreate({ unitId, unitName }: { unitId: string; unitName: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" /> {t("Tambah akun login")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl" title={t("Tambah akun login")} description={t("Akun ini hanya bisa melihat dan mengisi data {unit}.", { unit: unitName })}>
          <LoginCreateForm unitId={unitId} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function LoginEditForm({ login, onDone }: { login: LoginData; onDone: () => void }) {
  const t = useT();
  const { state, run, pending, fe, val } = useFormAction(updateLoginAction.bind(null, login.userId), t("Akun login diperbarui"), onDone);
  return (
    <form action={run} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <Section title={t("Akun login")}>
          <LoginFields fe={fe} val={val} existing={login} />
          <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
            <input name="active" type="checkbox" defaultChecked={state?.values ? state.values.active === "on" : login.active} />
            {t("Akun aktif")}
          </label>
        </Section>
      </fieldset>
      <Footer pending={pending} saveLabel={t("Simpan perubahan")} error={state?.error} onCancel={onDone} />
    </form>
  );
}

export function LoginEdit({ login }: { login: LoginData }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("Ubah akun login")}
        aria-label={t("Ubah akun login")}
        className="grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <KeyRound className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl" title={t("Ubah akun login")} description={login.email}>
          <LoginEditForm login={login} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
