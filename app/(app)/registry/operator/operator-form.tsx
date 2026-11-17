"use client";

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, Search, Trophy, UserPlus } from "lucide-react";
import { createOperator, updateOperator } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type OperatorData = { id: string; name: string; email: string; active: boolean; competitionIds: string[] };
export type CompetitionChoice = { id: string; name: string; season: string };

export function OperatorForm({ operator, competitions, onDone }: { operator?: OperatorData; competitions: CompetitionChoice[]; onDone?: () => void }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState(operator ? updateOperator.bind(null, operator.id) : createOperator, undefined);
  const fe = state?.fieldErrors ?? {};
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state) {
      toast.success(operator ? t("Akun operator diperbarui") : t("Akun operator dibuat"));
      if (onDone) onDone();
      else if (!operator) router.push("/registry/operator");
    }
    wasPending.current = pending;
  }, [pending, state, operator, onDone, router, t]);

  return (
    <form action={action} className="space-y-6">
      <Section title={t("Identitas")}>
        <Field label={t("Nama operator")} error={fe.name} className="sm:col-span-2">
          <Input name="name" defaultValue={state?.values?.name ?? operator?.name} required minLength={2} maxLength={200} placeholder={t("mis. Andi Pratama")} />
        </Field>
      </Section>

      <Section title={t("Akun login")}>
        <Field label="Email" error={fe.email}>
          <Input name="email" type="email" autoComplete="off" defaultValue={state?.values?.email ?? operator?.email} required maxLength={255} placeholder="nama@email.com" />
        </Field>
        <Field
          label={operator ? t("Kata sandi baru") : t("Kata sandi")}
          error={fe.password}
          hint={operator ? t("Kosongkan untuk mempertahankan kata sandi. Minimal 8 karakter jika diubah.") : t("Minimal 8 karakter.")}
        >
          <Input name="password" type="password" autoComplete="new-password" required={!operator} minLength={8} maxLength={72} />
        </Field>
        {!operator && (
          <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-[11px] leading-relaxed text-ink-muted sm:col-span-2">
            {rich(t("Operator masuk memakai <b>email dan kata sandi</b> ini untuk mencatat jalannya pertandingan."), {
              b: (c) => <strong className="text-ink-secondary">{c}</strong>,
            })}
          </p>
        )}
      </Section>

      <Section title={t("Turnamen yang ditugaskan")}>
        <CompetitionPicker competitions={competitions} initial={operator?.competitionIds ?? []} error={fe.competitionIds} />
      </Section>

      <Section title={t("Status")}>
        <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
          <input name="active" type="checkbox" defaultChecked={state?.values ? state.values.active === "on" : operator?.active ?? true} />
          {t("Akun aktif")}
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
          {pending ? t("Menyimpan…") : operator ? t("Simpan perubahan") : t("Buat akun operator")}
        </Button>
        {!operator && (
          <Button variant="ghost" href="/registry/operator">
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
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * Checklist of Turnamen. Controlled, so the ticks survive a failed submit; every ticked one is sent
 * as a `competitionIds` field. Any number may be ticked.
 */
function CompetitionPicker({ competitions, initial, error }: { competitions: CompetitionChoice[]; initial: string[]; error?: string }) {
  const t = useT();
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(() => new Set(initial));
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? competitions.filter((c) => `${c.name} ${c.season}`.toLowerCase().includes(q)) : competitions;
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="sm:col-span-2">
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="competitionIds" value={id} />
      ))}
      <p className="mb-2 text-[11px] leading-relaxed text-ink-muted">
        {t("Operator hanya melihat turnamen yang dicentang di sini — beserta KU, jadwal, dan pertandingannya. Boleh lebih dari satu.")}
      </p>
      {competitions.length > 6 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder={t("Cari turnamen…")}
            aria-label={t("Cari turnamen")}
            className="pl-9"
          />
        </div>
      )}
      <div role="group" aria-label={t("Turnamen yang ditugaskan")} className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-1.5">
        {visible.map((c) => {
          const on = picked.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={`${c.name} · ${c.season}`}
              onClick={() => toggle(c.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                on ? "bg-brand-soft" : "hover:bg-surface-2",
              )}
            >
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-brand bg-brand text-white" : "border-line bg-surface")}>
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <Trophy className="size-3.5 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">{c.season}</span>
            </button>
          );
        })}
        {!visible.length && (
          <p className="px-3 py-5 text-center text-xs text-ink-muted">
            {competitions.length ? t("Tidak ada turnamen untuk “{query}”.", { query }) : t("Belum ada turnamen. Buat turnamen di menu Kompetisi.")}
          </p>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className={cn(picked.size ? "text-ink-secondary" : "text-warn")}>
          {picked.size ? t("{n} turnamen dipilih", { n: picked.size }) : t("Belum ada turnamen — operator tidak akan melihat turnamen apa pun.")}
        </span>
        {picked.size > 0 && (
          <button type="button" onClick={() => setPicked(new Set())} className="font-semibold text-ink-muted hover:text-ink">
            {t("Kosongkan")}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
