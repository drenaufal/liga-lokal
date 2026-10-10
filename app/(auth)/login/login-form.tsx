"use client";

import * as React from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { LogoChip } from "@/components/brand/logo";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/command-center";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );
  const [email, setEmail] = React.useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = React.useState(DEMO_PASSWORD);

  return (
    <div className="w-full max-w-md">
      <LogoChip className="mb-8 lg:hidden" logoClassName="h-12" />
      <h1 className="font-display text-5xl uppercase leading-[0.95] tracking-wide text-ink">
        Masuk ke platform
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Gunakan kredensial operasional Anda untuk mengakses ruang kerja.
      </p>

      <form action={formAction} className="mt-8 space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line/80">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Kata sandi">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {state?.error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
          Masuk
        </Button>
      </form>

      <div className="mt-5 rounded-3xl bg-night p-5 text-white">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-night-muted">
          <ShieldCheck className="size-3.5" />
          Akun demo — klik untuk mengisi
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {DEMO_ACCOUNTS.map((a) => {
            const on = a.email === email;
            return (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className={cn(
                  "rounded-2xl px-3 py-2 text-left transition-colors",
                  on ? "bg-brand" : "bg-night-2 hover:bg-night-line",
                )}
              >
                <span className="block text-xs font-semibold text-white">{ROLE_LABEL[a.role]}</span>
                <span className={cn("block truncate text-[10px]", on ? "text-white" : "text-night-muted")}>
                  {a.email}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-night-muted">
          Kata sandi semua akun demo:{" "}
          <code className="rounded-md bg-night-2 px-1.5 py-0.5 font-mono text-white">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </div>
  );
}
