"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Loader2, Search, Trophy } from "lucide-react";
import { createKu } from "./actions";
import type { FormState } from "@/lib/form";
import { FORMAT_META } from "@/lib/ku";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Age = { id: string; code: string; label: string };

/**
 * "Tambah KU": everything a Turnamen does not carry itself — the age group,
 * format, dates, scoring formula and the SSBs taking part. The SSB list shows
 * how many players each one has in the chosen age group, so it is clear who can
 * actually field a team.
 */
export function KuForm({
  competitionId,
  ages,
  usedAgeIds,
  formulas,
  clubs,
  playerCounts,
}: {
  competitionId: string;
  ages: Age[];
  usedAgeIds: string[];
  formulas: { id: string; name: string; isActive: boolean }[];
  clubs: { id: string; name: string; short: string }[];
  playerCounts: Record<string, Record<string, number>>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createKu.bind(null, competitionId),
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const sv = state?.values ?? {};

  const firstFree = ages.find((a) => !usedAgeIds.includes(a.id));
  const [ageId, setAgeId] = React.useState(sv.ageCategoryId ?? firstFree?.id ?? "");
  const [format, setFormat] = React.useState(sv.format ?? "league");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");

  const age = ages.find((a) => a.id === ageId);
  const countOf = (clubId: string) => (ageId ? (playerCounts[clubId]?.[ageId] ?? 0) : 0);
  const shown = clubs.filter(
    (c) => !query.trim() || `${c.name} ${c.short}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleShown = () =>
    setSelected((s) => {
      const n = new Set(s);
      for (const c of shown) {
        if (allShownSelected) n.delete(c.id);
        else n.add(c.id);
      }
      return n;
    });

  const noPlayers = [...selected].filter((id) => countOf(id) === 0).length;

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kategori usia (KU)" error={fe.ageCategoryId}>
          <Select name="ageCategoryId" value={ageId} onChange={(e) => setAgeId(e.target.value)} required>
            <option value="" disabled>
              Pilih KU…
            </option>
            {ages.map((a) => {
              const used = usedAgeIds.includes(a.id);
              return (
                <option key={a.id} value={a.id} disabled={used}>
                  {a.code} — {a.label}
                  {used ? " (sudah ada)" : ""}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="Formula penilaian" error={fe.scoringFormulaId}>
          <Select name="scoringFormulaId" defaultValue={sv.scoringFormulaId ?? formulas.find((f) => f.isActive)?.id ?? ""}>
            <option value="">—</option>
            {formulas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.isActive ? " (aktif)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Format kompetisi</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["league", "cup"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-colors",
                format === value ? "border-brand/50 bg-brand/5" : "border-line hover:border-ink/25",
              )}
            >
              <input
                type="radio"
                name="format"
                value={value}
                checked={format === value}
                onChange={() => setFormat(value)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <Trophy className="size-3.5 text-brand" />
                {FORMAT_META[value].label}
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-muted">{FORMAT_META[value].desc}</span>
            </label>
          ))}
        </div>
        {fe.format && <p className="mt-1 text-[11px] text-danger">{fe.format}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal mulai" error={fe.startDate}>
          <Input name="startDate" type="date" required defaultValue={sv.startDate ?? ""} />
        </Field>
        <Field label="Tanggal selesai" error={fe.endDate} hint="Opsional">
          <Input name="endDate" type="date" defaultValue={sv.endDate ?? ""} />
        </Field>
        <Field label="Kota" error={fe.city} hint="Opsional">
          <Input name="city" defaultValue={sv.city ?? ""} placeholder="mis. Jakarta Selatan" />
        </Field>
        {format === "league" && (
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink-secondary">
            <input type="checkbox" name="doubleRound" defaultChecked={sv.doubleRound === "on"} className="accent-brand" />
            Round-robin ganda (kandang & tandang)
          </label>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-secondary">
            SSB peserta ({selected.size} dipilih
            {format === "cup" ? ", maks. 32" : ""})
          </span>
          <button type="button" onClick={toggleShown} className="text-[11px] text-ink-muted hover:text-ink">
            {allShownSelected ? "Hapus pilihan" : query.trim() ? "Pilih yang tampil" : "Pilih semua"}
          </button>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari SSB…"
            aria-label="Cari SSB"
            className="h-9 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-xs text-ink outline-none transition-colors focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
          />
        </div>
        <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
          {shown.map((c) => {
            const n = countOf(c.id);
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  on ? "bg-brand/10 text-ink" : "text-ink-secondary hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    on ? "border-brand bg-brand text-white" : "border-line",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {age && (
                  <span
                    className={cn("shrink-0 text-[10px] tabular-nums", n === 0 ? "text-warn" : "text-ink-muted")}
                    title={`Pemain ${age.code} yang terdaftar di SSB ini`}
                  >
                    {n} pemain
                  </span>
                )}
              </button>
            );
          })}
          {shown.length === 0 && <p className="px-2 py-3 text-xs text-ink-muted">Tidak ada SSB yang cocok.</p>}
        </div>
        {fe.clubIds && <p className="mt-1 text-[11px] text-danger">{fe.clubIds}</p>}
        {age && noPlayers > 0 && (
          <p className="mt-1.5 text-[11px] text-warn">
            {noPlayers} SSB terpilih belum punya pemain {age.code}. Mereka tetap bisa dijadwalkan, tetapi belum bisa
            menurunkan skuad.
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Peserta boleh dikosongkan dan ditambah nanti di tab Peserta KU.
        </p>
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="clubIds" value={id} />
        ))}
      </div>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !ageId}>
          {pending ? <Loader2 className="animate-spin" /> : <Trophy />}
          Buat KU
        </Button>
        <Button variant="ghost" href={`/kompetisi/${competitionId}`}>
          Batal
        </Button>
      </div>
    </form>
  );
}
