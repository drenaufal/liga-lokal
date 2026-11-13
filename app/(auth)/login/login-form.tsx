"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { LogoChip } from "@/components/brand/logo";
import { safeNextPath } from "@/lib/auth/redirect";
import { useT } from "@/lib/i18n/client";

/* Sizes follow the viewport height so the whole form always fits one screen. */
const labelClass = "mb-0 text-sm font-bold text-ink";
const inputClass = "mt-1.5 h-[clamp(2.6rem,6vh,3.2rem)] rounded-2xl px-5 text-base";

export function LoginForm() {
  const t = useT();
  const params = useSearchParams();
  // Only a same-origin relative path is carried through; the server action checks it again.
  const next = safeNextPath(params.get("next")) ?? "";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <div className="relative z-[1] m-auto w-full max-w-[34rem]">
      <LogoChip className="mb-6 lg:hidden" logoClassName="h-12" />
      <div className="px-2">
        <h1 className="font-headline text-[clamp(2.4rem,min(4vw,6.8vh),4.4rem)] uppercase leading-[0.95] text-ink">
          {t("Masuk ke platform")}
        </h1>
        <p className="mt-2 max-w-[30rem] text-sm font-semibold leading-snug text-ink-muted lg:text-base">
          {t("Gunakan kredensial operasional Anda untuk mengakses ruang kerja.")}
        </p>
      </div>

      <form
        action={formAction}
        className="mt-[clamp(0.75rem,2.4vh,1.5rem)] space-y-[clamp(0.6rem,1.8vh,1rem)] rounded-[2rem] bg-surface p-[clamp(1rem,2.6vh,1.75rem)] shadow-[0_24px_48px_-28px_rgba(20,20,20,0.3)] ring-1 ring-black/5"
      >
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email" className={labelClass}>Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            placeholder={t("nama@email.com")}
            defaultValue={state?.email ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="password" className={labelClass}>{t("Kata sandi")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            placeholder={t("Masukkan kata sandi Anda")}
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" className="h-[clamp(2.75rem,6.4vh,3.4rem)] w-full text-base font-bold" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn className="!size-5" />}
          {t("Masuk")}
        </Button>
      </form>
    </div>
  );
}
