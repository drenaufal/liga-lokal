import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { scoringFormulas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileNav } from "@/components/app/mobile-nav";
import { AccessNotice } from "@/components/app/access-notice";
import { GUEST_GRANTS, type Role } from "@/lib/auth/rbac";
import { OPEN_VIEW_HEADER } from "@/lib/auth/redirect";
import { getT } from "@/lib/i18n/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getCurrentUser();
  // Visitors without an account may read a few pages (see OPEN_VIEWS in proxy.ts); the proxy marks them.
  const guest = !account;
  if (guest && (await headers()).get(OPEN_VIEW_HEADER) !== "1") redirect("/login");
  const t = await getT();

  const active = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.isActive, true),
    columns: { name: true },
  });

  const user = account
    ? {
        name: account.name ?? t("Pengguna"),
        email: account.email ?? "",
        image: account.image,
        role: (account.role ?? "viewer") as Role,
        title: account.title,
      }
    : null;
  const role: Role = user?.role ?? "viewer";
  const grants = account?.grants ?? GUEST_GRANTS;

  return (
    <div className="min-h-dvh bg-base lg:flex">
      <Sidebar role={role} grants={grants} guest={guest} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} grants={grants} activeFormula={active?.name ?? null} />
        {/* bottom padding clears the floating mobile nav */}
        <main className="min-w-0 flex-1 px-4 pb-32 pt-6 sm:px-6 lg:pb-12 lg:pl-5 lg:pr-8">{children}</main>
      </div>
      <MobileNav role={role} grants={grants} user={user} />
      <Suspense fallback={null}>
        <AccessNotice />
      </Suspense>
    </div>
  );
}
