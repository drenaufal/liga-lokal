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

export type UserData = { id: string; name: string; email: string; title: string | null; role: Role; active: boolean };

function UserForm({ user, isSelf, viewerIsAdmin, onDone }: {
  user?: UserData; isSelf?: boolean; viewerIsAdmin: boolean; onDone: () => void;
}) {
  const [state, action, pending] = useActionState(user ? updateUser.bind(null, user.id) : createUser, undefined);
  const fe = state?.fieldErrors ?? {};
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state) {
      toast.success(user ? "Pengguna diperbarui" : "Pengguna ditambahkan");
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, user, onDone]);

  // own account, coach accounts and the hidden Super Admin keep their role
  const roleLocked = !!user && (isSelf || !(ASSIGNABLE_ROLES as readonly string[]).includes(user.role));
  const roles: Role[] = ASSIGNABLE_ROLES.filter((r) => r !== "admin" || viewerIsAdmin || user?.role === "admin");
  const [role, setRole] = useState<Role>((state?.values?.role as Role) ?? user?.role ?? "viewer");
  const shownRoles = roles.includes(role) ? roles : [role, ...roles];

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
        <Section title="Identitas">
          <Field label="Nama lengkap" error={fe.name} className="sm:col-span-2">
            <Input name="name" required minLength={2} maxLength={200} defaultValue={state?.values?.name ?? user?.name} placeholder="mis. Andi Pratama" />
          </Field>
          <Field label="Jabatan" error={fe.title} hint="Opsional, mis. Sekretaris Panitia." className="sm:col-span-2">
            <Input name="title" maxLength={120} defaultValue={state?.values?.title ?? user?.title ?? ""} />
          </Field>
        </Section>

        <Section title="Akun login">
          <Field label="Email" error={fe.email} hint={isSelf ? "Email akun yang sedang Anda pakai tidak dapat diubah di sini." : undefined}>
            <Input name="email" type="email" autoComplete="off" required maxLength={255} readOnly={isSelf} defaultValue={state?.values?.email ?? user?.email} />
          </Field>
          <Field
            label={user ? "Kata sandi baru" : "Kata sandi"}
            error={fe.password}
            hint={user ? "Kosongkan untuk mempertahankan. Minimal 8 karakter jika diubah." : "Minimal 8 karakter."}
          >
            <Input name="password" type="password" autoComplete="new-password" required={!user} minLength={8} maxLength={72} />
          </Field>
        </Section>

        <Section title="Peran & status">
          <Field
            label="Peran"
            error={fe.role}
            hint={roleLocked ? (isSelf ? "Anda tidak dapat mengubah peran akun sendiri." : "Peran akun ini tidak dapat diubah dari sini.") : ROLE_DESCRIPTION[role]}
            className="sm:col-span-2"
          >
            <Select name={roleLocked ? undefined : "role"} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={roleLocked}>
              {shownRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
            <input name="active" type="checkbox" disabled={isSelf} defaultChecked={state?.values ? state.values.active === "on" : user?.active ?? true} />
            Akun aktif
            {isSelf && <span className="font-normal text-ink-muted">· akun sendiri tidak dapat dinonaktifkan</span>}
          </label>
        </Section>
      </fieldset>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : user ? <Save /> : <UserPlus />}
          {pending ? "Menyimpan…" : user ? "Simpan perubahan" : "Tambah pengguna"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>Batal</Button>
      </div>
    </form>
  );
}

export function UserCreate({ viewerIsAdmin }: { viewerIsAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="size-3.5" /> Tambah pengguna</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Tambah pengguna" description="Buat akun login baru dan tentukan perannya.">
          <div className="p-6"><UserForm viewerIsAdmin={viewerIsAdmin} onDone={() => setOpen(false)} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UserEdit({ user, isSelf, viewerIsAdmin }: { user: UserData; isSelf: boolean; viewerIsAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="size-3.5" /> Ubah</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Ubah pengguna" description="Ubah data akun, peran, kata sandi, atau status.">
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
