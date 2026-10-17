import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { homeHref } from "@/lib/nav";
import { logoutAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Belum Ada Akses" };
export const dynamic = "force-dynamic";

/** Where an account lands when its role has not been given access to any menu. */
export default async function NoAccessPage() {
  const user = await requireUser();
  const home = homeHref(user);
  if (home) redirect(home);

  return (
    <div className="mx-auto max-w-lg pt-10">
      <EmptyState
        icon={LockKeyhole}
        title="Peran Anda belum memiliki akses ke menu apa pun"
        description="Hubungi Super Admin agar peran Anda diberi akses pada Pengaturan → Hak Akses Peran, lalu masuk kembali."
        action={
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Keluar
            </Button>
          </form>
        }
      />
    </div>
  );
}
