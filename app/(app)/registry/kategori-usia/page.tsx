import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Users, Shirt, CircleDot, Repeat, Plus, Pencil } from "lucide-react";
import { listAgeCategories } from "@/lib/queries/registry";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { DeleteCategoryButton } from "./delete-category";
import { MAX_CATEGORY_AGE } from "./shared";

export const metadata: Metadata = { title: "Aturan Kategori Usia" };
export const dynamic = "force-dynamic";

export default async function AgeCategoriesPage() {
  const [cats, user] = await Promise.all([listAgeCategories(), getCurrentUser()]);
  const canWrite = can(user?.role, "registry:write");
  const range = cats.length
    ? `${cats[0].category.code} hingga ${cats[cats.length - 1].category.code}`
    : "belum ada kategori";

  return (
    <div>
      <PageHeader
        title="Aturan Kategori Usia"
        description={`Konfigurasi durasi pertandingan, jumlah pemain, dan aturan khusus per kelompok umur (${range}). Setiap kategori ditentukan oleh usia maksimalnya dan dapat ditambah sendiri hingga usia ${MAX_CATEGORY_AGE} tahun.`}
        actions={
          canWrite && (
            <Button size="sm" href="/registry/kategori-usia/baru">
              <Plus className="size-3.5" /> Kategori Baru
            </Button>
          )
        }
      />

      {cats.length === 0 ? (
        <EmptyState
          title="Belum ada kategori usia"
          description="Tambahkan kategori pertama untuk mulai mengelompokkan pemain dan kompetisi."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cats.map(({ category: c, players, tournaments }) => {
            const inUse = [players && `${players} pemain`, tournaments && `${tournaments} KU turnamen`]
              .filter(Boolean)
              .join(" dan ");
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Badge tone="brand">{c.code}</Badge>
                      <span className="truncate">{c.label}</span>
                    </CardTitle>
                    <span className="mt-1 block text-[11px] text-ink-muted">
                      Usia maks. {c.maxAge} · lahir {c.birthYearFrom} atau setelahnya
                    </span>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Link
                        href={`/registry/kategori-usia/${c.id}/edit`}
                        className="grid size-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                        aria-label={`Ubah ${c.code}`}
                        title={`Ubah ${c.code}`}
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <DeleteCategoryButton id={c.id} code={c.code} inUse={inUse || null} />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Rule icon={Clock} label="Durasi">
                      {c.rules.matchDuration}&rsquo; ({c.rules.halfDuration}&rsquo; / babak)
                    </Rule>
                    <Rule icon={Users} label="Format">
                      {c.rules.playersOnField} vs {c.rules.playersOnField}
                    </Rule>
                    <Rule icon={Shirt} label="Skuad maks">{c.rules.maxSquad} pemain</Rule>
                    <Rule icon={CircleDot} label="Ukuran bola">No. {c.rules.ballSize}</Rule>
                    <Rule icon={Repeat} label="Pergantian" wide>
                      {c.rules.substitutions}
                    </Rule>
                  </div>
                  <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-ink-muted">Lapangan</p>
                    <p className="mt-0.5 text-xs text-ink-secondary">{c.rules.fieldType}</p>
                  </div>
                  {c.rules.notes && c.rules.notes.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-ink-muted">
                      {c.rules.notes.map((n, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-brand">•</span> {n}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="border-t border-line-soft pt-2.5 text-[11px] text-ink-muted">
                    {inUse ? `Dipakai ${inUse}` : "Belum dipakai pemain atau turnamen"}
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
