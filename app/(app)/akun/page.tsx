import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Akun saya") };
}
export const dynamic = "force-dynamic";

/** The signed-in person's own account — open to every role, since it only touches their own login. */
export default async function AccountPage() {
  const { t } = await getI18n();
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t("Akun saya")} description={t("Kelola akun yang sedang Anda pakai untuk masuk.")} />

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar src={user.image} name={user.name ?? user.email ?? ""} size={56} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand">{t(ROLE_LABEL[user.role as keyof typeof ROLE_LABEL])}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Ubah kata sandi")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
