"use client";

import { useActionState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { changePassword, type PasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";

export function ChangePasswordForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changePassword, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Field label={t("Kata sandi saat ini")} error={fe.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} />
      </Field>
      <Field label={t("Kata sandi baru")} hint={t("Minimal 8 karakter.")} error={fe.newPassword}>
        <Input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Field label={t("Ulangi kata sandi baru")} error={fe.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>

      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
      )}
      {state?.done && (
        <p role="status" className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="size-3.5" /> {t("Kata sandi berhasil diubah.")}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {t("Simpan kata sandi")}
      </Button>
    </form>
  );
}
