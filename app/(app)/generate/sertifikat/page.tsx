import type { Metadata } from "next";
import { getClubScope, getCompetitionScope, requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { getI18n } from "@/lib/i18n/server";
import { getCertificateRecords, getPrintCompetitions, getPrintKus, getPrintTemplate } from "@/lib/queries/print";
import { printFileName } from "@/lib/print/layout";
import { GeneratePicker } from "../picker";
import { TemplatePanel } from "../template-panel";
import { ExportList } from "../export-list";
import { sampleRecord } from "../sample";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sertifikat") };
}
export const dynamic = "force-dynamic";

/** Generate → Sertifikat: Turnamen → KU → every player (select all) → one PDF. */
export default async function CertificatePage({ searchParams }: { searchParams: Promise<{ turnamen?: string; ku?: string }> }) {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("generate.certificate:view");
  const { turnamen, ku: kuId } = await searchParams;
  const [competitions, clubScope] = await Promise.all([getPrintCompetitions(await getCompetitionScope()), getClubScope()]);
  const competition = competitions.find((c) => c.id === turnamen) ?? null;
  const [template, kus] = competition
    ? await Promise.all([getPrintTemplate(competition.id, "certificate"), getPrintKus(competition.id)])
    : [null, []];
  const ku = kus.find((k) => k.id === kuId) ?? null;
  const records = competition && ku ? await getCertificateRecords(competition, ku, clubScope, { t, fmt }) : [];
  const clubCount = new Set(records.map((r) => r.values.club)).size;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("Sertifikat")}
        description={t("Sertifikat untuk pemain satu KU dari template tiap turnamen, diunduh sebagai PDF siap cetak.")}
      />
      <div className="space-y-4">
        <GeneratePicker
          steps={[
            {
              param: "turnamen",
              label: t("Turnamen"),
              value: competition?.id ?? "",
              placeholder: competitions.length ? t("Pilih turnamen…") : t("Belum ada turnamen"),
              options: competitions.map((c) => ({ value: c.id, label: `${c.name} · ${c.season}` })),
            },
            {
              param: "ku",
              label: "KU",
              value: ku?.id ?? "",
              placeholder: kus.length ? t("Pilih KU…") : t("Belum ada KU"),
              disabledText: t("Pilih turnamen dahulu"),
              options: kus.map((k) => ({ value: k.id, label: k.code ?? "KU" })),
            },
          ]}
        />

        {competition && (
          <TemplatePanel
            kind="certificate"
            competition={competition}
            template={template && { imageUrl: template.imageUrl, width: template.width, height: template.height, layout: template.layout }}
            canManage={can(user, "generate.certificate:template")}
            sample={records[0] ?? sampleRecord("certificate", competition, t, fmt)}
          />
        )}

        {competition && ku && (
          <ExportList
            key={ku.id}
            title={t("Pemain · {ku}", { ku: ku.code ?? "KU" })}
            description={t("{n} pemain dari {clubs} SSB. Satu halaman per pemain.", { n: records.length, clubs: clubCount })}
            records={records}
            template={template && { imageUrl: template.imageUrl, width: template.width, height: template.height, layout: template.layout }}
            fileName={printFileName("sertifikat", competition.name, ku.code)}
            emptyText={t("Belum ada pemain di KU ini. Tambahkan peserta dan daftarkan pemainnya terlebih dahulu.")}
          />
        )}
      </div>
    </div>
  );
}
