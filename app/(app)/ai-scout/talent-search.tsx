"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Search, BookmarkPlus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toaster";
import { runSearch, saveShortlist, type SearchState } from "./actions";
import { EMPHASIS_LABEL } from "@/lib/ai/parse";
import { positionText } from "@/lib/positions";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

const EXAMPLES = [
  msg("Cari gelandang serang KU-12 dengan assist banyak dan visi bermain baik"),
  msg("Penyerang KU-14 klinis dan haus gol"),
  msg("Bek KU-16 solid, kuat duel, dan disiplin tanpa kartu"),
  msg("Kiper KU-12 dengan refleks bagus dan banyak nirbobol"),
];

export function TalentSearch({ canShortlist }: { canShortlist: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<SearchState, FormData>(runSearch, undefined);
  const [query, setQuery] = React.useState("");
  const [savePending, startSave] = React.useTransition();

  const save = () => {
    if (!state?.results?.length) return;
    const fd = new FormData();
    fd.set("name", t("Kandidat: {query}", { query: state.query?.slice(0, 40) ?? "" }));
    fd.set("query", state.query ?? "");
    fd.set(
      "items",
      JSON.stringify(
        state.results.map((r) => ({ playerId: r.id, name: r.name, reason: `Fit ${r.fit}`, score: r.fit })),
      ),
    );
    startSave(async () => {
      try {
        await saveShortlist(fd);
        toast.success(t("Shortlist disimpan"));
      } catch (e) {
        toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet" /> {t("Pencarian Talenta — Bahasa Natural")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-muted" />
            <textarea
              name="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Deskripsikan pemain yang Anda cari…")}
              rows={2}
              className="w-full rounded-lg border border-line bg-base/60 py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand/50"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(t(ex))}
                className="rounded-full border border-line px-2 py-1 text-[10px] text-ink-muted transition-colors hover:border-brand/40 hover:text-ink"
              >
                {t(ex)}
              </button>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="size-3.5" />}
            {t("Cari Talenta")}
          </Button>
        </form>

        {state?.error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        )}

        {state?.results && (
          <div className="mt-4">
            {state.filters && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                <span>{t("Filter terdeteksi:")}</span>
                {state.filters.position && (
                  <Badge tone="info">{positionText(state.filters.position, t)}</Badge>
                )}
                {state.filters.ageCode && <Badge>{state.filters.ageCode}</Badge>}
                {state.filters.emphasis.map((e) => (
                  <Badge key={e} tone="violet">
                    {t.dyn(EMPHASIS_LABEL[e])}
                  </Badge>
                ))}
              </div>
            )}

            {state.results.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-muted">
                {t("Tidak ada pemain yang cocok dengan kriteria.")}
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-secondary">
                    {t("{n} kandidat teratas", { n: state.results.length })}
                  </span>
                  {canShortlist && (
                    <Button size="sm" variant="ghost" disabled={savePending} onClick={save}>
                      {savePending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <BookmarkPlus className="size-3.5" />
                      )}
                      {t("Simpan shortlist")}
                    </Button>
                  )}
                </div>
                <ol className="space-y-1.5">
                  {state.results.map((r, i) => (
                    <li key={r.id}>
                      <Link
                        href={`/registry/pemain/${r.id}`}
                        className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-2/30 px-3 py-2 transition-colors hover:border-brand/40"
                      >
                        <span className="w-4 text-center text-[11px] font-medium text-ink-muted">
                          {i + 1}
                        </span>
                        <Avatar src={r.photoUrl} name={r.name} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink">{r.name}</p>
                          <p className="text-[10px] text-ink-muted">
                            {r.club} · {positionText(r.position, t)} · {r.ageCode} ·{" "}
                            {t("{goals}G {assists}A {saves}P · rating {rating}", { goals: r.goals, assists: r.assists, saves: r.saves, rating: r.rating.toFixed(1) })}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-violet/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet">
                          fit {r.fit}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
