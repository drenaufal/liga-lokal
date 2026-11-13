"use client";

import { useState, useTransition } from "react";
import { selectBestPlayer } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/lib/i18n/client";

export function ManualMvp({ options }: { options: { id: string; label: string; players: { id: string; name: string }[] }[] }) {
  const t = useT();
  const [kuId, setKu] = useState(options.length === 1 ? options[0].id : "");
  const [playerId, setPlayer] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const ku = options.find((k) => k.id === kuId);
  return <Card><CardHeader><CardTitle>{t("Pilih Pemain Terbaik")}</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-xs text-ink-muted">{t("Pilihan manual berlaku untuk satu KU pada turnamen. Menyimpan akan mengganti penerima sebelumnya pada KU tersebut.")}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("Turnamen · KU")}><Select aria-label={t("Turnamen dan KU pemain terbaik")} value={kuId} disabled={pending} onChange={(e) => { setKu(e.target.value); setPlayer(""); }}><option value="">{t("Pilih turnamen dan KU…")}</option>{options.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
      <Field label={t("Pemain terbaik")}><Select aria-label={t("Pemain terbaik")} value={playerId} disabled={pending || !ku} onChange={(e) => setPlayer(e.target.value)}><option value="">{t("Pilih pemain…")}</option>{ku?.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
    </div>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <Button disabled={pending || !kuId || !playerId} onClick={() => start(async () => {
      setError(""); try { await selectBestPlayer({ kuId, playerId }); toast.success(t("Pemain terbaik disimpan")); }
      catch (e) { setError(e instanceof Error ? e.message : t("Gagal memilih pemain")); }
    })}>{pending ? t("Menyimpan…") : t("Simpan pemain terbaik")}</Button>
  </CardContent></Card>;
}
