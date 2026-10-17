"use client";

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, UserPlus } from "lucide-react";
import { createOperator, updateOperator } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export type OperatorData = { id: string; name: string; email: string; active: boolean };

export function OperatorForm({ operator, onDone }: { operator?: OperatorData; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(operator ? updateOperator.bind(null, operator.id) : createOperator, undefined);
  const fe = state?.fieldErrors ?? {};
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state) {
      toast.success(operator ? "Akun operator diperbarui" : "Akun operator dibuat");
      if (onDone) onDone();
      else if (!operator) router.push("/registry/operator");
    }
    wasPending.current = pending;
  }, [pending, state, operator, onDone, router]);

  return (
    <form action={action} className="space-y-6">
      <Section title="Identitas">
        <Field label="Nama operator" error={fe.name} className="sm:col-span-2">
          <Input name="name" defaultValue={state?.values?.name ?? operator?.name} required minLength={2} maxLength={200} placeholder="mis. Andi Pratama" />
        </Field>
      </Section>

      <Section title="Akun login">
        <Field label="Email" error={fe.email}>
          <Input name="email" type="email" autoComplete="off" defaultValue={state?.values?.email ?? operator?.email} required maxLength={255} placeholder="nama@email.com" />
        </Field>
        <Field
          label={operator ? "Kata sandi baru" : "Kata sandi"}
          error={fe.password}
          hint={operator ? "Kosongkan untuk mempertahankan kata sandi. Minimal 8 karakter jika diubah." : "Minimal 8 karakter."}
        >
          <Input name="password" type="password" autoComplete="new-password" required={!operator} minLength={8} maxLength={72} />
        </Field>
        {!operator && (
          <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-[11px] leading-relaxed text-ink-muted sm:col-span-2">
            Operator masuk memakai <strong className="text-ink-secondary">email dan kata sandi</strong> ini untuk mencatat jalannya pertandingan.
          </p>
        )}
      </Section>

      <Section title="Status">
        <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
          <input name="active" type="checkbox" defaultChecked={state?.values ? state.values.active === "on" : operator?.active ?? true} />
          Akun aktif
        </label>
      </Section>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : operator ? <Save /> : <UserPlus />}
          {pending ? "Menyimpan…" : operator ? "Simpan perubahan" : "Buat akun operator"}
        </Button>
        {!operator && (
          <Button variant="ghost" href="/registry/operator">
            Batal
          </Button>
        )}
      </div>
    </form>
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
