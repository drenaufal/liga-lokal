import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { OperatorForm } from "../operator-form";

export const metadata: Metadata = { title: "Operator Baru" };

export default async function NewOperatorPage() {
  await requireCapability("registry.operator:create");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/registry/operator" className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Operator Baru</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Buat akun login untuk petugas konsol pertandingan. Perubahan tercatat pada jejak audit.
      </p>
      <Card className="mt-5">
        <CardContent>
          <OperatorForm />
        </CardContent>
      </Card>
    </div>
  );
}
