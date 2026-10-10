import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getReport } from "@/lib/queries/scout";
import { AiReportView } from "@/components/app/ai-report";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = await getReport(id);
  return { title: r?.subjectLabel ?? "Laporan AI" };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        <ArrowLeft className="size-3.5" /> AI Scout & Insights
      </Link>

      <div className="mb-4 flex items-center justify-between text-xs text-ink-muted">
        <span>
          {report.subjectLabel}
          {subjectHref && (
            <>
              {" · "}
              <Link href={subjectHref} className="text-brand hover:underline">
                lihat detail
              </Link>
            </>
          )}
        </span>
        <span>{formatDateTime(report.createdAt)}</span>
      </div>

      <AiReportView result={report.result} model={report.model} kind={report.kind} />
    </div>
  );
}
