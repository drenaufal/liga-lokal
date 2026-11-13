"use client";

import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Save, UserPlus } from "lucide-react";
import { createUser, updateUser } from "./actions";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/auth/rbac";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/lib/i18n/client";

export type UserData = { id: string; name: string; email: string; title: string | null; role: Role; active: boolean };

function UserForm({ user, isSelf, viewerIsAdmin, onDone }: {
  user?: UserData; isSelf?: boolean; viewerIsAdmin: boolean; onDone: () => void;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(user ? updateUser.bind(null, user.id) : createUser, undefined);
  const fe = state?.fieldErrors ?? {};
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state) {
      toast.success(user ? t("Pengguna diperbarui") : t("Pengguna ditambahkan"));
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, user, onDone, t]);

  // own account, coach accounts and the hidden Super Admin keep their role
  const roleLocked = !!user && (isSelf || !(ASSIGNABLE_ROLES as readonly string[]).includes(user.role));
  const roles: Role[] = ASSIGNABLE_ROLES.filter((r) => r !== "admin" || viewerIsAdmin || user?.role === "admin");
  const [role, setRole] = useState<Role>((state?.values?.role as Role) ?? user?.role ?? "viewer");
  const shownRoles = roles.includes(role) ? roles : [role, ...roles];

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <Section title={t("Identitas")}>
          <Field label={t("Nama lengkap")} error={fe.name} className="sm:col-span-2">
            <Input name="name" required minLength={2} maxLength={200} defaultValue={state?.values?.name ?? user?.name} placeholder={t("mis. Andi Pratama")} />
          </Field>
          <Field label={t("Jabatan")} error={fe.title} hint={t("Opsional, mis. Sekretaris Panitia.")} className="sm:col-span-2">
            <Input name="title" maxLength={120} defaultValue={state?.values?.title ?? user?.title ?? ""} />
          </Field>
        </Section>

        <Section title={t("Akun login")}>
          <Field label={t("Email")} error={fe.email} hint={isSelf ? t("Email akun yang sedang Anda pakai tidak dapat diubah di sini.") : undefined}>
            <Input name="email" type="email" autoComplete="off" required maxLength={255} readOnly={isSelf} defaultValue={state?.values?.email ?? user?.email} />
          </Field>
          <Field
            label={user ? t("Kata sandi baru") : t("Kata sandi")}
            error={fe.password}
            hint={user ? t("Kosongkan untuk mempertahankan. Minimal 8 karakter jika diubah.") : t("Minimal 8 karakter.")}
          >
            <Input name="password" type="password" autoComplete="new-password" required={!user} minLength={8} maxLength={72} />
          </Field>
        </Section>

        <Section title={t("Peran & status")}>
          <Field
            label={t("Peran")}
            error={fe.role}
            hint={roleLocked ? (isSelf ? t("Anda tidak dapat mengubah peran akun sendiri.") : t("Peran akun ini tidak dapat diubah dari sini.")) : t(ROLE_DESCRIPTION[role])}
            className="sm:col-span-2"
          >
            <Select name={roleLocked ? undefined : "role"} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={roleLocked}>
              {shownRoles.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
            <input name="active" type="checkbox" disabled={isSelf} defaultChecked={state?.values ? state.values.active === "on" : user?.active ?? true} />
            {t("Akun aktif")}
            {isSelf && <span className="font-normal text-ink-muted">{t("· akun sendiri tidak dapat dinonaktifkan")}</span>}
          </label>
        </Section>
      </fieldset>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : user ? <Save /> : <UserPlus />}
          {pending ? t("Menyimpan…") : user ? t("Simpan perubahan") : t("Tambah pengguna")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>{t("Batal")}</Button>
      </div>
    </form>
  );
}

export function UserCreate({ viewerIsAdmin }: { viewerIsAdmin: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="size-3.5" /> {t("Tambah pengguna")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("Tambah pengguna")} description={t("Buat akun login baru dan tentukan perannya.")}>
          <div className="p-6"><UserForm viewerIsAdmin={viewerIsAdmin} onDone={() => setOpen(false)} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UserEdit({ user, isSelf, viewerIsAdmin }: { user: UserData; isSelf: boolean; viewerIsAdmin: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="size-3.5" /> {t("Ubah")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("Ubah pengguna")} description={t("Ubah data akun, peran, kata sandi, atau status.")}>
          <div className="p-6"><UserForm user={user} isSelf={isSelf} viewerIsAdmin={viewerIsAdmin} onDone={() => setOpen(false)} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
