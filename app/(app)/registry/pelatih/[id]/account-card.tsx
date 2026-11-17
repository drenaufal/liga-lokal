"use client";

import { useState, useTransition } from "react";
import { saveCoachLogin } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/lib/i18n/client";

export function CoachAccountCard({ coachId, email, account, hasClub }: {
  coachId: string; email: string; account: { email: string; active: boolean } | null; hasClub: boolean;
}) {
  const t = useT();
  const [loginEmail, setEmail] = useState(account?.email ?? email);
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(account?.active ?? true);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <Card className="mb-4"><CardHeader><CardTitle>{t("Akun login pelatih")}</CardTitle></CardHeader><CardContent>
    <p className="mb-4 text-xs text-ink-muted">{t("Pelatih masuk melalui halaman login dan mengisi DSP untuk SSB asuhannya.")} {hasClub ? "" : t("Tentukan SSB pada data pelatih terlebih dahulu.")}</p>
    <form onSubmit={(e) => { e.preventDefault(); start(async () => {
      setError("");
      try { await saveCoachLogin(coachId, { email: loginEmail, password, active }); setPassword(""); toast.success(t("Akun pelatih disimpan")); }
      catch (e) { setError(e instanceof Error ? e.message : t("Gagal menyimpan akun")); }
    }); }} className="space-y-3">
      <fieldset disabled={pending || !hasClub} className="grid gap-3 sm:grid-cols-2">
        <Field label={t("Email login")}><Input aria-label={t("Email login pelatih")} type="email" autoComplete="off" required value={loginEmail} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={account ? t("Kata sandi baru (opsional)") : t("Kata sandi")}><Input aria-label={t("Kata sandi login pelatih")} type="password" autoComplete="new-password" minLength={8} maxLength={72} required={!account} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t("Akun aktif")}</label>
      </fieldset>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <Button type="submit" disabled={pending || !hasClub}>{pending ? t("Menyimpan…") : account ? t("Simpan akun login") : t("Buat akun login")}</Button>
    </form>
  </CardContent></Card>;
}
