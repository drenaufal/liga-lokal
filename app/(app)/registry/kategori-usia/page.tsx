import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Users, Shirt, CircleDot, Repeat, Plus, Pencil } from "lucide-react";
import { listAgeCategories } from "@/lib/queries/registry";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { DeleteCategoryButton } from "./delete-category";
import { MAX_CATEGORY_AGE } from "./shared";
import { categoryLabel } from "@/lib/ku";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Aturan Kategori Usia") };
}
export const dynamic = "force-dynamic";

export default async function AgeCategoriesPage() {
  const { t } = await getI18n();
  const user = await requireCapability("registry.category:view");
  const cats = await listAgeCategories();
  const canCreate = can(user, "registry.category:create");
  const canEdit = can(user, "registry.category:edit");
  const canDelete = can(user, "registry.category:delete");
  const range = cats.length
    ? t("{from} hingga {to}", { from: cats[0].category.code, to: cats[cats.length - 1].category.code })
    : t("belum ada kategori");

  return (
    <div>
      <PageHeader
        title={t("Aturan Kategori Usia")}
        description={t("Konfigurasi durasi pertandingan, jumlah pemain, dan aturan khusus per kelompok umur ({range}). Setiap kategori ditentukan oleh usia maksimalnya dan dapat ditambah sendiri hingga usia {max} tahun.", { range, max: MAX_CATEGORY_AGE })}
        actions={
          canCreate && (
            <Button size="sm" href="/registry/kategori-usia/baru">
              <Plus className="size-3.5" /> {t("Kategori Baru")}
            </Button>
          )
        }
      />

      {cats.length === 0 ? (
        <EmptyState
          title={t("Belum ada kategori usia")}
          description={t("Tambahkan kategori pertama untuk mulai mengelompokkan pemain dan kompetisi.")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cats.map(({ category: c, players, tournaments }) => {
            const inUse = [players && t("{n} pemain", { n: players }), tournaments && t("{n} KU turnamen", { n: tournaments })]
              .filter(Boolean)
              .join(` ${t("dan")} `);
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Badge tone="brand">{c.code}</Badge>
                      <span className="truncate">{categoryLabel(t, c.label)}</span>
                    </CardTitle>
                    <span className="mt-1 block text-[11px] text-ink-muted">
                      {t("Usia maks. {age} · lahir {year} atau setelahnya", { age: c.maxAge, year: c.birthYearFrom ?? "—" })}
                    </span>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {canEdit && (
                        <Link
                          href={`/registry/kategori-usia/${c.id}/edit`}
                          className="grid size-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                          aria-label={t("Ubah {code}", { code: c.code })}
                          title={t("Ubah {code}", { code: c.code })}
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                      )}
                      {canDelete && <DeleteCategoryButton id={c.id} code={c.code} inUse={inUse || null} />}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Rule icon={Clock} label={t("Durasi")}>
                      {c.rules.matchDuration}&rsquo; ({c.rules.halfDuration}&rsquo; / {t("babak")})
                    </Rule>
                    <Rule icon={Users} label={t("Format")}>
                      {c.rules.playersOnField} vs {c.rules.playersOnField}
                    </Rule>
                    <Rule icon={Shirt} label={t("Skuad maks")}>{t("{n} pemain", { n: c.rules.maxSquad })}</Rule>
                    <Rule icon={CircleDot} label={t("Ukuran bola")}>{t("No. {n}", { n: c.rules.ballSize })}</Rule>
                    <Rule icon={Repeat} label={t("Pergantian::aturan")} wide>
                      {t.dyn(c.rules.substitutions)}
                    </Rule>
                  </div>
                  <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-ink-muted">{t("Lapangan::jenis")}</p>
                    <p className="mt-0.5 text-xs text-ink-secondary">{t.dyn(c.rules.fieldType)}</p>
                  </div>
                  {c.rules.notes && c.rules.notes.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-ink-muted">
                      {c.rules.notes.map((n, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-brand">•</span> {t.dyn(n)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="border-t border-line-soft pt-2.5 text-[11px] text-ink-muted">
                    {inUse ? t("Dipakai {what}", { what: inUse }) : t("Belum dipakai pemain atau turnamen")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Rule({
  icon: I,
  label,
  children,
  wide,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-muted">
        <I className="size-3" /> {label}
      </div>
      <div className="mt-0.5 text-xs text-ink-secondary">{children}</div>
    </div>
  );
}
