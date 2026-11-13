import { Sparkles } from "lucide-react";
import type { AiReportResult } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

export async function AiReportView({
  result,
  model,
  kind,
}: {
  result: AiReportResult;
  model: string;
  kind: string;
}) {
  const t = await getT();
  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-violet/25 bg-violet/10 text-violet">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug text-ink">
                {result.headline}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{result.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge tone={model === "demo" ? "neutral" : "violet"}>
                  {model === "demo" ? t("Analisis berbasis data") : t("Model: {model}", { model })}
                </Badge>
                {result.tags?.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.ratings && result.ratings.length > 0 && (
        <Card>
          <CardContent className="space-y-2.5">
            {result.ratings.map((r) => (
              <div key={r.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-secondary">{r.label}</span>
                  <span className="tabular-nums text-ink">{Math.round(r.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-violet"
                    style={{ width: `${Math.max(0, Math.min(100, r.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result.sections.map((s, i) => (
        <Card key={i}>
          <CardContent>
            <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{s.body}</p>
            {s.bullets && s.bullets.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {s.bullets.map((b, k) => (
                  <li key={k} className="flex gap-2 text-xs text-ink-secondary">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-brand" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {result.recommendations && result.recommendations.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-ink">{t("Rekomendasi Tindak Lanjut")}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.recommendations.map((r, i) => (
                <span
                  key={i}
                  className="rounded-lg border border-brand/25 bg-brand/5 px-2.5 py-1 text-xs text-brand"
                >
                  {r}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[11px] text-ink-muted">
        {kind === "player_analysis"
          ? t("Analisis dihasilkan dari data performa terverifikasi pada platform LigaLokal.")
          : t("Wawasan berbasis data kejadian yang tercatat pada sistem.")}
      </p>
    </div>
  );
}
