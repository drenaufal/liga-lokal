import { Badge } from "@/components/ui/badge";
import {
  IMPORT_BATCH_STATUS,
  MATCH_STATUS,
  POSITION,
  REFEREE_STATUS,
  REGISTRATION_STATUS,
  RESULT_STATUS,
  TOURNAMENT_STATUS,
  VERIFICATION,
} from "@/lib/status";

const MAPS = {
  verification: VERIFICATION,
  referee: REFEREE_STATUS,
  tournament: TOURNAMENT_STATUS,
  match: MATCH_STATUS,
  result: RESULT_STATUS,
  registration: REGISTRATION_STATUS,
  import: IMPORT_BATCH_STATUS,
  position: POSITION,
} as const;

export function StatusBadge({
  kind,
  value,
  dot,
}: {
  kind: keyof typeof MAPS;
  value: string;
  dot?: boolean;
}) {
  const meta = (MAPS[kind] as Record<string, { label: string; tone: never }>)[value];
  if (!meta) return <Badge>{value}</Badge>;
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}
