import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { scoringFormulas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileNav } from "@/components/app/mobile-nav";
import { AccessNotice } from "@/components/app/access-notice";
import type { Role } from "@/lib/auth/rbac";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getCurrentUser();
  if (!account) redirect("/login");

  const active = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.isActive, true),
    columns: { name: true },
  });

  const user = {
    name: account.name ?? "Pengguna",
    email: account.email ?? "",
    image: account.image,
    role: (account.role ?? "viewer") as Role,
    title: account.title,
  };

  return (
    <div className="min-h-dvh bg-base lg:flex">
      <Sidebar role={user.role} grants={account.grants} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} grants={account.grants} activeFormula={active?.name ?? null} />
        {/* bottom padding clears the floating mobile nav */}
        <main className="min-w-0 flex-1 px-4 pb-32 pt-6 sm:px-6 lg:pb-12 lg:pl-5 lg:pr-8">{children}</main>
      </div>
      <MobileNav role={user.role} grants={account.grants} user={user} />
      <Suspense fallback={null}>
        <AccessNotice />
      </Suspense>
    </div>
  );
}
