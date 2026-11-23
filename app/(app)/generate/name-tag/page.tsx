import type { Metadata } from "next";
import { getClubScope, getCompetitionScope, requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { getI18n } from "@/lib/i18n/server";
import { getNameTagRecords, getPrintClubs, getPrintCompetitions, getPrintTemplate } from "@/lib/queries/print";
import { printFileName } from "@/lib/print/layout";
import { GeneratePicker } from "../picker";
import { TemplatePanel } from "../template-panel";
import { ExportList } from "../export-list";
import { sampleRecord } from "../sample";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Name Tag") };
}
export const dynamic = "force-dynamic";

/** Generate → Name Tag: Turnamen → SSB → its players and coaches → one PDF. */
export default async function NameTagPage({ searchParams }: { searchParams: Promise<{ turnamen?: string; klub?: string }> }) {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("generate.nametag:view");
  const { turnamen, klub } = await searchParams;
  const [competitions, clubScope] = await Promise.all([getPrintCompetitions(await getCompetitionScope()), getClubScope()]);
  const competition = competitions.find((c) => c.id === turnamen) ?? null;
  const [template, clubs] = competition
    ? await Promise.all([getPrintTemplate(competition.id, "name_tag"), getPrintClubs(competition.id, clubScope)])
    : [null, []];
  const club = clubs.find((c) => c.id === klub) ?? null;
  const records = competition && club ? await getNameTagRecords(competition, club, { t, fmt }) : [];
  const players = records.filter((r) => r.kind === "player").length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("Name Tag")}
        description={t("Name tag pemain dan pelatih dari template tiap turnamen, diunduh sebagai PDF siap cetak.")}
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
              param: "klub",
              label: t("SSB"),
              value: club?.id ?? "",
              placeholder: clubs.length ? t("Pilih SSB…") : t("Belum ada SSB peserta"),
              disabledText: t("Pilih turnamen dahulu"),
              options: clubs.map((c) => ({ value: c.id, label: c.name })),
            },
          ]}
        />

        {competition && (
          <TemplatePanel
            kind="name_tag"
            competition={competition}
            template={template && { imageUrl: template.imageUrl, width: template.width, height: template.height, layout: template.layout }}
            canManage={can(user, "generate.nametag:template")}
            sample={records[0] ?? sampleRecord("name_tag", competition, t, fmt)}
          />
        )}

        {competition && club && (
          <ExportList
            key={club.id}
            groups
            title={t("Pemain & pelatih · {club}", { club: club.name })}
            description={t("{players} pemain dan {coaches} pelatih. Satu halaman per orang.", { players, coaches: records.length - players })}
            records={records}
            template={template && { imageUrl: template.imageUrl, width: template.width, height: template.height, layout: template.layout }}
            fileName={printFileName("name-tag", club.short || club.name, competition.name)}
            emptyText={t("SSB ini belum memiliki pemain terdaftar di KU turnamen ini maupun pelatih.")}
          />
        )}
      </div>
    </div>
  );
}
