import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { venues } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { VenueForm } from "../../venue-form";
export const dynamic = "force-dynamic";
export default async function EditVenue({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("registry.venue:edit");
  const { id } = await params;
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, id) });
  if (!venue) notFound();
  return <div className="mx-auto max-w-2xl"><PageHeader title="Edit Venue" description={venue.name} /><Card><CardContent className="p-6"><VenueForm venue={venue} /></CardContent></Card></div>;
}
