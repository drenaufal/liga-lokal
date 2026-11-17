import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { homeHref } from "@/lib/nav";
import { logoutAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Belum Ada Akses") };
}
export const dynamic = "force-dynamic";

/** Where an account lands when its role has not been given access to any menu. */
export default async function NoAccessPage() {
  const { t } = await getI18n();
  const user = await requireUser();
  const home = homeHref(user);
  if (home) redirect(home);

  return (
    <div className="mx-auto max-w-lg pt-10">
      <EmptyState
        icon={LockKeyhole}
        title={t("Peran Anda belum memiliki akses ke menu apa pun")}
        description={t("Hubungi Super Admin agar peran Anda diberi akses pada Pengaturan → Hak Akses Peran, lalu masuk kembali.")}
        action={
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              {t("Keluar")}
            </Button>
          </form>
        }
      />
    </div>
  );
}
