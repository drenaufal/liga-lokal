import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { VenueForm } from "../venue-form";

export const metadata: Metadata = { title: "Registrasi Venue Baru" };

export default async function NewVenuePage() {
  await requireCapability("registry.venue:create");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/registry/venue" className="mb-5 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"><ArrowLeft className="size-3.5" /> Kembali ke venue</Link>
      <PageHeader title="Venue Baru" description="Daftarkan lokasi dan fasilitas untuk digunakan dalam jadwal pertandingan." />
      <Card><CardContent className="p-5 sm:p-6"><VenueForm /></CardContent></Card>
    </div>
  );
}
