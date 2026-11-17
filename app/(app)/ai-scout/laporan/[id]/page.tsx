import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getReport } from "@/lib/queries/scout";
import { requireCapability } from "@/lib/auth/session";
import { AiReportView } from "@/components/app/ai-report";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = await getReport(id);
  const { t } = await getI18n();
  return { title: r?.subjectLabel ?? t("Laporan AI") };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, fmt } = await getI18n();
  await requireCapability("scout:view");
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const subjectHref =
    report.subjectType === "player"
      ? `/registry/pemain/${report.subjectId}`
      : report.subjectType === "match"
        ? `/match-ops/${report.subjectId}`
        : report.subjectType === "tournament"
          ? `/kompetisi/ku/${report.subjectId}`
          : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ai-scout"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("AI Scout & Insights")}
      </Link>

      <div className="mb-4 flex items-center justify-between text-xs text-ink-muted">
        <span>
          {report.subjectLabel}
          {subjectHref && (
            <>
              {" · "}
              <Link href={subjectHref} className="text-brand hover:underline">
                {t("lihat detail")}
              </Link>
            </>
          )}
        </span>
        <span>{fmt.dateTime(report.createdAt)}</span>
      </div>

      <AiReportView result={report.result} model={report.model} kind={report.kind} />
    </div>
  );
}
