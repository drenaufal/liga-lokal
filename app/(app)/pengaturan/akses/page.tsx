import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getGrantMatrix } from "@/lib/auth/permissions";
import { EDITABLE_ROLES, defaultGrants, normalizeGrants, type GrantMatrix } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { AccessMatrix } from "./access-matrix";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Hak Akses Peran") };
}
export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const { t } = await getI18n();
  await requireCapability("access:manage");
  const saved = await getGrantMatrix();
  const defaults = Object.fromEntries(
    EDITABLE_ROLES.map((r) => [r, normalizeGrants(r, defaultGrants(r))]),
  ) as GrantMatrix;

  return (
    <div>
      <Link
        href="/pengaturan"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Pengaturan")}
      </Link>
      <PageHeader
        title={t("Hak Akses Peran")}
        description={t("Tentukan apa yang boleh dilakukan setiap peran. Pengaturan ini hanya dapat diubah oleh Super Admin dan langsung berlaku untuk seluruh akun pada peran tersebut.")}
      />
      <AccessMatrix saved={saved} defaults={defaults} />
    </div>
  );
}
