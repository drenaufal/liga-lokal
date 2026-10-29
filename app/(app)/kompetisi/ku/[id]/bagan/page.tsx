import { getKnockoutMatches } from "@/lib/queries/competition";
import { requireViewerCapability } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Bracket } from "@/components/app/bracket";

export const dynamic = "force-dynamic";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireViewerCapability("competition:view");
  const { id } = await params;
  const matches = await getKnockoutMatches(id);

  return (
    <Card>
      <CardContent>
        <Bracket matches={matches} />
      </CardContent>
    </Card>
  );
}
