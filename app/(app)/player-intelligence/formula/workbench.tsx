"use client";

import * as React from "react";
import { Gauge, Check, Loader2, RotateCcw, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { WEIGHT_LABELS, computeScore, type ScorableStats } from "@/lib/scoring";
import type { FormulaWeights } from "@/lib/db/schema";
import { saveFormula, activateFormula } from "./actions";
import { IntelligenceFilters, IntelligencePagination } from "../filters";
import { playerFilterFields, parsePlayerFilters, paramValue, pageWindow, sortPlayerRows, type PlayerFilterOptions, type IntelligenceParams, type FilterField } from "@/lib/intelligence-filters";

type Formula = {
  id: string;
  name: string;
  description: string | null;
  weights: FormulaWeights;
  isActive: boolean;
  version: number;
};

type PreviewPlayer = {
  id: string;
  name: string;
  club: string | null;
  position: string;
} & ScorableStats & { appearances: number; rating: number; ageCode: string | null; shotsOnTarget: number; shotsOffTarget: number };

const KEYS = Object.keys(WEIGHT_LABELS) as (keyof FormulaWeights)[];

export function FormulaWorkbench({
  formulas,
  preview,
  canEdit,
  canActivate,
  params,
  filterOptions,
}: {
  formulas: Formula[];
  preview: PreviewPlayer[];
  canEdit: boolean;
  canActivate: boolean;
  params: IntelligenceParams;
  filterOptions: PlayerFilterOptions;
}) {
  const [selectedId, setSelectedId] = React.useState(
    formulas.find((f) => f.isActive)?.id ?? formulas[0]?.id,
  );
  const selected = formulas.find((f) => f.id === selectedId)!;
  const [draft, setDraft] = React.useState<FormulaWeights>(selected.weights);
  const [name, setName] = React.useState(selected.name);
  const [pending, start] = React.useTransition();

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(selected.weights) || name !== selected.name;

  const filters = parsePlayerFilters(params, 3);
  const ranked = React.useMemo(() => {
    const scored = preview.map((p) => ({ ...p, newScore: computeScore(p, draft), oldScore: computeScore(p, selected.weights) }));
    const oldIds = sortPlayerRows(scored, "score", "desc", (p) => p.oldScore).map((p) => p.id);
    return sortPlayerRows(scored, "score", "desc", (p) => p.newScore)
      .map((p, i) => ({ ...p, newRank: i + 1, oldRank: oldIds.indexOf(p.id) + 1 }));
  }, [draft, preview, selected.weights]);
  const displayed = sortPlayerRows(ranked, filters.sort, filters.order, (p, key) => key === "score" ? p.newScore : p[key]);
  const pagination = pageWindow(displayed.length, filters.page, filters.pageSize);
  const pageRows = displayed.slice(pagination.offset, pagination.offset + pagination.pageSize);
  const formulaQuery = paramValue(params, "formulaQ").trim().toLowerCase();
  const formulaStatus = paramValue(params, "formulaStatus");
  const formulaSort = paramValue(params, "formulaSort");
  const visibleFormulas = formulas.filter((f) => (!formulaQuery || (f.name + " " + (f.description ?? "")).toLowerCase().includes(formulaQuery)) &&
    (formulaStatus === "active" ? f.isActive : formulaStatus === "inactive" ? !f.isActive : true))
    .sort((a, b) => formulaSort === "name" ? a.name.localeCompare(b.name, "id") : formulaSort === "version" ? b.version - a.version || a.name.localeCompare(b.name, "id") : Number(b.isActive) - Number(a.isActive) || b.version - a.version || a.name.localeCompare(b.name, "id"));
  const formulaFields: FilterField[] = [
    { key: "formulaQ", label: "Cari formula", placeholder: "Nama atau deskripsi…" },
    { key: "formulaStatus", label: "Status", placeholder: "Semua status", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Tidak aktif" }] },
    { key: "formulaSort", label: "Urutkan formula", defaultValue: "active", options: [{ value: "active", label: "Aktif dahulu" }, { value: "name", label: "Nama A–Z" }, { value: "version", label: "Versi tertinggi" }] },
  ];

  const doSave = () =>
    start(async () => {
      try {
        await saveFormula({ id: selectedId, name, description: selected.description ?? "", weights: draft });
        toast.success("Formula disimpan");
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });

  const doActivate = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      try {
        await activateFormula(fd);
        toast.success("Formula diaktifkan", "Skor & rating seluruh pemain dihitung ulang");
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Formula Penilaian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <IntelligenceFilters params={params} fields={formulaFields} title="Filter formula" preserve={playerFilterFields(filterOptions, 3).map((f) => f.key)} />
            <p className="text-[11px] text-ink-muted">{visibleFormulas.length} dari {formulas.length} formula</p>
            {!visibleFormulas.length && <p className="py-4 text-center text-xs text-ink-muted">Tidak ada formula yang cocok.</p>}
            {visibleFormulas.map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedId(f.id); setDraft(f.weights); setName(f.name); }}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                  selectedId === f.id ? "border-brand/50 bg-brand/5" : "border-line hover:border-ink/25",
                )}
              >
                <div className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Gauge className="size-3.5 text-brand" />
                    {f.name}
                    {f.isActive && <Badge tone="brand">Aktif</Badge>}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-muted">
                    v{f.version} · {f.description}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bobot Metrik</CardTitle>
            {dirty && <span className="text-[11px] text-warn">Perubahan belum disimpan</span>}
          </CardHeader>
          <CardContent className="space-y-3">
            {canEdit && (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm font-medium"
              />
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {KEYS.map((k) => (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-ink-secondary">{WEIGHT_LABELS[k]}</span>
                    <span className="tabular-nums text-ink">{draft[k]}</span>
                  </div>
                  <input
                    type="range"
                    min={k === "yellowCard" || k === "redCard" ? -8 : 0}
                    max={k === "goal" || k === "motm" ? 12 : 8}
                    step={0.1}
                    value={draft[k]}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))
                    }
                    className="w-full accent-brand disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
            {(canEdit || canActivate) && (
              <div className="flex gap-2 border-t border-line-soft pt-3">
                {canEdit && (
                  <>
                    <Button size="sm" disabled={!dirty || pending} onClick={doSave}>
                      {pending ? <Loader2 className="animate-spin" /> : <Save className="size-3.5" />}
                      Simpan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!dirty}
                      onClick={() => {
                        setDraft(selected.weights);
                        setName(selected.name);
                      }}
                    >
                      <RotateCcw className="size-3.5" /> Reset
                    </Button>
                  </>
                )}
                {canActivate && !selected.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={pending || dirty}
                    onClick={() => doActivate(selected.id)}
                  >
                    <Check className="size-3.5" /> Aktifkan
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Pratinjau Dampak — Papan Peringkat</CardTitle>
          <span className="text-[11px] text-ink-muted">
            {selected.isActive ? "vs formula aktif" : "vs formula ini tersimpan"}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-3"><IntelligenceFilters params={params} fields={playerFilterFields(filterOptions, 3, true)} title="Filter & urutkan pratinjau pemain" preserve={["formulaQ", "formulaStatus", "formulaSort"]} /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-2 py-2">Pemain</th>
                  <th className="px-2 py-2 text-right">Skor draf</th>
                  <th className="px-4 py-2 text-right">Δ Peringkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {pageRows.map((p) => {
                  const move = p.oldRank - p.newRank;
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/40">
                      <td className="px-4 py-2 tabular-nums text-ink-muted">{p.newRank}</td>
                      <td className="px-2 py-2">
                        <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                        <span className="text-[10px] text-ink-muted">
                          {p.club} · {p.position} · {p.ageCode} · {p.goals}G {p.assists}A {p.saves}S
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink">
                        {Math.round(p.newScore)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {move === 0 ? (
                          <span className="text-[11px] text-ink-muted">—</span>
                        ) : (
                          <span
                            className={cn(
                              "text-[11px] font-medium tabular-nums",
                              move > 0 ? "text-success" : "text-danger",
                            )}
                          >
                            {move > 0 ? `▲ ${move}` : `▼ ${-move}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!displayed.length && <p className="p-6 text-center text-xs text-ink-muted">Tidak ada pemain yang cocok. Sesuaikan atau reset filter.</p>}
          <IntelligencePagination params={params} total={pagination.total} page={pagination.page} pageSize={pagination.pageSize} label="pemain" />
        </CardContent>
      </Card>
    </div>
  );
}
