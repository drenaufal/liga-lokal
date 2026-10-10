import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getReferee } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { RefereeForm } from "../../referee-form";

export const metadata: Metadata = { title: "Ubah Data Wasit" };
export const dynamic = "force-dynamic";

export default async function EditRefereePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("registry:write");
  const { id } = await params;
  const referee = await getReferee(id);
  if (!referee) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/registry/wasit/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke profil
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Ubah Data Wasit</h1>
      <p className="mt-1 text-sm text-ink-muted">{referee.fullName}. Perubahan tercatat pada jejak audit.</p>
      <Card className="mt-5">
        <CardContent>
          <RefereeForm referee={referee} />
        </CardContent>
      </Card>
    </div>
  );
}
